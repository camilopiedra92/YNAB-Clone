/**
 * Next.js 16 Proxy — Route Protection
 *
 * Lightweight session-cookie check that redirects unauthenticated users
 * to /auth/login. No DB calls — full session validation happens in API routes.
 *
 * In Next.js 16, middleware.ts was renamed to proxy.ts.
 * The exported function is called `proxy` (not `middleware`).
 */
import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function proxy(request: NextRequest) {
  const session = await auth();

  if (!session) {
    // Use the request URL's origin so it works on any port (dev :3000, test :3001, prod)
    const loginUrl = new URL('/auth/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!auth|api/auth|_next|favicon).*)'],
};
