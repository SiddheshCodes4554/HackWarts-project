'use client';

import { useUser } from '@/context/UserContext';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  Bot,
  Gavel,
  LayoutDashboard,
  LineChart,
  LogOut,
  Menu,
  Store,
  Sprout,
  UserCircle2,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { LocationUpdateToast } from '@/components/LocationUpdateToast';

const BUYER_ALLOWED_ROUTES = ['/bidding-dashboard', '/assistant', '/marketplace', '/profile'];
const BUYER_NAV_ITEMS = [
  { href: '/bidding-dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/assistant', label: 'Assistant', icon: Bot },
  { href: '/marketplace', label: 'Marketplace', icon: Store },
  { href: '/profile', label: 'Profile', icon: UserCircle2 },
];
const FARMER_NAV_ITEMS = [
  { href: '/home', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/assistant', label: 'Assistant', icon: Bot },
  { href: '/market', label: 'Market', icon: LineChart },
  { href: '/crop-advisory', label: 'Advisory', icon: Sprout },
  { href: '/finance', label: 'Finance', icon: Wallet },
  { href: '/community', label: 'Community', icon: Users },
  { href: '/marketplace', label: 'Marketplace', icon: Store },
  { href: '/profile', label: 'Profile', icon: UserCircle2 },
];

function matchesPath(pathname: string, href: string): boolean {
  if (href === '/home') {
    return pathname === '/' || pathname === '/home';
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function pageTitle(pathname: string): string {
  if (pathname === '/' || pathname === '/home') return 'Dashboard';
  if (pathname.startsWith('/assistant')) return 'AI Assistant';
  if (pathname.startsWith('/market')) return 'Market';
  if (pathname.startsWith('/crop-advisory')) return 'Crop Advisory';
  if (pathname.startsWith('/finance')) return 'Finance';
  if (pathname.startsWith('/community')) return 'Community';
  if (pathname.startsWith('/marketplace')) return 'Marketplace';
  if (pathname.startsWith('/bidding-dashboard')) return 'Bidding Dashboard';
  if (pathname.startsWith('/profile')) return 'Profile';
  return 'FarmEase';
}

export default function RootLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, profile, profileStatus, loading } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const roleSource =
    (typeof profile?.role === 'string' && profile.role) ||
    (typeof profile?.user_type === 'string' && profile.user_type) ||
    (typeof profile?.account_type === 'string' && profile.account_type) ||
    (typeof user?.user_metadata?.role === 'string' && user.user_metadata.role) ||
    'farmer';
  const normalizedRole = String(roleSource).toLowerCase();
  const isBuyer = normalizedRole === 'buyer';
  const navItems = isBuyer ? BUYER_NAV_ITEMS : FARMER_NAV_ITEMS;

  // Don't show navbar on auth pages
  const isAuthPage = pathname?.includes('/login') || pathname?.includes('/register') || pathname?.includes('/onboarding');

  useEffect(() => {
    if (loading || !pathname) {
      return;
    }

    const isLogin = pathname === '/login';
    const isOnboarding = pathname === '/onboarding';
    const isRegister = pathname === '/register';
    const isPublicAuthRoute = isLogin || isOnboarding || isRegister;

    // Logged-in users should not reach login/register.
    if (user && (isLogin || isRegister)) {
      router.replace(profileStatus === 'ready' && profile ? (isBuyer ? '/bidding-dashboard' : '/home') : '/home');
      return;
    }

    // Onboarding is only for users without completed profile.
    if (user && profileStatus === 'ready' && profile && isOnboarding) {
      router.replace(isBuyer ? '/bidding-dashboard' : '/home');
      return;
    }

    // Non-authenticated users should stay on auth routes only.
    if (!user && !isPublicAuthRoute && pathname !== '/') {
      router.replace('/login');
      return;
    }

    // Anonymous users should be able to stay on the landing page.
    if (!user && pathname === '/') {
      return;
    }

    // Authenticated users landing on the home page should be routed into the app.
    if (user && pathname === '/') {
      if (profileStatus === 'missing') {
        router.replace('/onboarding');
      } else if (profileStatus === 'ready' && profile) {
        router.replace(isBuyer ? '/bidding-dashboard' : '/home');
      }
      return;
    }

    // Authenticated users without profile should complete onboarding first.
    if (user && profileStatus === 'missing' && !isOnboarding && !isLogin && !isRegister && pathname !== '/') {
      router.replace('/onboarding');
      return;
    }

    // Buyers should only access routes that are part of the buyer navigation experience.
    if (
      user &&
      profileStatus === 'ready' &&
      profile &&
      isBuyer &&
      !isPublicAuthRoute &&
      pathname !== '/' &&
      !BUYER_ALLOWED_ROUTES.some((allowedRoute) => matchesPath(pathname, allowedRoute))
    ) {
      router.replace('/bidding-dashboard');
    }
  }, [isBuyer, loading, pathname, profile, profileStatus, router, user]);

  const handleLogout = async () => {
    try {
      const { supabase } = await import('@/lib/supabaseClient');
      await supabase.auth.signOut();
      router.replace('/login');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  if (isAuthPage) {
    return <>{children}</>;
  }

  const title = pageTitle(pathname ?? '/');

  const renderNav = (compact = false) => (
    <nav className="space-y-1">
      {navItems.map((item) => {
        const Icon = item.icon;
        const active = matchesPath(pathname ?? '', item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setDrawerOpen(false)}
            className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
              active
                ? 'bg-emerald-100 text-emerald-900'
                : 'text-slate-600 hover:bg-emerald-50 hover:text-emerald-800'
            } ${compact ? '' : ''}`}
          >
            <Icon className="h-4 w-4" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      {user && (
        <div className="min-h-screen bg-[#edf6ea] text-slate-900">
          <div className="mx-auto flex min-h-screen max-w-370">
            <aside className="hidden w-64 border-r border-emerald-100 bg-[#f7fbf5] p-4 lg:flex lg:flex-col">
              <Link href={isBuyer ? '/bidding-dashboard' : '/home'} className="mb-5 flex items-center gap-2 px-2">
                <div className="h-8 w-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <Sprout className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-emerald-900">FarmEase</p>
                  <p className="text-[11px] text-slate-500">Agri Control Panel</p>
                </div>
              </Link>

              {renderNav()}

              <div className="mt-auto rounded-xl border border-emerald-100 bg-white p-3">
                <p className="text-xs font-semibold text-slate-700">{profile?.name || user.email}</p>
                <p className="text-[11px] text-slate-500">{profile?.location_name || 'India'}</p>
                <button
                  onClick={handleLogout}
                  className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Logout
                </button>
              </div>
            </aside>

            <div className="flex min-w-0 flex-1 flex-col">
              <header className="sticky top-0 z-30 border-b border-emerald-100 bg-[#edf6ea]/95 px-4 py-3 backdrop-blur md:px-6">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setDrawerOpen((prev) => !prev)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-200 bg-white text-slate-700 lg:hidden"
                    >
                      {drawerOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
                    </button>
                    <h1 className="text-lg font-semibold text-slate-900 md:text-xl">{title}</h1>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="hidden rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-semibold text-emerald-800 sm:inline-flex">
                      {isBuyer ? 'Buyer Account' : 'Farmer Account'}
                    </span>
                    <Link
                      href="/profile"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-emerald-200 bg-white text-slate-700"
                      title="Profile"
                    >
                      <UserCircle2 className="h-4 w-4" />
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-rose-100 bg-rose-50 text-rose-700"
                      title="Logout"
                    >
                      <LogOut className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {drawerOpen && (
                  <div className="mt-3 rounded-xl border border-emerald-100 bg-white p-3 lg:hidden">
                    <div className="mb-2 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
                      <Gavel className="h-3.5 w-3.5" />
                      Quick Navigation
                    </div>
                    {renderNav(true)}
                  </div>
                )}
              </header>

              <main className="min-w-0 flex-1 px-3 py-4 md:px-6 md:py-6">{children}</main>
            </div>
          </div>
        </div>
      )}

      {!user ? children : null}
      <LocationUpdateToast />
    </>
  );
}
