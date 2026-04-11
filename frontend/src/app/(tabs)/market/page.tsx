import { ChartColumn, TrendingUp, Wheat } from "lucide-react";

const marketItems = [
  { crop: "Rice", price: "₹2,240/q", change: "+4.2%", trend: "up" },
  { crop: "Wheat", price: "₹2,080/q", change: "+1.8%", trend: "up" },
  { crop: "Maize", price: "₹1,760/q", change: "-0.6%", trend: "down" },
];

export default function MarketPage() {
  return (
    <main className="flex flex-1 flex-col gap-5 pb-6 pt-2">
      <section className="rounded-[2rem] border border-lime-200/80 bg-white/90 p-5 shadow-[0_20px_60px_rgba(40,72,18,0.08)] sm:p-6">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-lime-700">
          <ChartColumn className="h-4 w-4" />
          Market Pulse
        </div>
        <h1 className="mt-3 text-2xl font-semibold sm:text-3xl">Track mandi trends before you sell.</h1>
      </section>

      <section className="space-y-3">
        {marketItems.map((item) => (
          <article
            key={item.crop}
            className="flex items-center justify-between rounded-[1.5rem] border border-white/80 bg-white/90 p-4 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-lime-100 p-3 text-lime-800">
                <Wheat className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold text-slate-900">{item.crop}</p>
                <p className="text-sm text-slate-500">Expected price today</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-lg font-semibold text-slate-900">{item.price}</p>
              <p
                className={`inline-flex items-center gap-1 text-sm font-semibold ${
                  item.trend === "up" ? "text-emerald-600" : "text-rose-600"
                }`}
              >
                <TrendingUp className="h-4 w-4" />
                {item.change}
              </p>
            </div>
          </article>
        ))}
      </section>

      <section className="rounded-[1.75rem] border border-lime-100 bg-lime-50/80 p-5 text-sm leading-6 text-slate-700 shadow-sm">
        Use the Assistant tab to ask whether market timing or storage decisions make sense for your crop.
      </section>
    </main>
  );
}
