import type { Metadata } from "next";
import { getSiteUrl } from "@/lib/site-url";
import LanguageRuntime from "./LanguageRuntime";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: "BACKSTAGE | عروض وتجارب مسرحية",
    template: "%s | BACKSTAGE",
  },
  description: "اكتشف عروض BACKSTAGE المسرحية، تعرّف على فريق العمل واحجز تذكرتك لتجربة فنية حيّة.",
  applicationName: "BACKSTAGE",
  manifest: "/manifest.webmanifest",
  keywords: ["BACKSTAGE", "مسرح", "عروض مسرحية", "حجز تذاكر", "مصر"],
  alternates: { canonical: "/" },
  icons: { icon: [{ url: "/icon.svg", type: "image/svg+xml" }] },
  openGraph: {
    type: "website",
    locale: "ar_EG",
    siteName: "BACKSTAGE",
    title: "BACKSTAGE | عروض وتجارب مسرحية",
    description: "اكتشف عروض BACKSTAGE المسرحية واحجز تذكرتك لتجربة فنية حيّة.",
    url: "/",
    images: [{ url: "/backstage.jpg", alt: "أجواء مسرح BACKSTAGE" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "BACKSTAGE | عروض وتجارب مسرحية",
    description: "اكتشف العروض المسرحية القادمة واحجز تذكرتك.",
    images: ["/backstage.jpg"],
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl">
      <body>
        <LanguageRuntime />
        {children}
      </body>
    </html>
  );
}
