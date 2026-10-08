import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Crimson_Text, Inter } from "next/font/google";
import { I18nProvider } from "@/i18n/client";
import { getI18n } from "@/i18n/server";
import { locales } from "@/i18n";
import "../globals.css";

// Brand typography: Cormorant Garamond (headings), Crimson Text (body), Inter (UI).
const cormorant = Cormorant_Garamond({ variable: "--font-cormorant", subsets: ["latin"], weight: ["500", "600", "700"], style: ["normal", "italic"] });
const crimson = Crimson_Text({ variable: "--font-crimson", subsets: ["latin"], weight: ["400", "600"], style: ["normal", "italic"] });
const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

/** Public origin: APP_URL, else the Vercel production domain, else localhost. */
function siteUrl(): string {
  if (process.env.APP_URL) return process.env.APP_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return "http://localhost:3000";
}

/** Both languages are prerendered; the locale is a root param (`next/root-params`). */
export async function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function generateMetadata(): Promise<Metadata> {
  const { t, lang } = await getI18n();
  return {
    // Share previews (WhatsApp, iMessage, LinkedIn…) need absolute image URLs.
    metadataBase: new URL(siteUrl()),
    title: { default: t.meta.title, template: t.meta.titleTemplate },
    description: t.meta.description,
    alternates: { canonical: `/${lang}`, languages: Object.fromEntries(locales.map((l) => [l, `/${l}`])) },
    // The images come from the opengraph-image / twitter-image files in this folder;
    // icons from favicon.ico, icon.svg and apple-icon.png in src/app.
    openGraph: {
      type: "website",
      siteName: "Accanto",
      title: t.meta.title,
      description: t.meta.description,
      url: `/${lang}`,
      locale: lang === "it" ? "it_IT" : "en_GB",
      alternateLocale: lang === "it" ? ["en_GB"] : ["it_IT"],
    },
    twitter: { card: "summary_large_image", title: t.meta.title, description: t.meta.description },
  };
}

export const viewport: Viewport = {
  themeColor: "#1b4965",
};

export default async function RootLayout({ children }: LayoutProps<"/[lang]">) {
  const { lang, t } = await getI18n();
  return (
    <html lang={lang} className={`${cormorant.variable} ${crimson.variable} ${inter.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <I18nProvider lang={lang} t={t}>
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
