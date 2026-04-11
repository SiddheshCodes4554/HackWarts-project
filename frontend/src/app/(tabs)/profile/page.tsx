import { BadgeInfo, Bell, CircleUserRound, Settings2 } from "lucide-react";

const settings = ["Weather alerts", "Market reminders", "Irrigation schedule"];

export default function ProfilePage() {
  return (
    <main className="flex flex-1 flex-col gap-5 pb-6 pt-2">
      <section className="rounded-[2rem] border border-lime-200/80 bg-white/90 p-5 shadow-[0_20px_60px_rgba(40,72,18,0.08)] sm:p-6">
        <div className="flex items-center gap-3">
          <div className="rounded-3xl bg-lime-700 p-4 text-white shadow-lg shadow-lime-700/20">
            <CircleUserRound className="h-7 w-7" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-lime-700">
              Farmer Profile
            </p>
            <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">Ravi Patil</h1>
            <p className="text-sm text-slate-500">Maharashtra, India</p>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "Fields monitored", value: "12" },
          { label: "Alerts enabled", value: "8" },
          { label: "Season score", value: "92%" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-[1.5rem] border border-white/80 bg-white/90 p-4 shadow-sm">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{stat.label}</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{stat.value}</p>
          </div>
        ))}
      </section>

      <section className="rounded-[1.75rem] border border-lime-100 bg-white/90 p-5 shadow-sm sm:p-6">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <Settings2 className="h-4 w-4 text-lime-700" />
          Preferences
        </div>
        <div className="mt-4 space-y-3">
          {settings.map((item) => (
            <div key={item} className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <span>{item}</span>
              <BadgeInfo className="h-4 w-4 text-lime-700" />
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-lime-100 bg-lime-50/80 p-5 text-sm leading-6 text-slate-700 shadow-sm">
        <div className="flex items-center gap-2 font-semibold text-slate-900">
          <Bell className="h-4 w-4 text-lime-700" />
          Notification summary
        </div>
        <p className="mt-2">
          Your account is set up for timely agronomy updates, market changes, and assistant reminders.
        </p>
      </section>
    </main>
  );
}
