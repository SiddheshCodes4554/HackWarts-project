"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { motion } from "framer-motion";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowRight,
  BarChart3,
  CloudRain,
  DollarSign,
  Droplets,
  Leaf,
  Loader2,
  MapPin,
  Sprout,
  TrendingDown,
  TrendingUp,
  Wind,
} from "lucide-react";
import { LocationModal } from "../../../components/LocationModal";
import { useLocation } from "../../../context/LocationContext";
import { useUser } from "@/context/UserContext";

type DashboardPayload = {
  weather: {
    current: {
      temperature: number;
      humidity: number;
      windSpeed: number;
      rainProbability: number;
      icon: string;
      description: string;
    };
    forecast: Array<{
      label: string;
      temperature: number;
      rainProbability: number;
      humidity: number;
    }>;
  };
  soil: {
    ph: number;
    nitrogen: number;
    organicCarbon: number;
    soilType: string;
    recommendation: string;
    healthScore: number;
  };
  market: {
    markets: Array<{
      mandi: string;
      modalPrice: number;
      netProfit: number;
      distanceKm: number;
      district: string;
      state: string;
    }>;
    bestMarket: string;
    recommendation: string;
    signal: "SELL" | "HOLD";
    trend: Array<{
      date: string;
      price: number;
      arrivals: number;
    }>;
  };
  insights: string[];
};

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  ""
).replace(/\/$/, "");

const fetcher = async (url: string): Promise<DashboardPayload> => {
  const response = await fetch(url, { cache: "no-store" });
  const data = (await response.json().catch(() => ({}))) as DashboardPayload & { error?: string };

  if (!response.ok) {
    throw new Error(data.error ?? "Unable to load dashboard data");
  }

  return data;
};

const featureLinks = [
  {
    title: "Crop Help",
    description: "Disease diagnosis and treatment guidance.",
    href: "/crop-advisory",
    icon: Leaf,
  },
  {
    title: "Market Intelligence",
    description: "Top mandis and trend-aware pricing.",
    href: "/market",
    icon: BarChart3,
  },
  {
    title: "Finance",
    description: "Subsidies and scheme advisory.",
    href: "/finance",
    icon: DollarSign,
  },
  {
    title: "Weather",
    description: "Forecast and irrigation timing.",
    href: "/weather",
    icon: CloudRain,
  },
];

function formatCurrency(value: number): string {
  return `₹${Math.round(value).toLocaleString("en-IN")}`;
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function trendBadge(value: number): { label: string; color: string; Icon: typeof TrendingUp } {
  if (value >= 0) {
    return {
      label: `+${value.toFixed(1)}%`,
      color: "text-emerald-700 bg-emerald-50",
      Icon: TrendingUp,
    };
  }

  return {
    label: `${value.toFixed(1)}%`,
    color: "text-rose-700 bg-rose-50",
    Icon: TrendingDown,
  };
}

export default function HomePage() {
  const { latitude, longitude, placeName, isDetecting } = useLocation();
  const router = useRouter();
  const { user, profile, loading: userLoading } = useUser();
  const [locationModalOpen, setLocationModalOpen] = useState(false);

  const effectiveLatitude = profile?.latitude && profile.latitude !== 0 ? profile.latitude : latitude;
  const effectiveLongitude = profile?.longitude && profile.longitude !== 0 ? profile.longitude : longitude;
  const effectivePlaceName = profile?.location_name || placeName;

  useEffect(() => {
    if (!userLoading && (!user || !profile)) {
      router.push(user ? "/onboarding" : "/login");
    }
  }, [user, profile, userLoading, router]);

  const dashboardKey =
    Number.isFinite(effectiveLatitude) && Number.isFinite(effectiveLongitude)
      ? `${API_BASE_URL}/dashboard/data?latitude=${effectiveLatitude}&longitude=${effectiveLongitude}&placeName=${encodeURIComponent(effectivePlaceName || "")}`
      : null;

  const { data, error, isLoading, isValidating } = useSWR<DashboardPayload>(dashboardKey, fetcher, {
    refreshInterval: 10 * 60 * 1000,
    revalidateOnFocus: false,
    keepPreviousData: true,
  });

  useEffect(() => {
    if (!dashboardKey) {
      return;
    }

    console.log("[dashboard] refetch triggered", {
      lat: effectiveLatitude,
      lon: effectiveLongitude,
      place: effectivePlaceName,
      key: dashboardKey,
    });
  }, [dashboardKey, effectiveLatitude, effectiveLongitude, effectivePlaceName]);

  const overview = useMemo(() => {
    const avgMandiPrice = average(data?.market.markets.map((item) => item.modalPrice) ?? []);
    const latestTrend = data?.market.trend ?? [];
    const firstPrice = latestTrend[0]?.price ?? 0;
    const lastPrice = latestTrend[latestTrend.length - 1]?.price ?? 0;
    const marketTrendPct = firstPrice > 0 ? ((lastPrice - firstPrice) / firstPrice) * 100 : 0;

    return {
      activeCrop: profile?.primary_crop || "Not set",
      currentTemp: data?.weather.current.temperature ?? 0,
      avgMandiPrice,
      soilHealth: data?.soil.healthScore ?? 0,
      marketTrendPct,
    };
  }, [data, profile]);

  const marketBadge = trendBadge(overview.marketTrendPct);

  return (
    <main className="min-h-screen bg-[linear-gradient(150deg,#f2fbf4_0%,#eef9ff_45%,#f5fff7_100%)] px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 pb-10">
        <section className="rounded-[2rem] border border-emerald-200/70 bg-white/80 p-6 shadow-[0_30px_100px_rgba(22,163,74,0.09)] backdrop-blur-sm sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700">Farm Analytics Console</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Live decision dashboard for {profile?.name || "your farm"}</h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
                Real-time weather, soil and mandi intelligence with AI-generated recommendations for faster field decisions.
              </p>
            </div>

            <div className="rounded-3xl border border-emerald-100 bg-white px-4 py-3 text-sm font-semibold text-emerald-900 shadow-sm">
              <p className="text-xs uppercase tracking-[0.18em] text-emerald-700">Your Location</p>
              <p className="mt-1 inline-flex items-center gap-2 text-base">
                <MapPin className="h-4 w-4" />
                {isDetecting ? "Detecting..." : effectivePlaceName}
              </p>
              <button
                type="button"
                onClick={() => setLocationModalOpen(true)}
                className="mt-3 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-100"
              >
                Change Location
              </button>
            </div>
          </div>
        </section>

        {(isLoading || isValidating) && (
          <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-700">
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading live analytics...
            </span>
          </div>
        )}

        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {(error as Error).message}
          </div>
        ) : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            {
              title: "Active Crop",
              value: overview.activeCrop,
              trend: profile?.land_area ? `${profile.land_area} acres` : "Profile pending",
              icon: Leaf,
            },
            {
              title: "Current Weather",
              value: `${overview.currentTemp.toFixed(1)}°C`,
              trend: `${data?.weather.current.humidity ?? 0}% humidity`,
              icon: CloudRain,
            },
            {
              title: "Avg Mandi Price",
              value: formatCurrency(overview.avgMandiPrice),
              trend: marketBadge.label,
              icon: DollarSign,
            },
            {
              title: "Soil Health Score",
              value: `${overview.soilHealth.toFixed(0)}/100`,
              trend: data?.soil.soilType ?? "Soil pending",
              icon: Sprout,
            },
          ].map((card, index) => {
            const Icon = card.icon;
            return (
              <motion.article
                key={card.title}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.08, duration: 0.35 }}
                whileHover={{ y: -4, scale: 1.01 }}
                className="rounded-3xl border border-white/70 bg-white/80 p-5 shadow-[0_15px_40px_rgba(15,23,42,0.08)]"
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{card.title}</p>
                  <div className="rounded-2xl bg-emerald-50 p-2 text-emerald-700">
                    <Icon className="h-4 w-4" />
                  </div>
                </div>
                <p className="mt-4 text-2xl font-semibold text-slate-900">{card.value}</p>
                <p className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-slate-600">
                  {card.title === "Avg Mandi Price" ? <marketBadge.Icon className="h-3.5 w-3.5" /> : null}
                  {card.trend}
                </p>
              </motion.article>
            );
          })}
        </section>

        <section className="grid gap-5 xl:grid-cols-[1.3fr_0.7fr]">
          <motion.article
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="rounded-3xl border border-sky-100 bg-white/85 p-6 shadow-[0_15px_45px_rgba(14,116,144,0.08)]"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-900">Weather Intelligence</h2>
              <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
                {data?.weather.current.description ?? "--"}
              </span>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-4">
              <div className="rounded-2xl bg-sky-50 p-3">
                <p className="text-xs uppercase text-sky-700">Temp</p>
                <p className="mt-1 text-lg font-semibold">{data?.weather.current.temperature ?? 0}°C</p>
              </div>
              <div className="rounded-2xl bg-sky-50 p-3">
                <p className="text-xs uppercase text-sky-700">Humidity</p>
                <p className="mt-1 text-lg font-semibold">{data?.weather.current.humidity ?? 0}%</p>
              </div>
              <div className="rounded-2xl bg-sky-50 p-3">
                <p className="text-xs uppercase text-sky-700">Wind</p>
                <p className="mt-1 text-lg font-semibold inline-flex items-center gap-1"><Wind className="h-4 w-4" />{data?.weather.current.windSpeed ?? 0}</p>
              </div>
              <div className="rounded-2xl bg-sky-50 p-3">
                <p className="text-xs uppercase text-sky-700">Rain Prob</p>
                <p className="mt-1 text-lg font-semibold inline-flex items-center gap-1"><Droplets className="h-4 w-4" />{data?.weather.current.rainProbability ?? 0}%</p>
              </div>
            </div>

            <div className="mt-6 h-72 rounded-2xl bg-slate-50 p-3">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data?.weather.forecast ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#dbeafe" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="temp" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="rain" orientation="right" tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar yAxisId="rain" dataKey="rainProbability" fill="#93c5fd" radius={[6, 6, 0, 0]} />
                  <Line yAxisId="temp" type="monotone" dataKey="temperature" stroke="#16a34a" strokeWidth={3} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </motion.article>

          <motion.article
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.05 }}
            className="rounded-3xl border border-emerald-100 bg-white/85 p-6 shadow-[0_15px_45px_rgba(22,163,74,0.08)]"
          >
            <h2 className="text-xl font-semibold text-slate-900">Soil Intelligence</h2>
            <p className="mt-2 text-sm text-slate-600">pH, nutrients and health score from SoilGrids for your live location.</p>

            <div className="mt-4 h-52">
              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart
                  innerRadius="65%"
                  outerRadius="100%"
                  barSize={18}
                  data={[{ name: "Health", value: data?.soil.healthScore ?? 0 }]}
                  startAngle={180}
                  endAngle={0}
                >
                  <RadialBar dataKey="value" cornerRadius={8} fill="#16a34a" />
                  <Tooltip />
                </RadialBarChart>
              </ResponsiveContainer>
              <p className="-mt-7 text-center text-lg font-semibold text-slate-900">{(data?.soil.healthScore ?? 0).toFixed(0)}/100</p>
            </div>

            <div className="mt-5 space-y-3">
              {[
                { key: "pH", value: data?.soil.ph ?? 0, scale: 14 },
                { key: "Nitrogen", value: data?.soil.nitrogen ?? 0, scale: 0.4 },
                { key: "Organic Carbon", value: data?.soil.organicCarbon ?? 0, scale: 2.2 },
              ].map((row) => {
                const pct = Math.min(100, Math.max(0, (row.value / row.scale) * 100));
                return (
                  <div key={row.key}>
                    <div className="mb-1 flex items-center justify-between text-xs font-semibold text-slate-600">
                      <span>{row.key}</span>
                      <span>{row.value.toFixed(2)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100">
                      <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.article>
        </section>

        <section className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
          <motion.article
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="rounded-3xl border border-emerald-100 bg-white/85 p-6 shadow-[0_15px_45px_rgba(6,95,70,0.08)]"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-900">Market Intelligence</h2>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${data?.market.signal === "HOLD" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>
                {data?.market.signal ?? "--"}
              </span>
            </div>

            <p className="mt-2 text-sm text-slate-600">Best mandi: <span className="font-semibold text-slate-900">{data?.market.bestMarket ?? "--"}</span></p>

            <div className="mt-5 h-64 rounded-2xl bg-slate-50 p-3">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.market.markets.slice(0, 3) ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#dcfce7" />
                  <XAxis dataKey="mandi" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  <Bar dataKey="modalPrice" radius={[8, 8, 0, 0]}>
                    {(data?.market.markets.slice(0, 3) ?? []).map((entry, index) => (
                      <Cell key={`${entry.mandi}-${index}`} fill={index === 0 ? "#16a34a" : "#86efac"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-5 h-56 rounded-2xl bg-slate-50 p-3">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data?.market.trend ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#dcfce7" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  <Area type="monotone" dataKey="price" stroke="#0284c7" fill="#bae6fd" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.article>

          <motion.article
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.05 }}
            className="rounded-3xl border border-violet-100 bg-white/85 p-6 shadow-[0_15px_45px_rgba(91,33,182,0.08)]"
          >
            <h2 className="text-xl font-semibold text-slate-900">AI Insights</h2>
            <p className="mt-2 text-sm text-slate-600">Combined weather + soil + mandi intelligence</p>

            <div className="mt-4 space-y-3">
              {(data?.insights ?? []).map((insight, index) => (
                <motion.div
                  key={`${insight}-${index}`}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 + index * 0.07 }}
                  className="rounded-2xl border border-violet-100 bg-violet-50 px-4 py-3 text-sm text-violet-900"
                >
                  {insight}
                </motion.div>
              ))}
            </div>

            <div className="mt-6 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-800">
              <p className="font-semibold">Best Mandi Recommendation</p>
              <p className="mt-2">{data?.market.recommendation ?? "Market recommendation will appear after live data loads."}</p>
            </div>
          </motion.article>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {featureLinks.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.18 + index * 0.06 }}
              >
                <Link
                  href={feature.href}
                  className="group flex h-full flex-col justify-between rounded-3xl border border-emerald-100 bg-white p-5 shadow-[0_15px_40px_rgba(16,185,129,0.08)] transition hover:-translate-y-1"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="mt-4">
                    <h3 className="text-lg font-semibold text-slate-900">{feature.title}</h3>
                    <p className="mt-2 text-sm text-slate-600">{feature.description}</p>
                  </div>
                  <p className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-emerald-700">
                    Open <ArrowRight className="h-4 w-4" />
                  </p>
                </Link>
              </motion.div>
            );
          })}
        </section>

        <LocationModal isOpen={locationModalOpen} onClose={() => setLocationModalOpen(false)} />
      </div>
    </main>
  );
}
