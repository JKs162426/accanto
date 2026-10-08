// Re-exports of Prisma's generated types. `enums` is browser-safe, so client
// components can import from here without pulling in the Prisma runtime.
export * from "@/generated/prisma/enums";
export type {
  User,
  Restaurant,
  OpeningHour,
  ClosedDate,
  Table,
  Reservation,
  ReservationHistory,
  Notification,
  EmailLog,
} from "@/generated/prisma/client";
