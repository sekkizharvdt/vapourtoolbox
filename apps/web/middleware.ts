import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * CSRF Protection Middleware
 * Validates CSRF tokens on state-changing operations
 *
 * For production, consider additional security measures:
 * - SameSite cookie attributes (Strict)
 * - Signed tokens with secret key
 * - Token rotation
 */
export function middleware(request: NextRequest) {
  // Only check CSRF on state-changing methods
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method)) {
    const csrfTokenHeader = request.headers.get('x-csrf-token');
    const csrfTokenCookie = request.cookies.get('csrf-token')?.value;

    // Validate CSRF token
    if (!csrfTokenHeader || !csrfTokenCookie || csrfTokenHeader !== csrfTokenCookie) {
      console.warn('CSRF validation failed:', {
        method: request.method,
        path: request.nextUrl.pathname,
        hasHeader: !!csrfTokenHeader,
        hasCookie: !!csrfTokenCookie,
        match: csrfTokenHeader === csrfTokenCookie,
      });

      return new NextResponse('CSRF token validation failed', {
        status: 403,
        statusText: 'Forbidden',
      });
    }
  }

  // Set security headers
  const response = NextResponse.next();

  // Set CSP headers
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://www.gstatic.com https://www.googleapis.com; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "font-src 'self' https://fonts.gstatic.com; " +
    "img-src 'self' data: https:; " +
    "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://*.cloudfunctions.net"
  );

  // Other security headers
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  return response;
}

// Configure which routes the middleware runs on
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
