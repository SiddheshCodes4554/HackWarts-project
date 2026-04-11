"use client";

import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

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

type TrendingCommoditiesProps = {
  data: TrendingPayload | null;
  onSelectCommodity: (commodity: string) => void;
  loading?: boolean;
};

function formatPrice(value: number): string {
  return `₹${Math.round(value).toLocaleString("en-IN")}/qtl`;
}

function trendTone(trend: TrendItem["trend"]): { label: string; cls: string; icon: typeof ArrowUpRight } {
  if (trend === "RISING") {
    return {
      label: "Rising",
      cls: "bg-emerald-50 text-emerald-700",
      icon: ArrowUpRight,
    };
  }

  if (trend === "FALLING") {
    return {
      label: "Falling",
      cls: "bg-rose-50 text-rose-700",
      icon: ArrowDownRight,
    };
  }

  return {
    label: "Stable",
    cls: "bg-amber-50 text-amber-700",
    icon: Minus,
  };
}

function CommodityCard({ item, onSelect }: { item: TrendItem; onSelect: (commodity: string) => void }) {
  const tone = trendTone(item.trend);
  const Icon = tone.icon;

  return (
    <button
      type="button"
      onClick={() => onSelect(item.commodity)}
      className="w-full rounded-2xl border border-slate-100 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-slate-900">{item.commodity}</h4>
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${tone.cls}`}>
          <Icon className="h-3.5 w-3.5" /> {tone.label}
        </span>
      </div>
      <p className="mt-2 text-lg font-semibold text-slate-900">{formatPrice(item.currentPrice)}</p>
      <p className={`mt-1 text-sm font-semibold ${item.changePct >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
        {item.changePct >= 0 ? "+" : ""}
        {item.changePct.toFixed(1)}%
      </p>
      <p className="mt-1 text-xs text-slate-500">Demand: {item.demandSignal}</p>
    </button>
  );
}

export function TrendingCommodities({ data, onSelectCommodity, loading = false }: TrendingCommoditiesProps) {
  if (loading) {
    return <p className="text-sm text-slate-500">Loading real-time commodity trends...</p>;
  }

  if (!data) {
    return <p className="text-sm text-slate-500">Trending commodities will appear after market data loads.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">Most Profitable Crop Today</p>
        <p className="mt-2 text-xl font-semibold text-slate-900">{data.mostProfitable?.commodity ?? "--"}</p>
        <p className="mt-1 text-sm text-slate-600">
          {data.mostProfitable ? `${data.mostProfitable.changePct >= 0 ? "+" : ""}${data.mostProfitable.changePct.toFixed(1)}% with ${data.mostProfitable.demandSignal} demand` : "--"}
        </p>
      </div>

      <section>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-emerald-700">Top 3 Rising Crops</h3>
        <div className="grid gap-3 md:grid-cols-3">
          {data.rising.map((item) => (
            <CommodityCard key={`rising-${item.commodity}`} item={item} onSelect={onSelectCommodity} />
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-rose-700">Top 3 Falling Crops</h3>
        <div className="grid gap-3 md:grid-cols-3">
          {data.falling.map((item) => (
            <CommodityCard key={`falling-${item.commodity}`} item={item} onSelect={onSelectCommodity} />
          ))}
        </div>
      </section>
    </div>
  );
}
