import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';
import { locales, defaultLocale, isValidLocale } from '@/lib/i18n/config';

// Re-export for backward compatibility — some files import from here.
export { locales, defaultLocale };
export type { AppLocale as Locale } from '@/lib/i18n/config';

export default getRequestConfig(async () => {
  // 1. Check cookie (set by user preference in ProfileModal)
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get('NEXT_LOCALE')?.value;
  if (cookieLocale && isValidLocale(cookieLocale)) {
    return {
      locale: cookieLocale,
      messages: (await import(`../messages/${cookieLocale}.json`)).default,
    };
  }

  // 2. Fallback to default locale
  return {
    locale: defaultLocale,
    messages: (await import(`../messages/${defaultLocale}.json`)).default,
  };
});
