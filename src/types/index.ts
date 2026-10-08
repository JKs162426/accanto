import type {
  ReservationStatus,
  Role,
  ShiftName,
  TableLocation,
  TableStatus,
  TableType,
} from "./database";

/** The authenticated user as exposed to the app (never includes the password). */
export interface SessionUser {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  role: Role;
}

/** Table as shown to guests (public availability API) — no internal notes. */
export type PublicTableDTO = Omit<TableDTO, "notes">;

/** Serializable table shape for the admin (includes internal notes). */
export interface TableDTO {
  id: string;
  number: number;
  capacity: number;
  location: TableLocation;
  type: TableType;
  isWindow: boolean;
  status: TableStatus;
  notes: string | null;
}

/** Serializable reservation shape. Dates are "YYYY-MM-DD", instants ISO strings. */
export interface ReservationDTO {
  id: string;
  code: string;
  date: string;
  time: string;
  startsAt: string;
  endsAt: string;
  partySize: number;
  status: ReservationStatus;
  guestName: string;
  guestEmail: string;
  guestPhone: string | null;
  notes: string | null;
  /** Only present for admins. */
  internalNotes?: string | null;
  clientId: string | null;
  table: Pick<TableDTO, "id" | "number" | "capacity" | "location" | "type" | "isWindow">;
  createdAt: string;
}

export interface SlotDTO {
  time: string;
  shift: ShiftName;
  /** Free tables that fit the requested party/preference at this time. */
  free: number;
}

export interface AvailabilityDTO {
  date: string;
  open: boolean;
  message?: string;
  slots: SlotDTO[];
  /** Present when a time was requested. */
  time?: string;
  tables?: PublicTableDTO[];
  /** Largest party each seating preference can host ("" = any), occupancy ignored. */
  preferenceCapacity?: Record<string, number>;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: { fieldErrors?: Record<string, string[] | undefined> } & Record<string, unknown>;
  };
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
