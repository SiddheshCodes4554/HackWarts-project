'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { sendEmailOtp, verifyEmailOtp } from '@/lib/authFlow';

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [name, setName] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [accountRole, setAccountRole] = useState<'farmer' | 'buyer'>('farmer');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

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

  const handleSendOtp = async () => {
    setError(null);
    setSuccessMessage(null);

    const now = Date.now();
    if (loading || now < cooldownUntil) {
      return;
    }

    setLoading(true);

    try {
      const result = await sendEmailOtp(email);

      if (!result.ok) {
        if (result.retryAfterSeconds && result.retryAfterSeconds > 0) {
          const waitMs = result.retryAfterSeconds * 1000;
          setCooldownUntil(Date.now() + waitMs);
          setCooldownSeconds(result.retryAfterSeconds);
        }
        setError(result.message);
        return;
      }

      setOtpSent(true);
      setCooldownUntil(Date.now() + 30000);
      setCooldownSeconds(30);
      setSuccessMessage('OTP sent to your email.');
    } catch {
      setError('Unable to send OTP right now. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!otp.trim()) {
      setError('Please enter OTP.');
      return;
    }

    setLoading(true);

    try {
      const result = await verifyEmailOtp({
        email,
        otp,
        role: accountRole,
        name,
      });

      if (!result.ok) {
        setError(result.message);
        return;
      }

      const metadataRole = typeof result.user?.user_metadata?.role === 'string'
        ? result.user.user_metadata.role.toLowerCase()
        : '';

      if (metadataRole && metadataRole !== accountRole) {
        await supabase.auth.signOut();
        setError(`This account is registered as ${metadataRole}. Please switch role and continue.`);
        return;
      }

      setSuccessMessage('Account verified successfully. Redirecting...');
      router.push('/');
    } catch {
      setError('Unable to authenticate right now. Please try again.');
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
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
              Name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
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

          <div className="space-y-2">
            <button
              type="button"
              onClick={handleSendOtp}
              disabled={loading || cooldownSeconds > 0 || !email.trim()}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {cooldownSeconds > 0 ? `Resend in ${cooldownSeconds}s` : otpSent ? 'Resend OTP' : 'Send OTP'}
            </button>
          </div>

          <div>
            <label htmlFor="otp" className="block text-sm font-medium text-gray-700 mb-2">
              OTP Code
            </label>
            <input
              id="otp"
              type="text"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="6-digit OTP"
              required
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>

          <button
            type="submit"
            disabled={loading || cooldownSeconds > 0}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Processing...' : 'Verify OTP & Continue'}
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
