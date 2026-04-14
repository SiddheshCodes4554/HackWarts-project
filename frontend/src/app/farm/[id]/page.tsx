"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Edit3, Loader2, MapPin, Sprout } from "lucide-react";
import { useUser } from "@/context/UserContext";
import { calculateFarmDraft, type FarmRecord } from "../../../lib/farm";
import { useFarm } from "../../../lib/useFarm";

const FarmMap = dynamic(() => import("../../../components/FarmMap"), { ssr: false });

function InsightCard({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-3xl border border-lime-100 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-lime-700">{title}</p>
      <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
        {items.length > 0 ? items.map((item) => <li key={item}>{item}</li>) : <li>No insights saved yet.</li>}
      </ul>
    </div>
  );
}

function farmToInitialCenter(farm: FarmRecord | null): [number, number] {
  if (farm?.center) {
    return [farm.center.lat, farm.center.lon];
  }

  return [21.1458, 79.0882];
}

export default function FarmViewPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { user, loading: userLoading } = useUser();
  const farmUserId = params?.id ?? "";
  const { farm, loading, error } = useFarm(farmUserId);

  useEffect(() => {
    if (!userLoading && !user) {
      router.replace("/login");
    }
  }, [router, user, userLoading]);

  const draft = useMemo(() => calculateFarmDraft(farm?.boundary ?? []), [farm?.boundary]);
  const initialCenter = farmToInitialCenter(farm);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(132,204,22,0.15)_0%,rgba(255,255,255,0.96)_42%,#eff6ea_100%)] px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 pb-8">
        <section className="rounded-4xl border border-lime-200/80 bg-white/92 p-5 shadow-[0_24px_80px_rgba(48,83,23,0.08)] backdrop-blur-sm sm:p-7">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-lime-700">Saved farm</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
                {farm?.name || "Farm boundary"}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
                This view shows the exact polygon saved for the current farmer and the insights tied to its center point.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link href="/farm" className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                <ArrowLeft className="h-4 w-4" />
                Edit
              </Link>
              <Link href="/home" className="inline-flex items-center gap-2 rounded-2xl border border-lime-200 bg-lime-50 px-4 py-2 text-sm font-semibold text-lime-800 transition hover:bg-lime-100">
                <Sprout className="h-4 w-4" />
                Dashboard
              </Link>
            </div>
          </div>
        </section>

        {loading ? (
          <div className="rounded-[1.75rem] border border-lime-100 bg-white p-8 text-sm text-slate-600 shadow-sm">
            <Loader2 className="mr-2 inline h-4 w-4 animate-spin text-lime-700" />
            Loading farm boundary...
          </div>
        ) : error ? (
          <div className="rounded-[1.75rem] border border-rose-100 bg-rose-50 p-5 text-sm text-rose-700 shadow-sm">
            {error}
          </div>
        ) : farm ? (
          <div className="grid gap-6 lg:grid-cols-[1.55fr_0.95fr]">
            <section className="rounded-4xl border border-lime-100 bg-white/95 p-4 shadow-[0_24px_80px_rgba(15,23,42,0.08)] sm:p-5">
              <FarmMap
                initialBoundary={farm.boundary}
                initialCenter={initialCenter}
                editable={false}
              />
            </section>

            <aside className="space-y-4">
              <div className="rounded-3xl border border-lime-100 bg-white p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-lime-700">Farm summary</p>
                <div className="mt-4 space-y-3 text-sm text-slate-600">
                  <p className="inline-flex items-center gap-2 font-semibold text-slate-900">
                    <MapPin className="h-4 w-4 text-lime-700" />
                    {farm.userId}
                  </p>
                  <p>Area: {draft.acres.toFixed(2)} acres</p>
                  <p>Hectares: {draft.hectares.toFixed(2)}</p>
                  <p>Coordinates: {draft.center.lat.toFixed(5)}, {draft.center.lon.toFixed(5)}</p>
                  <p>Boundary points: {farm.boundary.length}</p>
                </div>
              </div>

              <InsightCard title="Weather insight" items={farm.insights?.weather ?? []} />
              <InsightCard title="Soil insight" items={farm.insights?.soil ?? []} />
              <InsightCard title="Recommended actions" items={farm.insights?.recommendations ?? []} />

              <div className="rounded-3xl border border-lime-100 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <Edit3 className="h-4 w-4 text-lime-700" />
                  Need to update it?
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  Return to the editor if the boundary changes after a new lease, a field split, or a better GPS trace.
                </p>
              </div>
            </aside>
          </div>
        ) : (
          <div className="rounded-[1.75rem] border border-lime-100 bg-white p-8 text-sm text-slate-600 shadow-sm">
            No saved farm boundary found for this user yet.
          </div>
        )}
      </div>
    </main>
  );
}
