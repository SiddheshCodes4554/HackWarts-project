import { type NextRequest, NextResponse } from 'next/server';

const PUBLIC_ROUTES = ['/login', '/register'];
const AUTH_ROUTES = ['/login', '/register', '/onboarding'];

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  
  // Check if there's a Supabase session token in cookies
  // Supabase stores session in different cookies depending on configuration
  const hasSession =
    request.cookies.has('sb-access-token') ||
    request.cookies.has('sb-auth-token') ||
    request.cookies.get('sb')?.value;
  
  // If user is on root path, let the page.tsx client component handle routing
  if (pathname === '/') {
    return NextResponse.next();
  }
  
  // If user is trying to access auth routes and is already authenticated, redirect to home
  if (AUTH_ROUTES.includes(pathname) && hasSession) {
    return NextResponse.redirect(new URL('/home', request.url));
  }
  
  // If user is trying to access protected routes without auth, redirect to login
  if (!PUBLIC_ROUTES.includes(pathname) && !hasSession && pathname !== '/') {
    return NextResponse.redirect(new URL('/login', request.url));
  }

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
