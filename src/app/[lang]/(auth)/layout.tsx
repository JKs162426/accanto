import SiteShell from "@/components/common/SiteShell";

export default function AuthLayout({ children }: LayoutProps<"/[lang]">) {
  return (
    <SiteShell>
      <div className="mx-auto w-full max-w-md">{children}</div>
    </SiteShell>
  );
}
