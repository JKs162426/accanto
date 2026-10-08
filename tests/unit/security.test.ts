import { describe, expect, it } from "vitest";
import { safeNext } from "@/components/auth/LoginForm";
import { reportQuerySchema } from "@/lib/validation";
import { isRecipientAllowed } from "@/lib/email";
import { signSession, verifySession } from "@/lib/session";

const ORIGIN = "https://accanto.example";

describe("safeNext (post-login redirect)", () => {
  it("keeps same-origin paths", () => {
    expect(safeNext("/it/reserve?date=2026-10-23", "/it", ORIGIN)).toBe("/it/reserve?date=2026-10-23");
  });

  it.each([
    "//evil.example/x",
    "/\\evil.example/x",
    "/\\\\evil.example",
    "/\tevil.example",
    "/%0a/evil.example",
    "https://evil.example",
    "javascript:alert(1)",
    "",
  ])("never leaves the origin for %j", (next) => {
    const target = safeNext(next, "/it", ORIGIN);
    expect(new URL(target, ORIGIN).origin).toBe(ORIGIN);
    expect(target.startsWith("//")).toBe(false);
  });
});

describe("report range", () => {
  it("accepts up to a year and rejects longer or inverted ranges", () => {
    expect(reportQuerySchema.safeParse({ from: "2026-01-01", to: "2026-12-31" }).success).toBe(true);
    expect(reportQuerySchema.safeParse({ from: "1000-01-01", to: "2026-10-07" }).success).toBe(false);
    expect(reportQuerySchema.safeParse({ from: "2026-10-08", to: "2026-10-07" }).success).toBe(false);
  });
});

describe("email recipient allowlist", () => {
  it("allows everything when unset, and only listed recipients/domains when set", () => {
    delete process.env.EMAIL_RECIPIENT_ALLOWLIST;
    expect(isRecipientAllowed("anyone@example.com")).toBe(true);
    process.env.EMAIL_RECIPIENT_ALLOWLIST = "@accanto.local, owner@example.com";
    expect(isRecipientAllowed("client1@accanto.local")).toBe(true);
    expect(isRecipientAllowed("OWNER@example.com")).toBe(true);
    expect(isRecipientAllowed("victim@example.com")).toBe(false);
    expect(isRecipientAllowed("x@evilaccanto.local")).toBe(false);
    delete process.env.EMAIL_RECIPIENT_ALLOWLIST;
  });
});

describe("session tokens", () => {
  it("carry the session version and reject tampering", async () => {
    process.env.AUTH_SECRET = "test-secret-test-secret-test-secret-123";
    const token = await signSession({ sub: "u1", role: "CLIENT", name: "Giulia", v: 3 });
    expect(await verifySession(token)).toMatchObject({ sub: "u1", role: "CLIENT", v: 3 });
    const [h, p, sig] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(p, "base64url").toString()), role: "ADMIN" })).toString("base64url");
    expect(await verifySession(`${h}.${forged}.${sig}`)).toBeNull();
    expect(await verifySession(`${h}.${p}.`)).toBeNull();
  });
});
