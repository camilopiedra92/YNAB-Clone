/**
 * GET /api/docs — serves the OpenAPI JSON spec (dev only).
 */
import { NextResponse } from 'next/server';
import { getOpenAPIDocument } from '@/lib/openapi/generator';
import { apiError } from '@/lib/api-error';
import { logger } from '@/lib/logger';

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return apiError('Not available in production', 404);
  }

  try {
    const doc = getOpenAPIDocument();
    return NextResponse.json(doc, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    logger.error('Failed to generate OpenAPI spec', error);
    return apiError('Failed to generate OpenAPI spec', 500);
  }
}
