import { Suspense } from "react";
import SiteShell from "@/components/common/SiteShell";
import { ButtonLink } from "@/components/common/Button";
import { Card } from "@/components/common/Card";
import { Skeleton } from "@/components/common/Loading";
import OpeningHours from "@/components/home/OpeningHours";
import { fmt, type Dictionary } from "@/i18n";
import { getI18n } from "@/i18n/server";
import { getCachedRestaurant } from "@/services/restaurantService";

/** Decorative arch framing Turin: the Alps at sunset and the Mole Antonelliana. */
function ArchIllustration() {
  return (
    <svg viewBox="0 0 320 400" className="h-auto w-full max-w-sm" aria-hidden>
      <defs>
        <clipPath id="arch">
          <path d="M40 400V170a120 120 0 0 1 240 0v230z" />
        </clipPath>
      </defs>
      <g clipPath="url(#arch)">
        <rect width="320" height="400" fill="#f3e6d3" />
        <circle cx="96" cy="176" r="30" fill="var(--terracotta)" opacity="0.9" />
        {/* Far Alps (snow caps) */}
        <path d="M0 250l46-62 30 34 44-70 40 52 30-30 56 76 34-40 40 40v150H0z" fill="#2a6e9e" />
        <path d="M120 152l-12 16 6-3 6 6 6-6 6 3zM190 174l-9 12 4-2 5 5 5-5 4 2z" fill="var(--cream)" opacity="0.95" />
        {/* Near hills */}
        <path d="M0 290c50-26 90-30 140-14s110 10 180-18v142H0z" fill="var(--mediterranean-blue)" />
        {/* Mole Antonelliana */}
        <g fill="var(--cream)">
          <rect x="190" y="268" width="46" height="26" />
          <path d="M190 268Q200 236 210 220h6q10 16 20 48z" />
          <rect x="209" y="206" width="8" height="14" />
          <path d="M213 136l3.5 70h-7z" />
        </g>
        {/* Rooftops */}
        <path d="M40 330h40v-14h18v14h36v-22h20v22h50v-10h30v10h46v70H40z" fill="#143a51" />
      </g>
      <path d="M40 400V170a120 120 0 0 1 240 0v230" fill="none" stroke="var(--gold)" strokeWidth="3" />
      <path d="M24 400V170a136 136 0 0 1 272 0v230" fill="none" stroke="var(--gold)" strokeWidth="1" opacity="0.6" />
    </svg>
  );
}

function Ornament() {
  return (
    <div className="flex items-center justify-center gap-3 text-gold" aria-hidden>
      <span className="h-px w-16 bg-gold" />
      <svg viewBox="0 0 12 12" className="size-3"><path d="M6 0l1.6 4.4L12 6l-4.4 1.6L6 12 4.4 7.6 0 6l4.4-1.6z" fill="currentColor" /></svg>
      <span className="h-px w-16 bg-gold" />
    </div>
  );
}

async function RestaurantInfo({ t }: { t: Dictionary }) {
  const restaurant = await getCachedRestaurant();
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <h3 className="mb-3 text-h4 sm:text-h3">{t.home.hoursTitle}</h3>
        <OpeningHours hours={restaurant.openingHours} t={t} />
        <p className="mt-4 text-body-sm text-muted">{fmt(t.home.turnover, { hours: restaurant.turnoverMinutes / 60 })}</p>
      </Card>
      <Card className="flex flex-col">
        <h3 className="mb-3 text-h4 sm:text-h3">{t.home.whereTitle}</h3>
        <address className="space-y-1 not-italic">
          <p>{restaurant.address}</p>
          {restaurant.phone && (
            <p>
              <a href={`tel:${restaurant.phone.replace(/\s/g, "")}`} className="text-primary hover:underline">{restaurant.phone}</a>
            </p>
          )}
          {restaurant.email && (
            <p>
              <a href={`mailto:${restaurant.email}`} className="text-primary hover:underline">{restaurant.email}</a>
            </p>
          )}
        </address>
        <p className="mt-4 text-body-sm text-muted">{fmt(t.home.groups, { n: restaurant.maxPartySize })}</p>
        <div className="mt-auto pt-6">
          <ButtonLink href="/reserve">{t.home.bookNow}</ButtonLink>
        </div>
      </Card>
    </div>
  );
}

export default async function Home() {
  const { t } = await getI18n();
  return (
    <SiteShell wide>
      <section className="border-b border-line">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 md:grid-cols-[1.3fr_1fr] md:py-24">
          <div>
            <p className="font-ui text-caption font-medium tracking-[0.3em] text-accent-text uppercase">{t.home.eyebrow}</p>
            <h1 className="mt-5 text-[40px] leading-[1.1] font-bold sm:text-h1">
              {t.home.titleBefore} <em className="font-semibold text-terracotta">{t.home.titleAccent}</em> {t.home.titleAfter}
            </h1>
            <p className="mt-6 max-w-xl text-body-lg text-muted">{t.home.lead}</p>
            <div className="mt-10 flex flex-wrap gap-3">
              <ButtonLink href="/reserve" size="lg">
                {t.home.ctaReserve}
              </ButtonLink>
              <ButtonLink href="/my-reservations" size="lg" variant="secondary">
                {t.home.ctaMine}
              </ButtonLink>
            </div>
          </div>
          <div className="hidden justify-center md:flex">
            <ArchIllustration />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <Ornament />
        <h2 className="mt-6 text-center text-h3 sm:text-h2">{t.home.houseTitle}</h2>
        <div className="mt-10 grid gap-10 sm:grid-cols-3">
          {t.home.features.map((f) => (
            <div key={f.title} className="text-center">
              <h3 className="text-h4">{f.title}</h3>
              <p className="mt-2 text-muted">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <Suspense
          fallback={
            <div className="grid gap-6 md:grid-cols-2">
              <Skeleton className="h-80" />
              <Skeleton className="h-80" />
            </div>
          }
        >
          <RestaurantInfo t={t} />
        </Suspense>
      </section>
    </SiteShell>
  );
}
