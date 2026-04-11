import { ArrowRight, Droplets, Leaf, Sprout, SunMedium } from "lucide-react";
import Link from "next/link";

const insights = [
  { label: "Weather Window", value: "Rain in 24h", icon: Droplets },
  { label: "Crop Health", value: "Stable", icon: Sprout },
  { label: "Soil Moisture", value: "68%", icon: Leaf },
];

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col gap-5 pb-6 pt-2">
      <section className="rounded-[2rem] border border-lime-200/80 bg-white/90 p-5 shadow-[0_20px_60px_rgba(40,72,18,0.08)] backdrop-blur sm:p-6">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-lime-700">
          <SunMedium className="h-4 w-4" />
          FarmEase Dashboard
        </div>
        <h1 className="mt-4 text-3xl font-semibold leading-tight sm:text-4xl">
          Smart decisions for the next growing cycle.
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
          A mobile-first agricultural assistant that combines weather, crop, market, and finance
          guidance in a clean, quick-glance interface.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href="/assistant"
            className="inline-flex items-center gap-2 rounded-2xl bg-lime-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-lime-800"
          >
            Open Assistant <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/market"
            className="inline-flex items-center gap-2 rounded-2xl border border-lime-200 bg-lime-50 px-4 py-3 text-sm font-semibold text-lime-900 transition hover:bg-lime-100"
          >
            View Market
          </Link>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        {insights.map((item) => {
          const Icon = item.icon;
          return (
            <article
              key={item.label}
              className="rounded-[1.5rem] border border-white/80 bg-white/85 p-4 shadow-sm"
            >
              <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                <span>{item.label}</span>
                <Icon className="h-4 w-4 text-lime-700" />
              </div>
              <p className="mt-3 text-xl font-semibold text-slate-900">{item.value}</p>
            </article>
          );
        })}
      </section>

      <section className="rounded-[1.75rem] border border-lime-100 bg-white/90 p-5 shadow-sm sm:p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Today&apos;s priorities</h2>
          <span className="rounded-full bg-lime-100 px-3 py-1 text-xs font-semibold text-lime-800">
            Live
          </span>
        </div>
        <div className="mt-4 space-y-3">
          {[
            "Check irrigation before peak heat.",
            "Review paddy crop readiness for wet conditions.",
            "Track local mandi prices before harvest planning.",
          ].map((task, index) => (
            <div
              key={task}
              className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3 text-sm text-slate-700"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-lime-700 text-xs font-semibold text-white">
                {index + 1}
              </span>
              <span>{task}</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
