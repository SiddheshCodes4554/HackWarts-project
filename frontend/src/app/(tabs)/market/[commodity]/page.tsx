"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";
import {
  ArrowLeft,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  TrendingUp,
  Store,
  Activity,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useUser } from "@/context/UserContext";

type MarketDetailsResponse = {
  commodity: string;
  district: string;
  state: string;
  latestPrice: number;
  sevenDayAvg: number;
  changePct: number;
  demandSignal: "HIGH" | "MEDIUM" | "LOW";
  sellRecommendation: string;
  aiInsights: string[];
  priceTrend: Array<{
    date: string;
    price: number;
    arrivals: number;
  }>;
  topMandis: Array<{
    market: string;
    modalPrice: number;
    arrivals: number;
  }>;
  source: string;
  error?: string;
};

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  ""
).replace(/\/$/, "");

function getApiBase(): string {
  if (
    typeof window !== "undefined" &&
    window.location.hostname !== "localhost" &&
    window.location.hostname !== "127.0.0.1" &&
    (!API_BASE_URL || /localhost|127\.0\.0\.1/i.test(API_BASE_URL))
  ) {
    return "/api";
  }

  return API_BASE_URL || "/api";
}

function formatPrice(value: number): string {
  return `₹${Math.round(value).toLocaleString("en-IN")}/qtl`;
}

function normalizeLocationPart(value: string): string {
  return value.replace(/[.,]/g, "").replace(/\s+/g, " ").trim();
}

const fetcher = async (url: string): Promise<MarketDetailsResponse> => {
  const response = await fetch(url, { cache: "no-store" });
  const data = (await response.json().catch(() => ({}))) as MarketDetailsResponse;

  if (!response.ok) {
    throw new Error(data.error ?? "Unable to load commodity analytics");
  }

  return data;
};

export default function CommodityDetailsPage() {
  const router = useRouter();
  const params = useParams<{ commodity: string }>();
  const { profile } = useUser();
  const [chartsReady, setChartsReady] = useState(false);

  useEffect(() => {
    setChartsReady(true);
  }, []);

  const district = normalizeLocationPart(profile?.location_name?.split(",")[0] ?? "") || "Pune";
  const state = normalizeLocationPart(profile?.location_name?.split(",")[1] ?? "") || "Maharashtra";
  const commodity = decodeURIComponent(params.commodity ?? "");

  const apiBase = useMemo(() => getApiBase(), []);

  const detailsUrl =
    commodity && district && state
      ? `${apiBase}/market/details?commodity=${encodeURIComponent(commodity)}&district=${encodeURIComponent(district)}&state=${encodeURIComponent(state)}`
      : null;

  const { data, error, isLoading } = useSWR<MarketDetailsResponse>(detailsUrl, fetcher, {
    refreshInterval: 4 * 60 * 60 * 1000,
    revalidateOnFocus: false,
  });

  return (
    <main className="min-h-screen bg-[linear-gradient(145deg,#f4fbf2_0%,#f6fff9_38%,#eef9ff_100%)] px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-6xl space-y-6 pb-24">
        <button
          type="button"
          onClick={() => router.push("/market")}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Market
        </button>

        <section className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Commodity Analytics</p>
          <h1 className="mt-3 text-3xl font-semibold text-slate-900 sm:text-4xl">{commodity || "Commodity"}</h1>
          <p className="mt-2 text-sm text-slate-600">
            District: {district || "--"} | State: {state || "--"}
          </p>
        </section>

        {isLoading ? (
          <section className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-700">
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading real-time commodity analytics...
            </span>
          </section>
        ) : null}

        {error ? (
          <section className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {(error as Error).message}
          </section>
        ) : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
            <p className="text-xs uppercase tracking-[0.16em] text-emerald-700">Current Price</p>
            <p className="mt-3 text-2xl font-semibold text-slate-900">{data ? formatPrice(data.latestPrice) : "--"}</p>
          </article>
          <article className="rounded-2xl border border-sky-100 bg-white p-5 shadow-sm">
            <p className="text-xs uppercase tracking-[0.16em] text-sky-700">7-Day Average</p>
            <p className="mt-3 text-2xl font-semibold text-slate-900">{data ? formatPrice(data.sevenDayAvg) : "--"}</p>
          </article>
          <article className="rounded-2xl border border-amber-100 bg-white p-5 shadow-sm">
            <p className="text-xs uppercase tracking-[0.16em] text-amber-700">Change</p>
            <p className={`mt-3 inline-flex items-center gap-1 text-2xl font-semibold ${data && data.changePct >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
              {data && data.changePct >= 0 ? <ArrowUpRight className="h-5 w-5" /> : <ArrowDownRight className="h-5 w-5" />}
              {data ? `${data.changePct >= 0 ? "+" : ""}${data.changePct.toFixed(1)}%` : "--"}
            </p>
          </article>
          <article className="rounded-2xl border border-violet-100 bg-white p-5 shadow-sm">
            <p className="text-xs uppercase tracking-[0.16em] text-violet-700">Demand Signal</p>
            <p className="mt-3 text-2xl font-semibold text-slate-900">{data?.demandSignal ?? "--"}</p>
          </article>
        </section>

        <section className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
          <article className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
              <TrendingUp className="h-4 w-4 text-emerald-600" /> 7-Day Price Trend
            </div>
            <div className="h-72 min-h-72 min-w-0 rounded-2xl bg-slate-50 p-3">
              {chartsReady ? (
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={220}>
                  <LineChart data={data?.priceTrend ?? []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#dbeafe" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(value) => formatPrice(Number(value))} />
                    <Line type="monotone" dataKey="price" stroke="#16a34a" strokeWidth={3} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              ) : null}
            </div>
          </article>

          <article className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
              <Store className="h-4 w-4 text-sky-700" /> Top 3 Mandis
            </div>
            <div className="h-72 min-h-72 min-w-0 rounded-2xl bg-slate-50 p-3">
              {chartsReady ? (
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={220}>
                  <BarChart data={data?.topMandis ?? []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="market" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(value) => formatPrice(Number(value))} />
                    <Bar dataKey="modalPrice" fill="#0ea5e9" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : null}
            </div>
          </article>
        </section>

        <section className="grid gap-5 xl:grid-cols-[1fr_1fr]">
          <article className="rounded-3xl border border-emerald-100 bg-emerald-50 p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">Sell Recommendation</h2>
            <p className="mt-3 text-sm leading-7 text-slate-700">{data?.sellRecommendation ?? "--"}</p>
            <p className="mt-3 text-xs uppercase tracking-[0.16em] text-emerald-700">Source: {data?.source ?? "--"}</p>
          </article>

          <article className="rounded-3xl border border-violet-100 bg-violet-50 p-6 shadow-sm">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-violet-700">
              <Activity className="h-4 w-4" /> AI Market Insights
            </div>
            <div className="space-y-3">
              {(data?.aiInsights ?? []).map((insight, index) => (
                <div key={`${insight}-${index}`} className="rounded-xl border border-violet-100 bg-white px-3 py-2 text-sm text-slate-700">
                  {insight}
                </div>
              ))}
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}
