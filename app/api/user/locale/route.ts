import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { logger } from '@/lib/logger';
import { apiError } from '@/lib/api-error';
import { requireAuth } from '@/lib/auth-helpers';
import { updateLocale } from '@/lib/repos';

const VALID_LOCALES = ['es', 'en'] as const;

export async function PATCH(request: Request) {
  try {
    const authResult = await requireAuth();
    if (!authResult.ok) return authResult.response;

    const body = await request.json();
    const { locale } = body;

    if (!locale || !VALID_LOCALES.includes(locale)) {
      return apiError(`Invalid locale. Supported: ${VALID_LOCALES.join(', ')}`, 400);
    }

    const updated = await updateLocale(authResult.userId, locale);
    if (!updated) return apiError('User not found', 404);

    // Set NEXT_LOCALE cookie for server-side locale resolution
    const cookieStore = await cookies();
    cookieStore.set('NEXT_LOCALE', locale, {
      path: '/',
      maxAge: 365 * 24 * 60 * 60, // 1 year
      sameSite: 'lax',
      httpOnly: false, // needs to be readable by middleware
    });

    return NextResponse.json({ locale: updated.locale });
  } catch (error) {
    logger.error('Error updating locale:', error);
    return apiError('Error updating locale', 500);
  }
}
