"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ChartColumn,
  Clock3,
  Loader2,
  MapPin,
  Phone,
  TrendingUp,
  Wheat,
} from "lucide-react";
import { useLocation } from "../../../context/LocationContext";
import { useUser } from "@/context/UserContext";

type MarketRecord = {
  market: string;
  district: string;
  state: string;
  modal_price: number;
  distance_km: number;
  transport_cost: number;
  commission: number;
  net_per_quintal: number;
  arrivals_qtl: number;
  source: string;
};

type MarketIntelligenceResponse = {
  commodity: string;
  district: string;
  state: string;
  source: string;
  sell_signal: "SELL NOW" | "HOLD 7 DAYS" | "SELL TODAY";
  signal_reason: string;
  ninety_day_average: number;
  latest_price: number;
  price_change_percent: number;
  chart: Array<{ date: string; price: number; arrivals_qtl: number }>;
  markets: MarketRecord[];
  best_market: MarketRecord | null;
  note: string;
  error?: string;
};

type AlertSubscription = {
  id: string;
  commodity: string;
  targetPrice: number;
  contact: string;
  createdAt: string;
};

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  ""
).replace(/\/$/, "");
const DEFAULT_COMMODITIES = ["Tomato", "Onion", "Wheat", "Rice", "Soybean"];

function formatPrice(value: number): string {
  return `₹${Math.round(value).toLocaleString("en-IN")}/qtl`;
}

function signalTone(signal: MarketIntelligenceResponse["sell_signal"]): string {
  if (signal === "SELL NOW") {
    return "bg-emerald-50 text-emerald-700";
  }

  if (signal === "HOLD 7 DAYS") {
    return "bg-amber-50 text-amber-700";
  }

  return "bg-rose-50 text-rose-700";
}

function buildBars(chart: MarketIntelligenceResponse["chart"]) {
  const rows = chart.slice(-30);
  const maxPrice = Math.max(...rows.map((entry) => entry.price), 1);

  return rows.map((entry) => ({
    ...entry,
    height: Math.max(10, Math.round((entry.price / maxPrice) * 100)),
  }));
}

export default function MarketPage() {
  const { latitude, longitude, placeName } = useLocation();
    const router = useRouter();
    const { user, profile } = useUser();
  
    // Protect route
    useEffect(() => {
      if (!user || !profile) {
        router.push(user ? '/onboarding' : '/login');
      }
    }, [user, profile, router]);

  const [commodity, setCommodity] = useState("Tomato");
  const [marketData, setMarketData] = useState<MarketIntelligenceResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [alertPrice, setAlertPrice] = useState("");
  const [alertContact, setAlertContact] = useState("");
  const [alertMessage, setAlertMessage] = useState("");
  const [savingAlert, setSavingAlert] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      setLoading(true);
      setError("");

      try {
        const params = new URLSearchParams({
          message: `${commodity} mandi price intelligence`,
          locale: placeName,
        });

        if (Number.isFinite(latitude)) {
          params.set("latitude", String(latitude));
        }

        if (Number.isFinite(longitude)) {
          params.set("longitude", String(longitude));
        }

        const response = await fetch(`${API_BASE_URL}/market-intelligence?${params.toString()}`, {
          signal: controller.signal,
        });
        const data = (await response.json().catch(() => ({}))) as MarketIntelligenceResponse;

        if (!response.ok) {
          throw new Error(data.error ?? "Unable to load market intelligence");
        }

        setMarketData(data);
      } catch (loadError) {
        if (loadError instanceof DOMException && loadError.name === "AbortError") {
          return;
        }

        setError("Unable to load live market data right now.");
      } finally {
        setLoading(false);
      }
    };

    void load();

    return () => controller.abort();
  }, [commodity, latitude, longitude, placeName]);

  const chart = useMemo(() => buildBars(marketData?.chart ?? []), [marketData]);
  const bestMarket = marketData?.best_market ?? null;

  const handleAlertSave = async () => {
    if (!marketData || !alertPrice || !alertContact) {
      return;
    }

    setSavingAlert(true);
    setAlertMessage("");

    try {
      const response = await fetch(`${API_BASE_URL}/market-alerts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          commodity: marketData.commodity,
          targetPrice: Number(alertPrice),
          contact: alertContact,
        }),
      });

      const data = (await response.json().catch(() => ({}))) as AlertSubscription | { error?: string };
      if (!response.ok) {
        throw new Error((data as { error?: string }).error ?? "Unable to save alert");
      }

      setAlertMessage(`Alert saved for ${marketData.commodity} at ${formatPrice(Number(alertPrice))}`);
      setAlertPrice("");
      setAlertContact("");
    } catch {
      setAlertMessage("Unable to save alert right now.");
    } finally {
      setSavingAlert(false);
    }
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#eef9e3_0%,_#f8fcf5_40%,_#f1f6ec_100%)] px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 pb-24">
        <section className="rounded-[2rem] border border-lime-200/80 bg-white/90 p-6 shadow-[0_24px_80px_rgba(48,83,23,0.08)] backdrop-blur-sm sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-lime-700">
                <ChartColumn className="h-4 w-4" />
                Market Intelligence
              </div>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
                Live mandi prices, transport-aware profit, and sell timing.
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
                Compare the top 5 nearest markets by net return, check the 90-day trend, and save a price alert for later.
              </p>
            </div>
            <div className="rounded-[1.75rem] bg-lime-50 px-4 py-3 text-sm font-semibold text-lime-900 shadow-sm ring-1 ring-lime-100">
              <span className="block text-xs uppercase tracking-[0.24em] text-lime-600">Location</span>
              <span className="mt-1 inline-flex items-center gap-2 text-lg">
                <MapPin className="h-4 w-4" />
                {placeName}
              </span>
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] border border-lime-100 bg-white/95 p-6 shadow-sm sm:p-8">
          <label className="mb-2 block text-sm font-medium text-slate-700">Select your commodity</label>
          <select
            value={commodity}
            onChange={(event) => setCommodity(event.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-lime-300 focus:ring-2 focus:ring-lime-100"
          >
            {DEFAULT_COMMODITIES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </section>

        {error ? (
          <section className="rounded-[1.75rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </section>
        ) : null}

        <section className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <article className="rounded-[2rem] border border-lime-100 bg-white/95 p-6 shadow-sm sm:p-8">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">Sell signal</p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-900">
                  {loading ? "Analyzing..." : marketData?.sell_signal ?? "Waiting"}
                </h2>
              </div>
              <span className={`rounded-full px-3 py-2 text-sm font-semibold ${signalTone(marketData?.sell_signal ?? "SELL NOW")}`}>
                {loading ? "Loading" : marketData?.source ?? "live"}
              </span>
            </div>
            <p className="mt-4 text-sm leading-7 text-slate-700">{marketData?.signal_reason ?? "Pulling live market comparison and trend data..."}</p>
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <div className="rounded-[1.5rem] bg-lime-50 p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-lime-700">Latest price</p>
                <p className="mt-3 text-2xl font-semibold text-slate-900">
                  {marketData ? formatPrice(marketData.latest_price) : "--"}
                </p>
              </div>
              <div className="rounded-[1.5rem] bg-sky-50 p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">90d average</p>
                <p className="mt-3 text-2xl font-semibold text-slate-900">
                  {marketData ? formatPrice(marketData.ninety_day_average) : "--"}
                </p>
              </div>
              <div className="rounded-[1.5rem] bg-amber-50 p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">Change</p>
                <p className="mt-3 text-2xl font-semibold text-slate-900">
                  {marketData ? `${marketData.price_change_percent.toFixed(1)}%` : "--"}
                </p>
              </div>
            </div>
          </article>

          <article className="rounded-[2rem] border border-lime-100 bg-white/95 p-6 shadow-sm sm:p-8">
            <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
              <TrendingUp className="h-4 w-4 text-emerald-600" />
              30-day price chart
            </div>
            <div className="mt-4 flex h-64 items-end gap-1 rounded-[1.5rem] border border-slate-100 bg-slate-50 p-4">
              {chart.length > 0 ? (
                chart.map((bar) => (
                  <div key={bar.date} className="flex h-full flex-1 items-end justify-center">
                    <div className="flex w-full max-w-[10px] flex-col items-center justify-end gap-2">
                      <div
                        className="w-full rounded-t-full bg-lime-600"
                        style={{ height: `${bar.height}%` }}
                        title={`${bar.date}: ${bar.price}`}
                      />
                      <span className="text-[10px] text-slate-400">.</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex w-full items-center justify-center text-sm text-slate-500">
                  {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "No chart data yet"}
                </div>
              )}
            </div>
          </article>
        </section>

        <section className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <article className="rounded-[2rem] border border-lime-100 bg-white/95 p-6 shadow-sm sm:p-8">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-lime-700">Top 5 nearest mandis</p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-900">Net profit after transport</h2>
              </div>
              <span className="rounded-2xl bg-lime-50 px-3 py-2 text-xs font-semibold text-lime-800">
                Rs 8/km/qtl + 1.5% commission
              </span>
            </div>

            <div className="mt-5 space-y-3">
              {marketData?.markets.map((item) => (
                <div key={`${item.market}-${item.district}`} className="rounded-[1.5rem] border border-slate-100 bg-slate-50 p-4 shadow-sm">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">{item.market}</p>
                      <p className="mt-2 text-2xl font-semibold text-slate-900">{formatPrice(item.net_per_quintal)}</p>
                      <p className="mt-1 text-sm text-slate-600">
                        Modal {formatPrice(item.modal_price)} | Distance {item.distance_km.toFixed(1)} km | Commission ₹{item.commission.toLocaleString("en-IN")}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="rounded-full bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm">
                        {item.arrivals_qtl} qtl arrivals
                      </span>
                      {bestMarket?.market === item.market ? (
                        <span className="rounded-full bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 shadow-sm">
                          Best net return
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </article>

          <aside className="space-y-5 rounded-[2rem] border border-lime-100 bg-white/95 p-6 shadow-sm sm:p-8">
            <div className="rounded-[1.75rem] border border-emerald-100 bg-emerald-50 p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-emerald-700 shadow-sm">
                  <Wheat className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Best market</p>
                  <p className="mt-1 text-xl font-semibold text-slate-900">{bestMarket?.market ?? "--"}</p>
                </div>
              </div>
              <p className="mt-4 text-sm leading-7 text-slate-700">
                {marketData?.note ?? "Best-market recommendation will appear here once live price data loads."}
              </p>
            </div>

            <div className="rounded-[1.75rem] border border-slate-200 bg-slate-50 p-5 shadow-sm">
              <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                90-day sell timing
              </div>
              <div className="mt-4 space-y-3 text-sm leading-7 text-slate-700">
                <p>
                  If latest price is above the 90-day average by 12% or more, the system marks <strong>SELL NOW</strong>.
                </p>
                <p>
                  If trend is rising and arrivals are falling, the system suggests <strong>HOLD 7 DAYS</strong>.
                </p>
                <p>
                  For storage risk or fast spoilage, the system returns <strong>SELL TODAY</strong>.
                </p>
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-lime-100 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-lime-700">
                <Phone className="h-4 w-4" />
                Price alert subscription
              </div>
              <div className="mt-4 space-y-3">
                <input
                  value={alertPrice}
                  onChange={(event) => setAlertPrice(event.target.value)}
                  placeholder="Target price per quintal"
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-lime-300 focus:ring-2 focus:ring-lime-100"
                />
                <input
                  value={alertContact}
                  onChange={(event) => setAlertContact(event.target.value)}
                  placeholder="Phone or email for alert"
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-lime-300 focus:ring-2 focus:ring-lime-100"
                />
                <button
                  type="button"
                  onClick={handleAlertSave}
                  disabled={savingAlert}
                  className="inline-flex h-12 w-full items-center justify-center rounded-2xl bg-lime-700 px-4 text-sm font-semibold text-white transition hover:bg-lime-800 disabled:cursor-not-allowed disabled:bg-lime-400"
                >
                  {savingAlert ? <Loader2 className="h-4 w-4 animate-spin" /> : "Subscribe"}
                </button>
                {alertMessage ? <p className="text-sm text-slate-600">{alertMessage}</p> : null}
              </div>
            </div>

            {loading ? (
              <div className="rounded-[1.75rem] border border-dashed border-lime-200 bg-lime-50/60 p-5 text-sm text-slate-600">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-lime-700" />
                  Updating live market intelligence...
                </div>
              </div>
            ) : null}
          </aside>
        </section>

        <section className="rounded-[2rem] border border-sky-100 bg-white/95 p-6 shadow-sm sm:p-8">
          <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
            <Clock3 className="h-4 w-4 text-sky-600" />
            Market notes
          </div>
          <p className="mt-4 text-sm leading-7 text-slate-700">
            The page refreshes the commodity snapshot on selection change and uses live route distance when available. If an upstream data feed is unavailable, the service falls back to deterministic historical data so the workflow still works.
          </p>
          <p className="mt-3 text-sm leading-7 text-slate-700">
            Nearby mandis are ranked by net return per quintal using modal price, transport cost, and commission. The sell signal uses the latest price versus the 90-day average, plus trend and arrivals.
          </p>
        </section>
      </div>
    </main>
  );
}
