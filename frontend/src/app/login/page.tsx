'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { loginOrSignup } from '@/lib/authFlow';
import { useUser } from '@/context/UserContext';

export default function LoginPage() {
  const router = useRouter();
  const { user, profile, profileStatus, loading: userLoading } = useUser();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [accountRole, setAccountRole] = useState<'farmer' | 'buyer'>('farmer');
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const roleSource =
    (typeof profile?.role === 'string' && profile.role) ||
    (typeof profile?.user_type === 'string' && profile.user_type) ||
    (typeof profile?.account_type === 'string' && profile.account_type) ||
    (typeof user?.user_metadata?.role === 'string' && user.user_metadata.role) ||
    accountRole;
  const isBuyer = String(roleSource).toLowerCase() === 'buyer';

  useEffect(() => {
    if (cooldownUntil <= 0) {
      return;
    }

    const timer = window.setInterval(() => {
      const remainingMs = Math.max(0, cooldownUntil - Date.now());
      setCooldownSeconds(Math.ceil(remainingMs / 1000));
      if (remainingMs <= 0) {
        setCooldownUntil(0);
      }
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [cooldownUntil]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const emailFromQuery = params.get('email')?.trim() ?? '';
    const fromRegister = params.get('from') === 'register';

    if (emailFromQuery && !email) {
      setEmail(emailFromQuery);
    }

    if (fromRegister && !error) {
      setError('Signup is temporarily rate-limited or the account already exists. Please sign in to continue.');
    }
  }, [email, error]);

  useEffect(() => {
    if (userLoading) {
      return;
    }

    if (user) {
      if (profileStatus === 'missing') {
        router.replace('/onboarding');
        return;
      }

      if (profileStatus === 'ready' && profile) {
        router.replace(isBuyer ? '/bidding-dashboard' : '/home');
      }
    }
  }, [isBuyer, user, profile, profileStatus, userLoading, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const now = Date.now();
    if (loading || now < cooldownUntil) {
      return;
    }

    setError(null);
    setSuccessMessage(null);
    setLoading(true);
    setCooldownUntil(now + 2000);
    setCooldownSeconds(2);

    try {
      const result = await loginOrSignup(email, password, accountRole);

      if (!result.ok) {
        setError(result.message);
        return;
      }

      const metadataRole = typeof result.user?.user_metadata?.role === 'string'
          ? result.user.user_metadata.role.toLowerCase()
          : '';

      if (metadataRole && metadataRole !== accountRole) {
        await supabase.auth.signOut();
        setError(`This account is registered as ${metadataRole}. Please choose ${metadataRole} login.`);
        return;
      }

      setSuccessMessage(result.mode === 'signup' ? 'Account created successfully. Redirecting...' : 'Signed in successfully. Redirecting...');
      router.replace('/');
    } catch (err) {
      setError('Unable to authenticate right now. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-green-50 to-blue-50 flex items-center justify-center px-4 py-8">
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

        {successMessage && (
          <div className="mb-6 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
            {successMessage}
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
            disabled={loading || cooldownSeconds > 0}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Processing...' : cooldownSeconds > 0 ? `Please wait ${cooldownSeconds}s` : 'Continue'}
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
