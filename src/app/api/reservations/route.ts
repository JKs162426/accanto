import { NextResponse, after } from "next/server";
import { handle, parseBody, parseQuery, requireApiUser } from "@/lib/api";
import {
  adminCreateReservationSchema,
  createReservationSchema,
  reservationListQuerySchema,
} from "@/lib/validation";
import { createReservation, listReservations, toReservationDTO } from "@/services/reservationService";
import { processEmailQueue } from "@/services/emailService";
import { requestLocale } from "@/i18n";

/** Clients get their own reservations; admins get everyone's, with filters. */
export const GET = handle(async (request) => {
  const user = await requireApiUser();
  const filters = parseQuery(request, reservationListQuerySchema);
  const result = await listReservations(filters, user);
  return NextResponse.json({ ...result, items: result.items.map((r) => toReservationDTO(r, user)) });
});

export const POST = handle(async (request) => {
  const user = await requireApiUser();
  const input = await parseBody(
    request,
    user.role === "ADMIN" ? adminCreateReservationSchema : createReservationSchema,
  );
  // Guest emails go out in the language the booking was made in.
  const reservation = await createReservation(input, user, requestLocale(request));
  // Deliver the confirmation emails after the response has been sent.
  after(() => processEmailQueue());
  return NextResponse.json({ reservation: toReservationDTO(reservation, user) }, { status: 201 });
});
