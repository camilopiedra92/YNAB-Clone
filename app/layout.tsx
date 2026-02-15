import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";
import ClientShell from "@/components/ClientShell";
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages, getTranslations } from 'next-intl/server';
import { toIntlLocale } from '@/lib/i18n/config';

const manrope = Manrope({
  subsets: ["latin"],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-manrope',
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('meta');
  return {
    title: t('title'),
    description: t('description'),
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={toIntlLocale(locale)} className="dark">
      <body className={`${manrope.className} selection:bg-primary/50 selection:text-white`} suppressHydrationWarning>
        <a href="#main-content" className="skip-to-content">
          {(messages as Record<string, Record<string, string>>).meta?.skipToContent ?? 'Skip to main content'}
        </a>
        <NextIntlClientProvider messages={messages}>
          <ClientShell>
            {children}
          </ClientShell>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
