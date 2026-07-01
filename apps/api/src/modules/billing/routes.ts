import Stripe from "stripe";
import type { Context } from "hono";
import {
  getUserById,
  getUserByStripeCustomerId,
  recordWebhook,
  updateUserPlan,
  webhookAlreadyProcessed,
} from "@ragify/core/db";
import { log, logError } from "@ragify/core/log";

function stripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  return new Stripe(key);
}

const PLAN_FROM_PRICE: Record<string, string> = {};

function planFromPriceId(priceId: string | undefined): string {
  if (!priceId) return "free";
  if (priceId === process.env.STRIPE_PRO_PRICE_ID) return "pro";
  if (priceId === process.env.STRIPE_STARTER_PRICE_ID) return "starter";
  return PLAN_FROM_PRICE[priceId] ?? "starter";
}

export async function checkoutPost(c: Context) {
  const user = c.get("user");
  const body = await c.req.json().catch(() => ({}));
  const plan = body.plan === "pro" ? "pro" : "starter";
  const priceId =
    plan === "pro"
      ? process.env.STRIPE_PRO_PRICE_ID
      : process.env.STRIPE_STARTER_PRICE_ID;

  if (!priceId) return c.json({ error: "Stripe price not configured" }, 500);

  const dbUser = await getUserById(user.id);
  if (!dbUser) return c.json({ error: "User not found" }, 404);

  const s = stripe();
  let customerId = dbUser.stripe_customer_id ?? undefined;

  if (!customerId) {
    const customer = await s.customers.create({
      email: user.email,
      metadata: { user_id: user.id, clerk_user_id: user.clerkUserId },
    });
    customerId = customer.id;
    await updateUserPlan(user.id, dbUser.plan, customerId);
  }

  const session = await s.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.VITE_APP_URL ?? "https://ragify.tech"}/dashboard?checkout=success`,
    cancel_url: `${process.env.VITE_APP_URL ?? "https://ragify.tech"}/dashboard?checkout=cancel`,
    metadata: { user_id: user.id },
  });

  return c.json({ url: session.url });
}

export async function portalPost(c: Context) {
  const user = c.get("user");
  const dbUser = await getUserById(user.id);
  if (!dbUser?.stripe_customer_id) {
    return c.json({ error: "No billing account" }, 400);
  }

  const session = await stripe().billingPortal.sessions.create({
    customer: dbUser.stripe_customer_id,
    return_url: `${process.env.VITE_APP_URL ?? "https://ragify.tech"}/dashboard`,
  });

  return c.json({ url: session.url });
}

export async function stripeWebhookPost(c: Context) {
  const sig = c.req.header("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !secret) return c.json({ error: "Webhook not configured" }, 400);

  const rawBody = await c.req.text();
  let event: Stripe.Event;

  try {
    event = stripe().webhooks.constructEvent(rawBody, sig, secret);
  } catch (err) {
    logError("stripe_webhook_verify_failed", err);
    return c.json({ error: "Invalid signature" }, 400);
  }

  if (await webhookAlreadyProcessed(event.id)) {
    return c.json({ ok: true, duplicate: true });
  }

  await recordWebhook(event.id, event.type, event);

  try {
    if (
      event.type === "checkout.session.completed" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.created"
    ) {
      const obj = event.data.object as Stripe.Checkout.Session | Stripe.Subscription;
      let userId: string | undefined;
      let customerId: string | undefined;
      let subscriptionId: string | undefined;
      let priceId: string | undefined;

      if ("metadata" in obj && obj.metadata?.user_id) {
        userId = obj.metadata.user_id;
      }
      if ("customer" in obj) customerId = String(obj.customer ?? "");
      if ("subscription" in obj && obj.subscription) {
        subscriptionId = String(obj.subscription);
      }
      if ("items" in obj && obj.items?.data?.[0]?.price?.id) {
        priceId = obj.items.data[0].price.id;
      }

      if (!userId && customerId) {
        const u = await getUserByStripeCustomerId(customerId);
        userId = u?.id;
      }

      if (userId) {
        const plan = planFromPriceId(priceId);
        const status =
          "status" in obj ? (obj as Stripe.Subscription).status : "active";
        const effectivePlan =
          status === "active" || status === "trialing" ? plan : "free";
        await updateUserPlan(
          userId,
          effectivePlan,
          customerId,
          subscriptionId
        );
        log({
          msg: "stripe_plan_updated",
          user_id: userId,
          plan: effectivePlan,
          event: event.type,
        });
      }
    }

    if (event.type === "customer.subscription.deleted") {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = String(sub.customer);
      const u = await getUserByStripeCustomerId(customerId);
      if (u) await updateUserPlan(u.id, "free");
    }
  } catch (err) {
    logError("stripe_webhook_handler_failed", err, { event: event.type });
    return c.json({ error: "Handler failed" }, 500);
  }

  return c.json({ ok: true });
}
