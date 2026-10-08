import { describe, expect, it } from "vitest";
import {
  fmt,
  getDictionary,
  localePath,
  plural,
  requestLocale,
  splitLocale,
  translateError,
  translateFieldErrors,
} from "@/i18n";
import { loginSchema } from "@/lib/validation";
import { z } from "zod";

describe("locale routing", () => {
  it("prefixes app paths and is idempotent", () => {
    expect(localePath("it", "/reserve")).toBe("/it/reserve");
    expect(localePath("en", "/")).toBe("/en");
    expect(localePath("en", "/en/reserve?x=1")).toBe("/en/reserve?x=1");
    expect(localePath("it", "/api/reports/export")).toBe("/api/reports/export");
    expect(localePath("it", "mailto:a@b.co")).toBe("mailto:a@b.co");
  });

  it("splits the locale out of a pathname", () => {
    expect(splitLocale("/en/admin/dashboard")).toEqual({ locale: "en", path: "/admin/dashboard" });
    expect(splitLocale("/it")).toEqual({ locale: "it", path: "/" });
    expect(splitLocale("/reserve")).toEqual({ locale: null, path: "/reserve" });
  });

  it("reads the API request locale from header, then cookie, then defaults to Italian", () => {
    const req = (headers: Record<string, string>) => new Request("http://x/api", { headers });
    expect(requestLocale(req({ "x-locale": "en" }))).toBe("en");
    expect(requestLocale(req({ cookie: "a=1; NEXT_LOCALE=en" }))).toBe("en");
    expect(requestLocale(req({ "x-locale": "fr" }))).toBe("it");
    expect(requestLocale(req({}))).toBe("it");
  });
});

describe("messages", () => {
  it("interpolates and pluralises", () => {
    expect(fmt("Ciao {name}", { name: "Giulia" })).toBe("Ciao Giulia");
    const it_ = getDictionary("it");
    const en = getDictionary("en");
    expect(plural(1, it_.common.people)).toBe("1 persona");
    expect(plural(4, it_.common.people)).toBe("4 persone");
    expect(plural(2, en.common.people)).toBe("2 guests");
  });

  it("translates API error codes per language, with a safe fallback", () => {
    expect(translateError(getDictionary("it"), "TABLE_TOO_SMALL", { number: 5, capacity: 4 })).toBe(
      "Il tavolo 5 è per massimo 4 persone.",
    );
    expect(translateError(getDictionary("en"), "TABLE_TAKEN")).toMatch(/someone has just booked/);
    expect(translateError(getDictionary("en"), "SOMETHING_UNKNOWN")).toBe(getDictionary("en").errors.INTERNAL_ERROR);
  });

  it("turns Zod message keys into localized field errors", () => {
    const parsed = loginSchema.safeParse({ email: "nope", password: "" });
    const errors = z.flattenError(parsed.error!).fieldErrors as Record<string, string[]>;
    expect(translateFieldErrors(getDictionary("it"), errors).email).toEqual(["Email non valida"]);
    expect(translateFieldErrors(getDictionary("en"), errors).password).toEqual(["Enter your password"]);
  });
});

describe("dictionaries", () => {
  // TypeScript already enforces the shape; this also catches empty strings and
  // array length mismatches (e.g. weekdays, feature lists).
  function leaves(obj: unknown, prefix = ""): Array<[string, unknown]> {
    if (obj && typeof obj === "object") {
      return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) => leaves(v, prefix ? `${prefix}.${k}` : k));
    }
    return [[prefix, obj]];
  }

  it("Italian and English have the same keys and no empty strings", () => {
    const it_ = new Map(leaves(getDictionary("it")));
    const en = new Map(leaves(getDictionary("en")));
    expect([...en.keys()].sort()).toEqual([...it_.keys()].sort());
    for (const [key, value] of [...it_, ...en]) {
      if (key.endsWith('preference.')) continue;
      expect(value, key).not.toBe("");
    }
  });
});
