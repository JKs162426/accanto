/**
 * Zod schemas shared by forms (instant client-side feedback) and API routes
 * (authoritative validation). Keep this file free of server-only imports.
 */
import { z } from "zod";
import { SEATING_PREFERENCES } from "./constants";

const trimmed = (max: number) => z.string().trim().max(max);

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "invalidTime");
const date = z.iso.date({ error: "invalidDate" });
// Trim/lowercase *before* validating, so pasted " Ana@Mail.com " is accepted.
const email = z.string().trim().toLowerCase().max(254).pipe(z.email({ error: "invalidEmail" }));
const phone = z
  .string()
  .trim()
  .regex(/^\+?[0-9 ()-]{6,20}$/, "invalidPhone");
const optionalPhone = z.union([phone, z.literal("").transform(() => null)]).nullish();
const password = z
  .string()
  .min(8, "passwordMin")
  .max(72, "passwordMax") // bcrypt only uses the first 72 bytes
  .regex(/[A-Za-z]/, "passwordLetter")
  .regex(/[0-9]/, "passwordNumber");
const partySize = z.coerce.number().int().min(1, "partyMin").max(20, "partyMax");
const preference = z
  .enum(SEATING_PREFERENCES)
  .transform((v) => (v === "" ? null : v))
  .nullish();

// ─── Auth ──────────────────────────────────────────────────────────────

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "passwordRequired").max(200),
});

export const registerSchema = z.object({
  name: trimmed(80).min(2, "nameRequired"),
  email,
  phone: optionalPhone,
  password,
});

// ─── Availability & reservations ───────────────────────────────────────

export const availabilityQuerySchema = z.object({
  date,
  time: time.optional(),
  partySize: partySize.default(2),
  preference,
  /** When modifying, ignore this reservation's own slot. */
  excludeReservationId: z.string().max(40).optional(),
});

export const createReservationSchema = z.object({
  date,
  time,
  partySize,
  tableId: z.string().min(1, "tableRequired").max(40),
  guestName: trimmed(80).min(2, "nameRequired"),
  guestEmail: email,
  guestPhone: optionalPhone,
  notes: trimmed(500).nullish(),
});

/** What a client may change on their own reservation. */
export const updateReservationSchema = z
  .object({
    date: date.optional(),
    time: time.optional(),
    partySize: partySize.optional(),
    notes: trimmed(500).nullish(),
    guestPhone: optionalPhone,
  })
  .refine((v) => Object.keys(v).length > 0, "noChanges");

/** Admins can additionally move tables, change status and add internal notes. */
export const adminUpdateReservationSchema = z
  .object({
    date: date.optional(),
    time: time.optional(),
    partySize: partySize.optional(),
    tableId: z.string().max(40).optional(),
    notes: trimmed(500).nullish(),
    internalNotes: trimmed(1000).nullish(),
    guestName: trimmed(80).min(2).optional(),
    guestPhone: optionalPhone,
    status: z.enum(["CONFIRMED", "ATTENDED", "NO_SHOW"]).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "noChanges");

/** Admin manual booking (phone / walk-in). */
export const adminCreateReservationSchema = createReservationSchema.extend({
  clientId: z.string().max(40).nullish(),
  internalNotes: trimmed(1000).nullish(),
});

export const reservationListQuerySchema = z.object({
  q: trimmed(100).optional(),
  date: date.optional(),
  from: date.optional(),
  to: date.optional(),
  status: z.enum(["CONFIRMED", "ATTENDED", "NO_SHOW", "CANCELLED"]).optional(),
  scope: z.enum(["upcoming", "past", "all"]).default("all"),
  page: z.coerce.number().int().min(1).default(1),
});

// ─── Tables ────────────────────────────────────────────────────────────

export const tableSchema = z.object({
  number: z.coerce.number().int().min(1).max(999),
  capacity: z.coerce.number().int().min(1).max(30),
  location: z.enum(["INTERIOR", "TERRACE", "PRIVATE"]),
  type: z.enum(["STANDARD", "PRIVATE", "VIP"]),
  isWindow: z.boolean().default(false),
  status: z.enum(["ACTIVE", "OUT_OF_SERVICE"]).default("ACTIVE"),
  notes: trimmed(300).nullish(),
});

export const tableUpdateSchema = tableSchema.partial();

// ─── Users ─────────────────────────────────────────────────────────────

export const profileSchema = z.object({
  name: trimmed(80).min(2, "nameRequired").optional(),
  phone: optionalPhone,
  remind24h: z.boolean().optional(),
  remind2h: z.boolean().optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "currentPasswordRequired"),
  newPassword: password,
});

export const adminUserUpdateSchema = z.object({
  adminNotes: trimmed(2000).nullish(),
  phone: optionalPhone,
  name: trimmed(80).min(2).optional(),
});

export const userListQuerySchema = z.object({
  q: trimmed(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
});

// ─── Restaurant settings ───────────────────────────────────────────────

export const openingHourSchema = z
  .object({
    dayOfWeek: z.number().int().min(0).max(6),
    shift: z.enum(["LUNCH", "DINNER"]),
    opensAt: time,
    closesAt: time,
  })
  .refine((h) => h.opensAt < h.closesAt, {
    message: "closesAfterOpens",
    path: ["closesAt"],
  });

export const restaurantSettingsSchema = z.object({
  name: trimmed(80).min(1).optional(),
  description: trimmed(1000).nullish(),
  address: trimmed(200).nullish(),
  phone: trimmed(30).nullish(),
  email: z.union([email, z.literal("").transform(() => null)]).nullish(),
  timezone: z
    .string()
    .refine((tz) => Intl.supportedValuesOf("timeZone").includes(tz) || tz === "UTC", "invalidTimezone")
    .optional(),
  turnoverMinutes: z.coerce.number().int().min(30).max(360).optional(),
  slotIntervalMinutes: z.coerce.number().int().refine((n) => [15, 30, 60].includes(n), "intervalValues").optional(),
  bookingWindowDays: z.coerce.number().int().min(1).max(365).optional(),
  maxPartySize: z.coerce.number().int().min(1).max(30).optional(),
  avgSpendPerGuest: z.coerce.number().min(0).max(10_000).optional(),
  openingHours: z.array(openingHourSchema).max(14).optional(),
});

export const closedDateSchema = z.object({
  date,
  reason: trimmed(200).nullish(),
});

/** Reports and CSV export: at most one year, so aggregation stays cheap. */
export const reportQuerySchema = z
  .object({ from: date, to: date })
  .refine((r) => r.from <= r.to, { message: "rangeOrder", path: ["to"] })
  .refine((r) => (Date.parse(r.to) - Date.parse(r.from)) / 86_400_000 <= 366, { message: "rangeTooLong", path: ["to"] });

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type AvailabilityQuery = z.infer<typeof availabilityQuerySchema>;
export type CreateReservationInput = z.infer<typeof createReservationSchema>;
export type UpdateReservationInput = z.infer<typeof updateReservationSchema>;
export type AdminUpdateReservationInput = z.infer<typeof adminUpdateReservationSchema>;
export type AdminCreateReservationInput = z.infer<typeof adminCreateReservationSchema>;
export type TableInput = z.infer<typeof tableSchema>;
export type RestaurantSettingsInput = z.infer<typeof restaurantSettingsSchema>;
