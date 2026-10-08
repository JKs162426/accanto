import { NextResponse, after } from "next/server";
import { handle, parseBody, requireApiUser } from "@/lib/api";
import { adminUpdateReservationSchema, updateReservationSchema } from "@/lib/validation";
import {
  cancelReservation,
  getReservation,
  getReservationHistory,
  toReservationDTO,
  updateReservation,
} from "@/services/reservationService";
import { processEmailQueue } from "@/services/emailService";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle<Ctx>(async (_request, { params }) => {
  const user = await requireApiUser();
  const { id } = await params;
  const reservation = await getReservation(id, user);
  const history = user.role === "ADMIN" ? await getReservationHistory(id) : undefined;
  return NextResponse.json({ reservation: toReservationDTO(reservation, user), history });
});

/** Change date/time/party size (clients) — plus table, status and internal notes (admins). */
export const PATCH = handle<Ctx>(async (request, { params }) => {
  const user = await requireApiUser();
  const { id } = await params;
  const input = await parseBody(
    request,
    user.role === "ADMIN" ? adminUpdateReservationSchema : updateReservationSchema,
  );
  const reservation = await updateReservation(id, input, user);
  after(() => processEmailQueue());
  return NextResponse.json({ reservation: toReservationDTO(reservation, user) });
});

/** Cancels. Reservations are never hard-deleted so history and reports stay intact. */
export const DELETE = handle<Ctx>(async (_request, { params }) => {
  const user = await requireApiUser();
  const { id } = await params;
  const reservation = await cancelReservation(id, user);
  after(() => processEmailQueue());
  return NextResponse.json({ reservation: toReservationDTO(reservation, user) });
});
