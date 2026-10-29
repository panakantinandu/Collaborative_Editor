import { beforeEach, describe, expect, it } from "vitest";
import { signSession, verifySession, SESSION_SECONDS } from "@/lib/session";
beforeEach(() => { process.env.SESSION_SECRET = "test-only-secret-with-more-than-32-characters"; });
describe("signed demo session", () => {
  it("verifies valid signed identities", () => expect(verifySession(signSession("alice", 1000), 2000)).toBe("alice"));
  it("rejects expired sessions", () => expect(verifySession(signSession("alice", 1000), 1000 + SESSION_SECONDS * 1000)).toBeNull());
  it("rejects tampering, unsigned identities, and malformed tokens", () => {
    const token = signSession("alice");
    expect(verifySession(`${Buffer.from(JSON.stringify({ userId: "bob", expires: Date.now() + 10000 })).toString("base64url")}.${token.split(".")[1]}`)).toBeNull();
    for (const value of [undefined, "alice", "alice.bob", `${token}.extra`, "x".repeat(3000)]) expect(verifySession(value)).toBeNull();
  });
});
