import type { ReactNode } from "react";
import Header from "./Header";
import Footer from "./Footer";

/** Public/client chrome: header, centred content, footer. */
export default function SiteShell({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <>
      <Header />
      <main className={wide ? "flex-1" : "mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-12"}>{children}</main>
      <Footer />
    </>
  );
}
