import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { DEMO_EMAILS } from "@/lib/constants";
import { SESSION_COOKIE, verifySession } from "@/lib/session";
import { fail } from "@/lib/errors";
export async function currentUser() {
  const userId = verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!userId) return null;
  return db.user.findFirst({ where: { id: userId, email: { in: DEMO_EMAILS } } });
}
export async function requireUser() { return (await currentUser()) ?? fail(401, "UNAUTHENTICATED", "Choose a demo user to continue."); }
