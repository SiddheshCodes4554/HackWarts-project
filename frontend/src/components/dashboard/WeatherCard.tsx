import { CloudRain, Wind } from "lucide-react";
import { DashboardWeather } from "@/utils/dashboardTypes";

type WeatherCardProps = {
  weather: DashboardWeather;
};

function weatherInsight(weather: DashboardWeather): string {
  if (weather.rainfall > 1) {
    return "Rain expected -> delay irrigation and focus on drainage checks.";
  }

  if (weather.temperature > 34) {
    return "High temperature alert -> irrigate early morning and protect root moisture.";
  }

  return "Stable weather -> continue planned irrigation with periodic moisture checks.";
}

export function WeatherCard({ weather }: WeatherCardProps) {
  const warm = weather.temperature >= 30;

  return (
    <section
      className={`rounded-3xl border p-5 shadow-sm ${
        warm
          ? "border-orange-200 bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50"
          : "border-sky-200 bg-gradient-to-br from-sky-50 via-cyan-50 to-indigo-50"
      }`}
    >
      <header className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-900">Weather</h2>
        <CloudRain className="h-5 w-5 text-sky-700" />
      </header>

      <p className="mt-4 text-5xl font-bold leading-none text-slate-900">{weather.temperature}°C</p>

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-slate-700">
        <div className="rounded-2xl border border-white/70 bg-white/70 p-3">
          <p className="text-xs uppercase tracking-wider text-slate-500">Rainfall</p>
          <p className="mt-1 text-lg font-semibold">{weather.rainfall} mm</p>
        </div>
        <div className="rounded-2xl border border-white/70 bg-white/70 p-3">
          <p className="text-xs uppercase tracking-wider text-slate-500">Wind</p>
          <p className="mt-1 inline-flex items-center gap-1 text-lg font-semibold">
            <Wind className="h-4 w-4" />
            {weather.windSpeed} km/h
          </p>
        </div>
      </div>

      <p className="mt-4 rounded-2xl bg-white/75 p-3 text-sm leading-6 text-slate-700">{weatherInsight(weather)}</p>
    </section>
  );
}
