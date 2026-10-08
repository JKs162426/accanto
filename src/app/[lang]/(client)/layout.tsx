import SiteShell from "@/components/common/SiteShell";

export default function ClientLayout({ children }: LayoutProps<"/[lang]">) {
  return <SiteShell>{children}</SiteShell>;
}
