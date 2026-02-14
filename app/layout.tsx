import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import ClientShell from "@/components/ClientShell";
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages, getTranslations } from 'next-intl/server';
import { toIntlLocale } from '@/lib/i18n/config';

const inter = Inter({ subsets: ["latin"] });

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
    <html lang={toIntlLocale(locale)}>
      <body className={inter.className} suppressHydrationWarning>
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
