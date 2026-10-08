import SiteShell from "@/components/common/SiteShell";
import { ButtonLink } from "@/components/common/Button";
import { getI18n } from "@/i18n/server";

export default async function NotFound() {
  const { t } = await getI18n();
  const copy = t.notFound;
  return (
    <SiteShell>
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <p className="font-display text-7xl font-bold text-accent-text">404</p>
        <h1 className="text-h3">{copy.title}</h1>
        <p className="max-w-sm text-body-lg text-muted">{copy.text}</p>
        <ButtonLink href="/">{copy.cta}</ButtonLink>
      </div>
    </SiteShell>
  );
}
