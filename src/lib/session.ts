import { createHmac, timingSafeEqual } from "node:crypto";
export const SESSION_COOKIE = "draftly_session";
export const SESSION_SECONDS = 60 * 60 * 24 * 7;
function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32 || value.startsWith("replace-")) throw new Error("SESSION_SECRET must contain at least 32 random characters.");
  return value;
}
export function signSession(userId: string, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({ userId, expires: now + SESSION_SECONDS * 1000 })).toString("base64url");
  return `${payload}.${createHmac("sha256", secret()).update(payload).digest("base64url")}`;
}
export function verifySession(token: string | undefined, now = Date.now()): string | null {
  if (!token || token.length > 2048) return null;
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) return null;
  const expected = createHmac("sha256", secret()).update(payload).digest();
  const actual = Buffer.from(signature, "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    return typeof data.userId === "string" && typeof data.expires === "number" && data.expires > now ? data.userId : null;
  } catch { return null; }
}
