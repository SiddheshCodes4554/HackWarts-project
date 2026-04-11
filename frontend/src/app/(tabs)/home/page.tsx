"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, MapPin, Sprout } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { LocationModal } from "@/components/LocationModal";
import { SoilCard } from "@/components/dashboard/SoilCard";
import { WeatherCard } from "@/components/dashboard/WeatherCard";
import { useLocation } from "@/context/LocationContext";
import { DashboardPayload } from "@/utils/dashboardTypes";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5000";

function rupee(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-20 rounded-3xl bg-slate-200" />
      <div className="h-56 rounded-3xl bg-slate-200" />
      <div className="h-56 rounded-3xl bg-slate-200" />
      <div className="h-72 rounded-3xl bg-slate-200" />
      <div className="h-64 rounded-3xl bg-slate-200" />
    </div>
  );
}

export default function HomePage() {
  const { latitude, longitude, placeName, isDetecting } = useLocation();
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [locationModalOpen, setLocationModalOpen] = useState(false);

  useEffect(() => {
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return;
    }

    const controller = new AbortController();

    const fetchDashboard = async () => {
      setLoading(true);
      setError("");

      try {
        const params = new URLSearchParams({
          latitude: String(latitude),
          longitude: String(longitude),
          placeName,
        });

        const response = await fetch(`${API_BASE_URL}/dashboard?${params.toString()}`, {
          signal: controller.signal,
        });

        const data = (await response.json().catch(() => ({}))) as DashboardPayload | { error?: string };

        if (!response.ok) {
          throw new Error((data as { error?: string }).error ?? "Unable to load dashboard data");
        }

        setDashboard(data as DashboardPayload);
      } catch (fetchError) {
        if (fetchError instanceof DOMException && fetchError.name === "AbortError") {
          return;
        }

        setError("Live dashboard is temporarily unavailable. Please retry in a moment.");
      } finally {
        setLoading(false);
      }
    };

    void fetchDashboard();

    return () => {
      controller.abort();
    };
  }, [latitude, longitude, placeName]);

  const marketChartData = useMemo(
    () =>
      (dashboard?.market.markets ?? []).map((market) => ({
        mandi: market.mandi,
        Modal: market.modalPrice,
        "Net Profit": market.netProfit,
      })),
    [dashboard],
  );

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#f1f9ec_0%,_#f7fbf3_40%,_#ecf3ea_100%)] px-4 py-5 sm:px-6">
      <div className="mx-auto max-w-5xl space-y-4 pb-8">
        <section className="rounded-3xl border border-lime-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-lime-700">Agricultural Intelligence</p>
              <h1 className="mt-2 text-2xl font-bold text-slate-900">FarmEase Real-Time Dashboard</h1>
              <p className="mt-2 inline-flex items-center gap-1 text-sm text-slate-600">
                <MapPin className="h-4 w-4" />
                {isDetecting ? "Detecting location..." : placeName}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setLocationModalOpen(true)}
              className="rounded-full border border-lime-200 bg-lime-50 px-3 py-2 text-xs font-semibold text-lime-900"
            >
              Change
            </button>
          </div>
          <p className="mt-3 text-sm text-slate-700">
            {dashboard?.weather.advice ?? "Fetching weather insight and farm intelligence..."}
          </p>
        </section>

        {loading && <DashboardSkeleton />}

        {!loading && error && (
          <section className="rounded-3xl border border-rose-200 bg-rose-50 p-5 text-rose-800">
            <p className="inline-flex items-center gap-2 text-sm font-medium">
              <AlertCircle className="h-4 w-4" />
              {error}
            </p>
          </section>
        )}

        {!loading && dashboard && (
          <div className="space-y-4">
            <WeatherCard weather={dashboard.weather} />

            <SoilCard soil={dashboard.soil} />

            <section className="rounded-3xl border border-lime-200 bg-white p-5 shadow-sm">
              <header className="flex items-center justify-between gap-2">
                <h2 className="text-base font-semibold text-slate-900">Crop Advice</h2>
                <Sprout className="h-5 w-5 text-lime-700" />
              </header>
              <p className="mt-2 rounded-2xl bg-lime-50 p-3 text-sm font-medium text-lime-900">
                {dashboard.crops.summary}
              </p>
              <div className="mt-3 space-y-3">
                {dashboard.crops.recommendations.map((crop) => (
                  <article key={`${crop.crop}-${crop.season}`} className="rounded-2xl border border-lime-100 p-3">
                    <p className="text-lg font-semibold text-slate-900">{crop.crop}</p>
                    <p className="text-xs uppercase tracking-wide text-lime-700">Season: {crop.season}</p>
                    <p className="mt-1 text-sm text-slate-700">{crop.reasoning}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className="rounded-3xl border border-sky-200 bg-white p-5 shadow-sm">
              <header className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-semibold text-slate-900">Market Intelligence</h2>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    dashboard.market.signal === "SELL"
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {dashboard.market.signal}
                </span>
              </header>

              <p className="mt-3 text-sm font-medium text-sky-900">BEST MARKET: {dashboard.market.bestMarket}</p>
              <p className="mt-1 text-sm text-slate-700">{dashboard.market.recommendation}</p>

              <div className="mt-4 h-64 rounded-2xl border border-slate-100 p-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={marketChartData} margin={{ top: 10, right: 5, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#dbeafe" />
                    <XAxis dataKey="mandi" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="Modal" fill="#0ea5e9" radius={[8, 8, 0, 0]} />
                    <Bar dataKey="Net Profit" fill="#16a34a" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-4 grid gap-2">
                {dashboard.market.markets.map((market) => (
                  <div key={market.mandi} className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-700">
                    <p className="font-semibold text-slate-900">{market.mandi}</p>
                    <p>Price: {rupee(market.modalPrice)} | Net: {rupee(market.netProfit)}</p>
                    <p>
                      Transport: {rupee(market.transportCost)} | Distance: {market.distanceKm} km
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-base font-semibold text-slate-900">Financial Insights</h2>
              <p className="mt-2 text-sm text-slate-700">{dashboard.finance.advice}</p>

              <div className="mt-3 space-y-2">
                {dashboard.finance.schemes.map((scheme) => (
                  <article key={scheme.name} className="rounded-2xl border border-slate-100 p-3">
                    <p className="font-semibold text-slate-900">{scheme.name}</p>
                    <p className="text-sm text-slate-700">{scheme.benefit}</p>
                    <p className="text-sm font-semibold text-emerald-700">{rupee(scheme.amountINR)}</p>
                  </article>
                ))}
              </div>
            </section>
          </div>
        )}

        <LocationModal isOpen={locationModalOpen} onClose={() => setLocationModalOpen(false)} />
      </div>
    </main>
  );
}
