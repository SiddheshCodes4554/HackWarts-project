'use client';

import { useUser } from '@/context/UserContext';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { LogOut, User, Menu, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { LocationUpdateToast } from '@/components/LocationUpdateToast';

const BUYER_ALLOWED_ROUTES = new Set(['/bidding-dashboard', '/profile', '/(tabs)/profile']);

export default function RootLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, profile, loading } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const roleSource =
    (typeof profile?.role === 'string' && profile.role) ||
    (typeof profile?.user_type === 'string' && profile.user_type) ||
    (typeof profile?.account_type === 'string' && profile.account_type) ||
    (typeof user?.user_metadata?.role === 'string' && user.user_metadata.role) ||
    'farmer';
  const normalizedRole = String(roleSource).toLowerCase();
  const isBuyer = normalizedRole === 'buyer';

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
      router.replace(profile ? (isBuyer ? '/bidding-dashboard' : '/home') : '/onboarding');
      return;
    }

    // Onboarding is only for users without completed profile.
    if (user && profile && isOnboarding) {
      router.replace(isBuyer ? '/bidding-dashboard' : '/home');
      return;
    }

    // Non-authenticated users should stay on auth routes only.
    if (!user && !isPublicAuthRoute && pathname !== '/') {
      router.replace('/login');
      return;
    }

    // Authenticated users without profile should complete onboarding first.
    if (user && !profile && !isOnboarding && !isLogin && !isRegister && pathname !== '/') {
      router.replace('/onboarding');
      return;
    }

    // Buyers should only access bidding dashboard and profile screens.
    if (user && profile && isBuyer && !isPublicAuthRoute && pathname !== '/' && !BUYER_ALLOWED_ROUTES.has(pathname)) {
      router.replace('/bidding-dashboard');
    }
  }, [isBuyer, loading, pathname, profile, router, user]);

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

  return (
    <>
      {/* Navigation */}
      {user && (
        <nav className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              {/* Logo/Home */}
              <Link href="/" className="text-2xl font-bold text-green-600">
                FarmEase 🌾
              </Link>

              {/* Desktop Menu */}
              <div className="hidden md:flex items-center gap-8">
                {isBuyer && (
                  <Link
                    href="/bidding-dashboard"
                    className={`font-medium transition-colors ${
                      pathname === '/bidding-dashboard'
                        ? 'text-green-600'
                        : 'text-gray-600 hover:text-green-600'
                    }`}
                  >
                    Bidding Dashboard
                  </Link>
                )}
                {!isBuyer && (
                  <>
                    <Link
                      href="/"
                      className={`font-medium transition-colors ${
                        pathname === '/'
                          ? 'text-green-600'
                          : 'text-gray-600 hover:text-green-600'
                      }`}
                    >
                      Dashboard
                    </Link>
                    <Link
                      href="/crop-advisory"
                      className={`font-medium transition-colors ${
                        pathname === '/crop-advisory'
                          ? 'text-green-600'
                          : 'text-gray-600 hover:text-green-600'
                      }`}
                    >
                      Crop Advisory
                    </Link>
                    <Link
                      href="/weather"
                      className={`font-medium transition-colors ${
                        pathname === '/weather'
                          ? 'text-green-600'
                          : 'text-gray-600 hover:text-green-600'
                      }`}
                    >
                      Weather
                    </Link>
                    <Link
                      href="/finance"
                      className={`font-medium transition-colors ${
                        pathname === '/finance'
                          ? 'text-green-600'
                          : 'text-gray-600 hover:text-green-600'
                      }`}
                    >
                      Finance
                    </Link>
                    <Link
                      href="/community"
                      className={`font-medium transition-colors ${
                        pathname === '/community'
                          ? 'text-green-600'
                          : 'text-gray-600 hover:text-green-600'
                      }`}
                    >
                      Community
                    </Link>
                    <Link
                      href="/marketplace"
                      className={`font-medium transition-colors ${
                        pathname === '/marketplace'
                          ? 'text-green-600'
                          : 'text-gray-600 hover:text-green-600'
                      }`}
                    >
                      Marketplace
                    </Link>
                  </>
                )}
              </div>

              {/* User Menu */}
              <div className="hidden md:flex items-center gap-4">
                <div className="text-right">
                  <p className="font-semibold text-gray-900">{profile?.name || user.email}</p>
                  <p className="text-sm text-gray-600">{profile?.primary_crop}</p>
                </div>
                <Link
                  href="/(tabs)/profile"
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  title="View Profile"
                >
                  <User className="w-5 h-5 text-gray-600" />
                </Link>
                <button
                  onClick={handleLogout}
                  className="p-2 hover:bg-red-50 rounded-lg transition-colors text-red-600"
                  title="Logout"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>

              {/* Mobile Menu Button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 hover:bg-gray-100 rounded-lg"
              >
                {mobileMenuOpen ? (
                  <X className="w-5 h-5" />
                ) : (
                  <Menu className="w-5 h-5" />
                )}
              </button>
            </div>

            {/* Mobile Menu */}
            {mobileMenuOpen && (
              <div className="md:hidden pb-4 space-y-2">
                {isBuyer && (
                  <Link
                    href="/bidding-dashboard"
                    className="block px-4 py-2 hover:bg-gray-100 rounded-lg"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Bidding Dashboard
                  </Link>
                )}
                {!isBuyer && (
                  <>
                    <Link
                      href="/"
                      className="block px-4 py-2 hover:bg-gray-100 rounded-lg"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Dashboard
                    </Link>
                    <Link
                      href="/crop-advisory"
                      className="block px-4 py-2 hover:bg-gray-100 rounded-lg"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Crop Advisory
                    </Link>
                    <Link
                      href="/weather"
                      className="block px-4 py-2 hover:bg-gray-100 rounded-lg"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Weather
                    </Link>
                    <Link
                      href="/finance"
                      className="block px-4 py-2 hover:bg-gray-100 rounded-lg"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Finance
                    </Link>
                    <Link
                      href="/community"
                      className="block px-4 py-2 hover:bg-gray-100 rounded-lg"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Community
                    </Link>
                    <Link
                      href="/marketplace"
                      className="block px-4 py-2 hover:bg-gray-100 rounded-lg"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Marketplace
                    </Link>
                  </>
                )}
                <Link
                  href="/(tabs)/profile"
                  className="block px-4 py-2 hover:bg-gray-100 rounded-lg"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Profile
                </Link>
                <button
                  onClick={() => {
                    handleLogout();
                    setMobileMenuOpen(false);
                  }}
                  className="w-full text-left px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg"
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </nav>
      )}

      {/* Main Content */}
      {children}
      <LocationUpdateToast />
    </>
  );
}
