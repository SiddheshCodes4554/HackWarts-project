'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { useUser } from '@/context/UserContext';

export default function LoginPage() {
  const router = useRouter();
  const { user, profile, loading: userLoading } = useUser();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [accountRole, setAccountRole] = useState<'farmer' | 'buyer'>('farmer');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const roleSource =
    (typeof profile?.role === 'string' && profile.role) ||
    (typeof profile?.user_type === 'string' && profile.user_type) ||
    (typeof profile?.account_type === 'string' && profile.account_type) ||
    (typeof user?.user_metadata?.role === 'string' && user.user_metadata.role) ||
    accountRole;
  const isBuyer = String(roleSource).toLowerCase() === 'buyer';

  useEffect(() => {
    if (userLoading) {
      return;
    }

    if (user) {
      router.replace(profile ? (isBuyer ? '/bidding-dashboard' : '/home') : '/onboarding');
    }
  }, [isBuyer, user, profile, userLoading, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { data, error: loginError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (loginError) {
        setError(loginError.message);
      } else {
        const metadataRole = typeof data.user?.user_metadata?.role === 'string'
          ? data.user.user_metadata.role.toLowerCase()
          : '';

        if (metadataRole && metadataRole !== accountRole) {
          await supabase.auth.signOut();
          setError(`This account is registered as ${metadataRole}. Please choose ${metadataRole} login.`);
          return;
        }

        router.replace('/');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome Back</h1>
          <p className="text-gray-600">Sign in to your FarmEase account</p>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <span className="block text-sm font-medium text-gray-700 mb-2">Login As</span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setAccountRole('farmer')}
                className={`rounded-lg border px-4 py-2 text-sm font-semibold transition-colors ${
                  accountRole === 'farmer'
                    ? 'border-green-600 bg-green-50 text-green-700'
                    : 'border-gray-300 text-gray-700 hover:border-green-300'
                }`}
              >
                Farmer
              </button>
              <button
                type="button"
                onClick={() => setAccountRole('buyer')}
                className={`rounded-lg border px-4 py-2 text-sm font-semibold transition-colors ${
                  accountRole === 'buyer'
                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                    : 'border-gray-300 text-gray-700 hover:border-blue-300'
                }`}
              >
                Buyer
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-gray-600">
            Don&apos;t have an account?{' '}
            <Link href="/register" className="text-green-600 hover:text-green-700 font-semibold">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
