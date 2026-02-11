/**
 * GET /api/docs — serves the OpenAPI JSON spec (dev only).
 */
import { NextResponse } from 'next/server';
import { getOpenAPIDocument } from '@/lib/openapi/generator';

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 404 });
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
    console.error('Error generating OpenAPI spec:', error);
    return NextResponse.json(
      { error: 'Failed to generate OpenAPI spec' },
      { status: 500 }
    );
  }
}
