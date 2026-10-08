import { ButtonLink } from "@/components/common/Button";
import { EmptyState } from "@/components/common/Card";
import type { ReservationDTO } from "@/types";
import ReservationCard from "./ReservationCard";

export default function ReservationsList({
  reservations,
  editableIds,
  emptyTitle,
  emptyCta,
}: {
  reservations: ReservationDTO[];
  /** Reservations the client can still modify or cancel. */
  editableIds: Set<string>;
  emptyTitle: string;
  /** Label of the "book a table" button shown when the list is empty. */
  emptyCta?: string;
}) {
  if (reservations.length === 0) {
    return (
      <EmptyState title={emptyTitle}>
        {emptyCta && (
          <ButtonLink href="/reserve" className="mt-4">
            {emptyCta}
          </ButtonLink>
        )}
      </EmptyState>
    );
  }
  return (
    <ul className="space-y-3">
      {reservations.map((r) => (
        <li key={r.id}>
          <ReservationCard reservation={r} editable={editableIds.has(r.id)} />
        </li>
      ))}
    </ul>
  );
}
