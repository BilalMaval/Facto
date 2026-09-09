import type { Metadata } from "next";
import { Geist, Geist_Mono, Noto_Sans_Arabic } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Covers Urdu — Urdu is written in an extended Arabic script, and this repo
// deliberately picked the Naskh style (compact, upright) over the more
// traditional Nastaliq calligraphic style, since Nastaliq's diagonal
// letterforms need much taller line-heights and don't compress well inside
// this app's dense tables (the payslip line items, attendance grid, etc.).
const notoSansArabic = Noto_Sans_Arabic({
  variable: "--font-noto-sans-arabic",
  subsets: ["arabic"],
});

export const metadata: Metadata = {
  title: "Factory Salary Slip",
  description: "Weekly salary slips for contractual and piece-rate factory workers",
};

const RTL_LOCALES = new Set(["ur"]);

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();
  const dir = RTL_LOCALES.has(locale) ? "rtl" : "ltr";

  return (
    <html
      lang={locale}
      dir={dir}
      className={`${geistSans.variable} ${geistMono.variable} ${notoSansArabic.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
