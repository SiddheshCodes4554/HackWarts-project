import { FlaskConical } from "lucide-react";
import { SoilProfile } from "@/utils/dashboardTypes";

type SoilCardProps = {
  soil: SoilProfile;
};

function clampPercent(value: number, max: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }

  return Math.min(100, Math.round((value / max) * 100));
}

export function SoilCard({ soil }: SoilCardProps) {
  const phPct = clampPercent(soil.ph, 14);
  const nitrogenPct = clampPercent(soil.nitrogen, 20);
  const carbonPct = clampPercent(soil.organicCarbon, 120);

  return (
    <section className="rounded-3xl border border-emerald-200 bg-white p-5 shadow-sm">
      <header className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-900">Soil Health</h2>
        <FlaskConical className="h-5 w-5 text-emerald-700" />
      </header>

      <div className="mt-4 flex items-center justify-between rounded-2xl bg-emerald-50 p-3">
        <p className="text-sm font-medium text-emerald-900">Soil Type</p>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-800">
          {soil.soilType}
        </span>
      </div>

      <div className="mt-4 space-y-3">
        <div>
          <div className="mb-1 flex items-center justify-between text-sm text-slate-700">
            <span>pH</span>
            <span>{soil.ph}</span>
          </div>
          <div className="h-2 rounded-full bg-slate-100">
            <div className="h-2 rounded-full bg-cyan-500" style={{ width: `${phPct}%` }} />
          </div>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between text-sm text-slate-700">
            <span>Nitrogen</span>
            <span>{soil.nitrogen}</span>
          </div>
          <div className="h-2 rounded-full bg-slate-100">
            <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${nitrogenPct}%` }} />
          </div>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between text-sm text-slate-700">
            <span>Organic Carbon</span>
            <span>{soil.organicCarbon}</span>
          </div>
          <div className="h-2 rounded-full bg-slate-100">
            <div className="h-2 rounded-full bg-amber-500" style={{ width: `${carbonPct}%` }} />
          </div>
        </div>
      </div>

      <p className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 p-3 text-sm leading-6 text-slate-700">
        {soil.recommendation}
      </p>
    </section>
  );
}
