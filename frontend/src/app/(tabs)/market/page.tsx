"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  Flame,
  Leaf,
  Loader2,
  MapPin,
  Search,
} from "lucide-react";
import { useLocation } from "../../../context/LocationContext";
import { useUser } from "@/context/UserContext";
import { CommoditySearch } from "@/components/CommoditySearch";
import { TrendingCommodities } from "@/components/TrendingCommodities";

type CommodityItem = {
  name: string;
  category: string;
};

type TrendItem = {
  commodity: string;
  currentPrice: number;
  sevenDayAvg: number;
  changePct: number;
  trend: "RISING" | "FALLING" | "STABLE";
  demandSignal: "HIGH" | "MEDIUM" | "LOW";
};

type TrendingPayload = {
  rising: TrendItem[];
  falling: TrendItem[];
  stable: TrendItem[];
  mostProfitable: TrendItem | null;
};

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  ""
).replace(/\/$/, "");

const CATEGORIES = ["All", "Grains", "Vegetables", "Fruits"] as const;

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
  return `Rs ${Math.round(value).toLocaleString("en-IN")}/qtl`;
}

function formatCoordinate(value: unknown): string {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(4) : "--";
}

function normalizeLocationPart(value: string): string {
  return value.replace(/[.,]/g, "").replace(/\s+/g, " ").trim();
}

function splitLocation(place: string): { district: string; state: string } {
  const [rawDistrict = "", rawState = ""] = place.split(",");
  const district = normalizeLocationPart(rawDistrict);
  const state = normalizeLocationPart(rawState);
  return {
    district: district || "Pune",
    state: state || "Maharashtra",
  };
}

export default function MarketPage() {
  const { latitude, longitude, placeName } = useLocation();
  const router = useRouter();
  const { user, profile, loading: userLoading } = useUser();

  const effectiveLatitude = profile?.latitude && profile.latitude !== 0 ? profile.latitude : latitude;
  const effectiveLongitude = profile?.longitude && profile.longitude !== 0 ? profile.longitude : longitude;
  const effectivePlaceName = profile?.location_name || placeName || "Unknown";
  const locationParts = splitLocation(effectivePlaceName);
  const effectiveDistrict = locationParts.district;
  const effectiveState = locationParts.state;

  const apiBase = useMemo(() => getApiBase(), []);

  useEffect(() => {
    if (userLoading) {
      return;
    }

    if (!user || !profile) {
      router.replace(user ? "/onboarding" : "/login");
    }
  }, [user, profile, userLoading, router]);

  const [selectedCommodity, setSelectedCommodity] = useState<CommodityItem | null>(null);
  const [trending, setTrending] = useState<TrendingPayload | null>(null);
  const [allSuggestions, setAllSuggestions] = useState<CommodityItem[]>([]);
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("All");
  const [loadingTrending, setLoadingTrending] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadSuggestions = async () => {
      setLoadingSuggestions(true);
      setError("");

      try {
        const params = new URLSearchParams({
          district: effectiveDistrict,
          state: effectiveState,
        });
        const response = await fetch(`${apiBase}/commodities/list?${params.toString()}`, { cache: "no-store" });
        const data = (await response.json().catch(() => ({}))) as { commodities?: CommodityItem[]; error?: string };

        if (!response.ok) {
          throw new Error(data.error ?? "Unable to load commodity list");
        }

        const commodities = data.commodities ?? [];
        setAllSuggestions(commodities);
        if (!selectedCommodity && commodities[0]) {
          setSelectedCommodity(commodities[0]);
        }
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : "Unable to load commodity list.");
      } finally {
        setLoadingSuggestions(false);
      }
    };

    void loadSuggestions();
  }, [apiBase, effectiveDistrict, effectiveState, selectedCommodity]);

  useEffect(() => {
    const loadTrending = async () => {
      setLoadingTrending(true);
      setError("");

      try {
        const params = new URLSearchParams({
          district: effectiveDistrict,
          state: effectiveState,
        });
        const response = await fetch(`${apiBase}/market/trending?${params.toString()}`, { cache: "no-store" });
        const data = (await response.json().catch(() => ({}))) as TrendingPayload & { error?: string };

        if (!response.ok) {
          throw new Error(data.error ?? "Unable to load trending market data");
        }

        setTrending(data);
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : "Unable to load trending commodities.");
      } finally {
        setLoadingTrending(false);
      }
    };

    void loadTrending();
  }, [apiBase, effectiveDistrict, effectiveState]);

  const filteredCommodities = useMemo(() => {
    if (category === "All") {
      return allSuggestions;
    }
    return allSuggestions.filter((item) => item.category === category);
  }, [allSuggestions, category]);

  return (
    <main className="text-slate-900">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 pb-24">
        <section className="rounded-4xl border border-lime-200/80 bg-white/90 p-6 shadow-[0_24px_80px_rgba(48,83,23,0.08)] backdrop-blur-sm sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-lime-700">
                <BarChart3 className="h-4 w-4" />
                Market Intelligence
              </div>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
                Real-time commodity search and district-wise analytics.
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
                Search commodities, track rising/falling crops, and open detailed analytics with live AGMARKNET market intelligence.
              </p>
            </div>
            <div className="rounded-[1.75rem] bg-lime-50 px-4 py-3 text-sm font-semibold text-lime-900 shadow-sm ring-1 ring-lime-100">
              <span className="block text-xs uppercase tracking-[0.24em] text-lime-600">Location</span>
              <span className="mt-1 inline-flex items-center gap-2 text-lg">
                <MapPin className="h-4 w-4" />
                {effectivePlaceName}
              </span>
              <p className="mt-1 text-xs font-medium text-lime-700">
                {effectiveDistrict}, {effectiveState}
              </p>
            </div>
          </div>
        </section>

        {error ? (
          <section className="rounded-[1.75rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 shadow-sm">
            {error}
          </section>
        ) : null}

        <section className="space-y-4 rounded-4xl border border-lime-100 bg-white/95 p-6 shadow-sm sm:p-8">
          <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
            <Search className="h-4 w-4 text-lime-700" />
            Smart Commodity Search
          </div>

          <CommoditySearch
            state={effectiveState}
            district={effectiveDistrict}
            value={selectedCommodity?.name ?? ""}
            onSelect={(item) => setSelectedCommodity(item)}
          />

          <div className="flex flex-wrap gap-2 pt-2">
            {CATEGORIES.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setCategory(item)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  category === item ? "bg-lime-700 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {item}
              </button>
            ))}
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {filteredCommodities.slice(0, 8).map((item) => (
              <button
                type="button"
                key={item.name}
                onClick={() => setSelectedCommodity(item)}
                className={`rounded-xl border px-3 py-2 text-left text-sm transition ${
                  selectedCommodity?.name === item.name
                    ? "border-lime-300 bg-lime-50 text-lime-900"
                    : "border-slate-200 bg-white text-slate-700 hover:border-lime-200"
                }`}
              >
                <p className="font-semibold">{item.name}</p>
                <p className="text-xs text-slate-500">{item.category}</p>
              </button>
            ))}
          </div>

          {loadingSuggestions ? (
            <p className="inline-flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading district commodity inventory...
            </p>
          ) : null}
        </section>

        <section className="rounded-4xl border border-emerald-100 bg-white/95 p-6 shadow-sm sm:p-8">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">
            <Flame className="h-4 w-4" />
            Trending Now
          </div>

          <TrendingCommodities
            data={trending}
            loading={loadingTrending}
            onSelectCommodity={(commodity) => {
              const selected = allSuggestions.find((item) => item.name.toLowerCase() === commodity.toLowerCase()) ?? {
                name: commodity,
                category: "Other",
              };
              setSelectedCommodity(selected);
            }}
          />
        </section>

        <section className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
          <article className="rounded-3xl border border-lime-100 bg-white/95 p-6 shadow-sm">
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Selected Commodity</h3>
            <p className="mt-3 text-3xl font-semibold text-slate-900">{selectedCommodity?.name ?? "Select a commodity"}</p>
            <p className="mt-1 text-sm text-slate-500">{selectedCommodity?.category ?? "--"}</p>

            <div className="mt-5 rounded-2xl border border-lime-100 bg-lime-50 p-4 text-sm text-lime-900">
              Live analytics are location-aware and fetched using AGMARKNET data for {effectiveDistrict}, {effectiveState}.
              <p className="mt-2 text-xs text-lime-700">
                Coordinates: {formatCoordinate(effectiveLatitude)}, {formatCoordinate(effectiveLongitude)}
              </p>
            </div>

            <Link
              href={selectedCommodity ? `/market/${encodeURIComponent(selectedCommodity.name)}` : "/market"}
              className={`mt-6 inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold ${
                selectedCommodity ? "bg-lime-700 text-white hover:bg-lime-800" : "bg-slate-200 text-slate-500"
              }`}
            >
              Open Detailed Analytics <ArrowRight className="h-4 w-4" />
            </Link>
          </article>

          <article className="rounded-3xl border border-slate-100 bg-white/95 p-6 shadow-sm">
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Recommended for You</h3>
            <p className="mt-3 text-xl font-semibold text-slate-900">{trending?.mostProfitable?.commodity ?? "--"}</p>
            <p className="mt-2 text-sm text-slate-600">
              {trending?.mostProfitable
                ? `${formatPrice(trending.mostProfitable.currentPrice)} | ${trending.mostProfitable.changePct >= 0 ? "+" : ""}${trending.mostProfitable.changePct.toFixed(1)}% | Demand ${trending.mostProfitable.demandSignal}`
                : "Market recommendation will appear after trend analysis loads."}
            </p>

            <div className="mt-5 space-y-2">
              {(trending?.rising ?? []).slice(0, 2).map((item) => (
                <button
                  key={`quick-${item.commodity}`}
                  type="button"
                  onClick={() => setSelectedCommodity({ name: item.commodity, category: "Other" })}
                  className="flex w-full items-center justify-between rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-left"
                >
                  <span className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-900">
                    <Leaf className="h-4 w-4" />
                    {item.commodity}
                  </span>
                  <span className="text-sm font-semibold text-emerald-700">+{item.changePct.toFixed(1)}%</span>
                </button>
              ))}
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}
