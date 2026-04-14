'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Leaf, Sparkles, Target, Workflow } from 'lucide-react';
import { motion } from 'framer-motion';
import { useUser } from '@/context/UserContext';

const features = [
  {
    title: 'Crop Analysis',
    description: 'Scan a leaf, get the likely issue, and see treatment steps you can act on today.',
    icon: Leaf,
  },
  {
    title: 'Market Insights',
    description: 'See whether to sell or hold with simple price signals and nearby mandi direction.',
    icon: Target,
  },
  {
    title: 'AI Decisions',
    description: 'Rain, soil, and market signals are combined into one daily action brief.',
    icon: Workflow,
  },
];

const proofPoints = [
  'Weather-aware irrigation guidance',
  'Market timing recommendations',
  'Soil risk and fertilizer actions',
];

export default function LandingPage() {
  const router = useRouter();
  const { user, profile, profileStatus, loading } = useUser();
  const roleSource =
    (typeof profile?.role === 'string' && profile.role) ||
    (typeof profile?.user_type === 'string' && profile.user_type) ||
    (typeof profile?.account_type === 'string' && profile.account_type) ||
    (typeof user?.user_metadata?.role === 'string' && user.user_metadata.role) ||
    'farmer';
  const isBuyer = String(roleSource).toLowerCase() === 'buyer';
  const waitingForAuthBootstrap = loading || (Boolean(user) && profileStatus === 'loading');

  useEffect(() => {
    if (waitingForAuthBootstrap) {
      return;
    }

    if (!user) {
      return;
    }

    if (profileStatus === 'missing') {
      router.replace('/onboarding');
      return;
    }

    router.replace(isBuyer ? '/bidding-dashboard' : '/home');
  }, [isBuyer, profileStatus, router, user, waitingForAuthBootstrap]);

  if (waitingForAuthBootstrap || user) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(34,197,94,0.14),transparent_35%),linear-gradient(180deg,#f8fff6_0%,#eff8f0_45%,#f7fbf8_100%)] text-slate-900">
        <div className="flex min-h-screen items-center justify-center px-4">
          <div className="rounded-3xl border border-white/70 bg-white/80 px-5 py-4 text-sm font-medium text-slate-700 shadow-sm backdrop-blur">
            Loading your farm workspace...
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(34,197,94,0.14),transparent_35%),linear-gradient(180deg,#f8fff6_0%,#eff8f0_45%,#f7fbf8_100%)] text-slate-900">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between rounded-3xl border border-white/70 bg-white/70 px-4 py-3 backdrop-blur-md shadow-sm sm:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700">FarmEase</p>
            <p className="text-sm text-slate-600">AI farming decisions, not dashboards</p>
          </div>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
          >
            Start Farming Smarter <ArrowRight className="h-4 w-4" />
          </Link>
        </header>

        <section className="grid flex-1 items-center gap-10 py-10 lg:grid-cols-[1.05fr_0.95fr] lg:py-16">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-white px-4 py-2 text-sm font-semibold text-emerald-700 shadow-sm">
              <Sparkles className="h-4 w-4" />
              Your AI Farm Assistant
            </div>

            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45 }}
              className="mt-6 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl lg:text-6xl"
            >
              Get real-time decisions,
              <span className="text-emerald-700"> not just data.</span>
            </motion.h1>

            <p className="mt-6 max-w-xl text-base leading-8 text-slate-600 sm:text-lg">
              FarmEase combines weather, soil, and market signals into one clear action brief so you know what to do today.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/register"
                className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-700"
              >
                Get Started <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
              >
                OTP Login
              </Link>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {proofPoints.map((item) => (
                <div key={item} className="rounded-2xl border border-white/80 bg-white/80 p-4 text-sm font-medium text-slate-700 shadow-sm">
                  {item}
                </div>
              ))}
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.05 }}
            className="rounded-4xl border border-white/70 bg-white/85 p-5 shadow-[0_30px_80px_rgba(22,163,74,0.08)] backdrop-blur-xl sm:p-6"
          >
            <div className="rounded-3xl bg-emerald-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">Today&apos;s focus</p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-900">What should I do today?</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                One brief replaces crowded charts and scattered alerts.
              </p>
            </div>

            <div className="mt-5 space-y-3">
              {features.map((feature, index) => {
                const Icon = feature.icon;

                return (
                  <motion.article
                    key={feature.title}
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.25, delay: 0.08 * index }}
                    className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-start gap-3">
                      <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900">{feature.title}</h3>
                        <p className="mt-1 text-sm leading-6 text-slate-600">{feature.description}</p>
                      </div>
                    </div>
                  </motion.article>
                );
              })}
            </div>
          </motion.div>
        </section>
      </div>
    </main>
  );
}