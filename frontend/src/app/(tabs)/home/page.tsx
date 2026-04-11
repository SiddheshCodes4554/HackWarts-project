import Link from "next/link";
import { ArrowRight, BarChart3, CloudRain, DollarSign, Leaf, Seedling } from "lucide-react";

const features = [
  {
    title: "Crop Help",
    description: "Tailored guidance for your field and crop cycle.",
    href: "/crop-help",
    icon: Leaf,
  },
  {
    title: "Market Prices",
    description: "Check latest mandi rates across Nagpur.",
    href: "/market",
    icon: BarChart3,
  },
  {
    title: "Finance",
    description: "Plan loans, subsidies, and cash flow with confidence.",
    href: "/finance",
    icon: DollarSign,
  },
  {
    title: "Weather",
    description: "Get hourly weather alerts for irrigation planning.",
    href: "/weather",
    icon: CloudRain,
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#eef9e3_0%,_#f8fcf5_40%,_#f1f6ec_100%)] px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 pb-8">
        <section className="rounded-[2rem] border border-lime-200/80 bg-white/90 p-6 shadow-[0_24px_80px_rgba(48,83,23,0.08)] backdrop-blur-sm sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-lime-700">
                Namaste 👋
              </p>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
                Welcome back, farmer.
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
                Your daily dashboard for weather, market pricing, crop support, and finance insights.
              </p>
            </div>
            <div className="rounded-[1.75rem] bg-lime-50 px-4 py-3 text-sm font-semibold text-lime-900 shadow-sm ring-1 ring-lime-100">
              <span className="block text-xs uppercase tracking-[0.24em] text-lime-600">Location</span>
              <span className="mt-1 block text-lg">Nagpur</span>
            </div>
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
          <article className="rounded-[2rem] border border-lime-200/80 bg-white/95 p-6 shadow-[0_24px_70px_rgba(40,72,18,0.08)] sm:p-8">
            <div className="flex items-center justify-between gap-4">
              <span className="rounded-3xl bg-lime-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-lime-700">
                Today&apos;s Recommendation
              </span>
              <span className="inline-flex items-center rounded-3xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700">
                🌧️ Weather alert
              </span>
            </div>
            <h2 className="mt-6 text-3xl font-semibold leading-tight text-slate-900 sm:text-4xl">
              Rain expected — delay irrigation and monitor soil moisture.
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
              Fresh data from local mandi weather stations recommends holding off on irrigation
              today to protect the young crop and improve nutrient uptake.
            </p>
            <div className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-lime-900 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-lime-900/15">
              <ArrowRight className="h-4 w-4" />
              Review weather details
            </div>
          </article>

          <div className="grid gap-4 sm:grid-cols-2">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <Link
                  key={feature.title}
                  href={feature.href}
                  className="group flex flex-col justify-between rounded-[1.75rem] border border-lime-100 bg-white p-5 shadow-[0_18px_50px_rgba(48,83,23,0.08)] transition hover:-translate-y-0.5 hover:shadow-[0_20px_60px_rgba(48,83,23,0.14)]"
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-lime-50 text-lime-800 transition group-hover:bg-lime-100">
                    <Icon className="h-6 w-6" />
                  </div>
                  <div className="mt-5">
                    <h3 className="text-lg font-semibold text-slate-900">{feature.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{feature.description}</p>
                  </div>
                  <div className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-lime-700">
                    Open <ArrowRight className="h-4 w-4" />
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="rounded-[2rem] border border-lime-100 bg-white/95 p-6 shadow-[0_16px_40px_rgba(48,83,23,0.07)] sm:p-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Quick Insights</p>
              <h2 className="mt-3 text-2xl font-semibold text-slate-900">Fast farm signals for today</h2>
            </div>
            <span className="rounded-full bg-lime-50 px-3 py-2 text-sm font-semibold text-lime-800 ring-1 ring-lime-100">
              Updated now
            </span>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <article className="rounded-[1.75rem] bg-lime-50 p-6 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-lime-700">
                Top mandi price today
              </p>
              <p className="mt-4 text-3xl font-semibold text-slate-900">₹24,200 / quintal</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">Tomato rate in Nagpur mandi</p>
            </article>
            <article className="rounded-[1.75rem] bg-slate-50 p-6 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                Best crop suggestion
              </p>
              <p className="mt-4 text-3xl font-semibold text-slate-900">Soybean</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">Recommended for the current monsoon window.</p>
            </article>
          </div>
        </section>
      </div>
    </main>
  );
}
