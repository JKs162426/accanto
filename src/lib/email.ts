import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import nodemailer, { type Transporter } from "nodemailer";
import type { EmailTemplate } from "@/generated/prisma/enums";

/**
 * Low-level email delivery. Provider is chosen from the environment:
 *   RESEND_API_KEY → Resend HTTP API (recommended on Vercel)
 *   EMAIL_HOST     → SMTP via Nodemailer
 *   neither        → printed to the server console (local development)
 */

export interface OutgoingEmail {
  to: string;
  subject: string;
  html: string;
}

const TEMPLATE_FILES: Record<EmailTemplate, string> = {
  RESERVATION_CONFIRMED: "reservation-confirmed.html",
  RESERVATION_REMINDER_24H: "reservation-reminder-24h.html",
  RESERVATION_REMINDER_2H: "reservation-reminder-24h.html", // same layout, different copy
  RESERVATION_CANCELLED: "reservation-cancelled.html",
  RESERVATION_MODIFIED: "reservation-modified.html",
  NEW_RESERVATION_ADMIN: "new-reservation-admin.html",
};

const templateCache = new Map<string, string>();

async function loadTemplate(file: string): Promise<string> {
  const cached = templateCache.get(file);
  if (cached) return cached;
  // The emails/ folder is bundled with the API functions via
  // `outputFileTracingIncludes` in next.config.ts.
  const html = await readFile(path.join(process.cwd(), "emails", file), "utf8");
  if (process.env.NODE_ENV === "production") templateCache.set(file, html);
  return html;
}

const escapeHtml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/**
 * Minimal mustache-style renderer:
 *   {{var}}              escaped value
 *   {{#var}}…{{/var}}    block rendered only when var is truthy
 * Every value is HTML-escaped, so user input (names, notes) can't inject markup.
 */
export function renderTemplate(html: string, vars: Record<string, unknown>): string {
  const withSections = html.replace(
    /{{#(\w+)}}([\s\S]*?){{\/\1}}/g,
    (_, key: string, inner: string) => (vars[key] ? inner : ""),
  );
  return withSections.replace(/{{(\w+)}}/g, (_, key: string) =>
    escapeHtml(vars[key] === undefined || vars[key] === null ? "" : String(vars[key])),
  );
}

export async function renderEmail(
  template: EmailTemplate,
  vars: Record<string, unknown>,
): Promise<string> {
  return renderTemplate(await loadTemplate(TEMPLATE_FILES[template]), vars);
}

let smtp: Transporter | null = null;

function smtpTransport(): Transporter {
  smtp ??= nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT ?? 587),
    secure: Number(process.env.EMAIL_PORT) === 465,
    auth: process.env.EMAIL_USER
      ? { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASSWORD }
      : undefined,
  });
  return smtp;
}

/**
 * Optional safety net for public demos: when EMAIL_RECIPIENT_ALLOWLIST is set
 * (comma-separated addresses and/or "@domain" entries), email is only ever
 * delivered to those recipients.
 */
export function isRecipientAllowed(recipient: string): boolean {
  const raw = process.env.EMAIL_RECIPIENT_ALLOWLIST?.trim();
  if (!raw) return true;
  const to = recipient.trim().toLowerCase();
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .some((entry) => (entry.startsWith("@") ? to.endsWith(entry) : to === entry));
}

export function emailProvider(): "resend" | "smtp" | "console" {
  if (process.env.RESEND_API_KEY) return "resend";
  if (process.env.EMAIL_HOST) return "smtp";
  return "console";
}

export async function deliverEmail(email: OutgoingEmail): Promise<void> {
  const from = process.env.EMAIL_FROM || "Accanto <noreply@accanto.local>";
  switch (emailProvider()) {
    case "resend": {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ from, to: email.to, subject: email.subject, html: email.html }),
      });
      if (!res.ok) throw new Error(`Resend responded ${res.status}: ${await res.text()}`);
      return;
    }
    case "smtp":
      await smtpTransport().sendMail({ from, ...email });
      return;
    case "console":
      console.info(`\n📧 [email:console] to=${email.to}\n   subject=${email.subject}\n`);
  }
}
