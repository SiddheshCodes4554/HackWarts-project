'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [accountRole, setAccountRole] = useState<'farmer' | 'buyer'>('farmer');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [retryAfterSeconds, setRetryAfterSeconds] = useState(0);

  useEffect(() => {
    if (retryAfterSeconds <= 0) {
      return;
    }

    const timer = window.setInterval(() => {
      setRetryAfterSeconds((current) => (current > 0 ? current - 1 : 0));
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [retryAfterSeconds]);

  const parseRetrySeconds = (message: string): number => {
    const matched = message.match(/(\d+)\s*seconds?/i);
    if (!matched) {
      return 60;
    }

    const parsed = Number(matched[1]);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 60;
  };

  const upsertInitialProfile = async (userId: string) => {
    await supabase.from('profiles').upsert(
      {
        id: userId,
        name: '',
        location_name: '',
        latitude: 0,
        longitude: 0,
        land_area: 0,
        primary_crop: '',
        language: 'English',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id', ignoreDuplicates: false },
    );
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (loading || retryAfterSeconds > 0) {
      return;
    }

    setLoading(true);

    // Validate passwords match
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    // Validate password strength
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      setLoading(false);
      return;
    }

    try {
      const normalizedEmail = email.trim().toLowerCase();
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          data: {
            role: accountRole,
          },
        },
      });

      if (signUpError) {
        const message = signUpError.message || 'Registration failed';
        const lowerMessage = message.toLowerCase();

        if (
          signUpError.status === 429 ||
          lowerMessage.includes('rate limit') ||
          lowerMessage.includes('over_email_send_rate_limit')
        ) {
          const { error: signInError } = await supabase.auth.signInWithPassword({
            email: normalizedEmail,
            password,
          });

          if (!signInError) {
            setSuccessMessage('Account already exists. Signed in successfully, redirecting...');
            setTimeout(() => {
              router.push('/');
            }, 900);
            return;
          }

          if ((signInError.message || '').toLowerCase().includes('email not confirmed')) {
            setError('Your account exists but email is not confirmed yet. Please check your inbox and confirm before signing in.');
            return;
          }

          const waitFor = parseRetrySeconds(message);
          setRetryAfterSeconds(waitFor);
          setError(`Too many signup attempts. Please wait ${waitFor}s before retrying, or sign in if your account already exists.`);
        } else if (lowerMessage.includes('already registered')) {
          setError('This email is already registered. Please sign in instead.');
        } else {
          setError(message);
        }
      } else if (data.user) {
        if (data.session) {
          await upsertInitialProfile(data.user.id);
          setSuccessMessage('Signup successful! Redirecting to onboarding...');
          setTimeout(() => {
            router.push('/onboarding');
          }, 1200);
        } else {
          setSuccessMessage('Account created. Check your email inbox to confirm your account, then sign in.');
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Join FarmEase</h1>
          <p className="text-gray-600">Create your account to get started</p>
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

        <form onSubmit={handleRegister} className="space-y-6">
          <div>
            <span className="block text-sm font-medium text-gray-700 mb-2">Register As</span>
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
              placeholder="At least 6 characters"
              required
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter password"
              required
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>

          <button
            type="submit"
            disabled={loading || retryAfterSeconds > 0}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading
              ? 'Creating Account...'
              : retryAfterSeconds > 0
                ? `Retry in ${retryAfterSeconds}s`
                : 'Create Account'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-gray-600">
            Already have an account?{' '}
            <Link href="/login" className="text-green-600 hover:text-green-700 font-semibold">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
