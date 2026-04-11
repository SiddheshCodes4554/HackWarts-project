import { type NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  // Auth is managed client-side through Supabase session state in UserContext.
  // Do not enforce cookie-based redirects here, because browser-session auth
  // may not be available to edge middleware as cookies.
  void request;
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
