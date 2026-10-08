import type { Dictionary } from "@/i18n";
import type { RestaurantDTO } from "@/services/restaurantService";

/** Weekly schedule, Monday first. */
export default function OpeningHours({ hours, t }: { hours: RestaurantDTO["openingHours"]; t: Dictionary }) {
  const order = [1, 2, 3, 4, 5, 6, 0];
  return (
    <dl className="divide-y divide-line">
      {order.map((day) => {
        const shifts = hours.filter((h) => h.dayOfWeek === day);
        return (
          <div key={day} className="flex items-baseline justify-between gap-4 py-2.5 text-sm">
            <dt className="font-semibold text-primary">{t.enums.weekdays[day]}</dt>
            <dd className={shifts.length ? "text-right" : "text-muted"}>
              {shifts.length
                ? shifts.map((s) => `${t.enums.shift[s.shift]} ${s.opensAt}–${s.closesAt}`).join(" · ")
                : t.home.closed}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
