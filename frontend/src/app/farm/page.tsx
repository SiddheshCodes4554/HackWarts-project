"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, MapPinned, Save, ShieldCheck, Sprout } from "lucide-react";
import { useLocation } from "../../context/LocationContext";
import { useUser } from "@/context/UserContext";
import { calculateFarmDraft, saveFarmRecord, type FarmDraft } from "../../lib/farm";
import { useFarm } from "../../lib/useFarm";

const FarmMap = dynamic(() => import("../../components/FarmMap"), { ssr: false });

function formatAreaValue(acres: number): string {
  if (!Number.isFinite(acres) || acres <= 0) {
    return "0.00";
  }

  return acres.toFixed(2);
}

export default function FarmBoundaryPage() {
  const router = useRouter();
  const { user, profile, loading: userLoading, profileStatus } = useUser();
  const { latitude, longitude, placeName } = useLocation();
  const { farm, loading: farmLoading, refresh } = useFarm(user?.id);
  const [farmName, setFarmName] = useState("My Farm");
  const [draft, setDraft] = useState<FarmDraft>(calculateFarmDraft([]));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const initialCenter: [number, number] = useMemo(() => {
    if (farm?.center) {
      return [farm.center.lat, farm.center.lon];
    }

    if (profile?.latitude && profile?.longitude) {
      return [profile.latitude, profile.longitude];
    }

    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      return [latitude as number, longitude as number];
    }

    return [21.1458, 79.0882];
  }, [farm?.center, latitude, longitude, profile?.latitude, profile?.longitude]);

  useEffect(() => {
    if (userLoading) {
      return;
    }

    if (!user) {
      router.replace("/login");
      return;
    }

    if (profileStatus === "missing") {
      router.replace("/onboarding");
    }
  }, [profileStatus, router, user, userLoading]);

  useEffect(() => {
    if (!farm) {
      return;
    }

    setFarmName(farm.name || "My Farm");
    setDraft(calculateFarmDraft(farm.boundary));
  }, [farm]);

  const handleSave = async () => {
    if (!user || draft.boundary.length < 3) {
      setMessage("Draw at least three points to define your farm boundary.");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const nextFarm = await saveFarmRecord({
        userId: user.id,
        name: farmName.trim() || "My Farm",
        boundary: draft.boundary,
        area: draft.areaSqMeters,
        center: draft.center,
      });

      await refresh();
      setMessage("Farm boundary saved and linked to your advisory flow.");
      router.push(`/farm/${nextFarm.userId}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save farm boundary");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(132,204,22,0.15)_0%,rgba(255,255,255,0.96)_42%,#eff6ea_100%)] px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 pb-8">
        <section className="rounded-4xl border border-lime-200/80 bg-white/92 p-5 shadow-[0_24px_80px_rgba(48,83,23,0.08)] backdrop-blur-sm sm:p-7">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-lime-700">Farm boundary</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
                Trace the exact edge of your field.
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
                Draw one polygon, save it to MongoDB, and let weather and soil advice use the farm center instead of a rough pin.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link href="/home" className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                <ArrowLeft className="h-4 w-4" />
                Home
              </Link>
              <Link href={`/farm/${user?.id ?? ""}`} className="inline-flex items-center gap-2 rounded-2xl border border-lime-200 bg-lime-50 px-4 py-2 text-sm font-semibold text-lime-800 transition hover:bg-lime-100">
                <MapPinned className="h-4 w-4" />
                View saved farm
              </Link>
            </div>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[1.6fr_0.9fr]">
          <section className="rounded-4xl border border-lime-100 bg-white/95 p-4 shadow-[0_24px_80px_rgba(15,23,42,0.08)] sm:p-5">
            <FarmMap
              initialBoundary={farm?.boundary}
              initialCenter={initialCenter}
              editable
              onChange={setDraft}
            />
          </section>

          <aside className="space-y-4">
            <div className="rounded-[1.75rem] border border-lime-100 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-lime-700">Save details</p>
              <label className="mt-4 block text-sm font-semibold text-slate-700">
                Farm name
                <input
                  value={farmName}
                  onChange={(event) => setFarmName(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-lime-400 focus:ring-2 focus:ring-lime-100"
                  placeholder="My Farm"
                />
              </label>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                <div className="rounded-2xl bg-lime-50 px-4 py-3 ring-1 ring-lime-100">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-lime-700">Area</p>
                  <p className="mt-1 text-2xl font-semibold text-slate-900">{formatAreaValue(draft.acres)} acres</p>
                  <p className="text-xs text-slate-600">{draft.hectares.toFixed(2)} hectares · {draft.areaSqMeters.toFixed(0)} m²</p>
                </div>

                <div className="rounded-2xl bg-slate-50 px-4 py-3 ring-1 ring-slate-100">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Center</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{draft.center.lat.toFixed(5)}, {draft.center.lon.toFixed(5)}</p>
                  <p className="text-xs text-slate-600">Used for live weather and soil intelligence.</p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleSave}
                disabled={saving || draft.boundary.length < 3}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {saving ? "Saving boundary..." : farm ? "Update farm boundary" : "Save farm boundary"}
              </button>

              {message ? <p className="mt-3 text-sm text-slate-600">{message}</p> : null}
            </div>

            <div className="rounded-[1.75rem] border border-lime-100 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <ShieldCheck className="h-4 w-4 text-lime-700" />
                Why this matters
              </div>
              <ul className="mt-3 space-y-3 text-sm leading-6 text-slate-600">
                <li>Weather alerts are anchored to the farm center, not just a general village pin.</li>
                <li>Crop advisory can compare your actual farm conditions against the live boundary location.</li>
                <li>Saved geometry stays on the server so the dashboard can reuse it across sessions.</li>
              </ul>
            </div>

            <div className="rounded-[1.75rem] border border-lime-100 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Sprout className="h-4 w-4 text-lime-700" />
                Farm status
              </div>
              <div className="mt-3 space-y-2 text-sm text-slate-600">
                <p>Map data: {farmLoading ? "Loading saved farm..." : farm ? "Saved" : "No saved boundary yet"}</p>
                <p>Current place: {profile?.location_name || placeName || "Unknown"}</p>
                <p>Boundary points: {draft.boundary.length}</p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
