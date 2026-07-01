import { verifyToken } from "@clerk/backend";
import { upsertUserFromClerk } from "./db/index.js";

export type AuthUser = {
  id: string;
  clerkUserId: string;
  email?: string;
};

export async function getUserFromBearer(
  authHeader: string | undefined
): Promise<AuthUser | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7);
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) return null;

  try {
    const payload = await verifyToken(token, { secretKey });
    const clerkUserId = payload.sub;
    if (!clerkUserId) return null;

    const user = await upsertUserFromClerk(clerkUserId);

    return {
      id: user.id,
      clerkUserId: user.clerk_user_id,
      email: user.email ?? undefined,
    };
  } catch {
    return null;
  }
}
