import { Suspense } from "react";
import NotificationBell from "@/components/admin/NotificationBell";
import LogoutButton from "@/components/auth/LogoutButton";
import { Skeleton } from "@/components/common/Loading";
import LocaleLink from "@/components/common/LocaleLink";
import Sidebar from "@/components/common/Sidebar";
import { requireAdmin } from "@/lib/auth";
import { getI18n } from "@/i18n/server";

/** Session read lives inside Suspense so the shell (sidebar) renders instantly. */
async function AdminBadge() {
  const { t, lang } = await getI18n();
  const admin = await requireAdmin(lang);
  return (
    <div className="bg-primary-strong font-ui text-cream flex items-center gap-3 rounded-lg p-3 text-sm">
      <span className="bg-gold text-primary-strong flex size-8 items-center justify-center rounded-full font-semibold">
        {admin.name.charAt(0)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{admin.name}</span>
        <LogoutButton className="text-caption text-gold-light hover:text-cream">
          {t.admin.logout}
        </LogoutButton>
      </span>
    </div>
  );
}

export default async function DashboardLayout({
  children,
}: LayoutProps<"/[lang]/admin/dashboard">) {
  const { t } = await getI18n();
  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <Sidebar
        footer={
          <Suspense fallback={<Skeleton className="h-14 bg-white/10" />}>
            <AdminBadge />
          </Suspense>
        }
      />
      <div className="font-ui min-w-0 flex-1">
        <div className="flex items-center justify-end gap-3 px-4 pt-4 sm:px-8">
          <LocaleLink href="/" className="text-muted hover:text-primary text-sm">
            {t.admin.publicSite}
          </LocaleLink>
          <NotificationBell />
        </div>
        <main className="px-4 pt-2 pb-12 sm:px-8">{children}</main>
      </div>
    </div>
  );
}
