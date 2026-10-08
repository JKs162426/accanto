import type { Metadata } from "next";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return {
    title: { default: t.meta.adminTitle, template: t.meta.adminTitleTemplate },
    robots: { index: false, follow: false },
  };
}

export default function AdminLayout({ children }: LayoutProps<"/[lang]/admin">) {
  return <div className="flex min-h-screen flex-col bg-background">{children}</div>;
}
