import type { Context, Next } from "hono";
import { getUserFromBearer, type AuthUser } from "@ragify/core/auth";

declare module "hono" {
  interface ContextVariableMap {
    user: AuthUser;
  }
}

export async function requireAuth(c: Context, next: Next) {
  const user = await getUserFromBearer(c.req.header("authorization"));
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  c.set("user", user);
  await next();
}

export async function optionalAuth(c: Context, next: Next) {
  const user = await getUserFromBearer(c.req.header("authorization"));
  if (user) c.set("user", user);
  await next();
}