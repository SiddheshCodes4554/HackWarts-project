"use client";

import { useMemo, useState } from "react";
import { ChartColumn, MapPin, TrendingUp, Wheat } from "lucide-react";

const marketData = {
  Wheat: [
    { name: "Nagpur Mandi", price: 2080, distance: "12 km", tag: "Nearby", best: false },
    { name: "Wardha Market", price: 2140, distance: "45 km", tag: "Best Price", best: true },
    { name: "Amravati Yard", price: 2050, distance: "75 km", tag: "Nearby", best: false },
  ],
  Rice: [
    { name: "Nagpur Rice Hub", price: 2240, distance: "10 km", tag: "Best Price", best: true },
    { name: "Bhandara Mandi", price: 2180, distance: "55 km", tag: "Nearby", best: false },
    { name: "Akola Market", price: 2120, distance: "90 km", tag: "Nearby", best: false },
  ],
  Tomato: [
    { name: "Nagpur Fresh", price: 1890, distance: "8 km", tag: "Nearby", best: false },
    { name: "Pune Sale", price: 1950, distance: "210 km", tag: "Best Price", best: true },
    { name: "Mumbai Market", price: 1920, distance: "265 km", tag: "Nearby", best: false },
  ],
};

const crops = ["Wheat", "Rice", "Tomato"] as const;

type Crop = (typeof crops)[number];

export default function MarketPage() {
  const [selectedCrop, setSelectedCrop] = useState<Crop>("Wheat");

  const prices = useMemo(() => marketData[selectedCrop], [selectedCrop]);
  const bestMarket = useMemo(() => prices.find((item) => item.best) ?? prices[0], [prices]);

  return (
    <main className="flex min-h-screen flex-1 flex-col gap-5 pb-24 pt-2 sm:pb-6">
      <section className="rounded-[2rem] border border-lime-200/80 bg-white/90 p-5 shadow-[0_20px_60px_rgba(40,72,18,0.08)] sm:p-6">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-lime-700">
          <ChartColumn className="h-4 w-4" />
          Market Prices
        </div>
        <h1 className="mt-3 text-2xl font-semibold sm:text-3xl">Know where to sell for the best mandi rate.</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
          Select a crop and compare nearby market prices with clear insights for quick selling decisions.
        </p>
      </section>

      <section className="rounded-[2rem] border border-lime-100 bg-white/95 p-5 shadow-sm sm:p-6">
        <label className="mb-2 block text-sm font-medium text-slate-700">Select your crop</label>
        <select
          value={selectedCrop}
          onChange={(event) => setSelectedCrop(event.target.value as Crop)}
          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-lime-300 focus:ring-2 focus:ring-lime-100"
        >
          {crops.map((crop) => (
            <option key={crop} value={crop}>
              {crop}
            </option>
          ))}
        </select>
      </section>

      <section className="space-y-4">
        {prices.map((item) => (
          <article
            key={item.name}
            className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">{item.name}</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">₹{item.price}/quintal</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-2 rounded-2xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
                  <MapPin className="h-4 w-4 text-lime-700" />
                  {item.distance}
                </span>
                <span
                  className={`inline-flex items-center rounded-2xl px-3 py-2 text-sm font-semibold ${
                    item.tag === "Best Price"
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-lime-50 text-lime-700"
                  }`}
                >
                  {item.tag}
                </span>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 text-sm text-slate-500">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              {item.tag === "Best Price"
                ? "Strong seller demand today"
                : "Good local availability"}
            </div>
          </article>
        ))}
      </section>

      <section className="rounded-[2rem] border border-lime-200 bg-lime-50/80 p-5 shadow-[0_16px_40px_rgba(48,83,23,0.08)] sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-lime-700">Best Market to Sell</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900">{bestMarket.name}</h2>
          </div>
          <div className="rounded-3xl bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm">
            ₹{bestMarket.price}/q
          </div>
        </div>
        <p className="mt-4 text-sm leading-6 text-slate-700">
          This market offers the highest price for {selectedCrop.toLowerCase()} today and is the best recommendation for your sell decision.
        </p>
      </section>
    </main>
  );
}
