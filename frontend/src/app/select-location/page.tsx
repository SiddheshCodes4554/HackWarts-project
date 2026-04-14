"use client";

import { useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { ArrowLeft, CheckCircle2, MapPin } from "lucide-react";
import type { StructuredLocation } from "../../utils/reverseGeocode";
import { useUser } from "@/context/UserContext";
import { emitLocationUpdatedToast } from "@/lib/locationEvents";

const MapSelector = dynamic(() => import("../../components/MapSelector"), { ssr: false });

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  ""
).replace(/\/$/, "");

export default function SelectLocationPage() {
  const { user, refreshProfile } = useUser();
  const [selected, setSelected] = useState<StructuredLocation | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const confirmLocation = async () => {
    if (!selected || !user) {
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const response = await fetch(`${API_BASE_URL}/user/location`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          lat: selected.lat,
          lon: selected.lon,
          district: selected.district,
          state: selected.state,
          village: selected.village,
          full_address: selected.full_address,
        }),
      });

      if (!response.ok) {
        const errorData = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(errorData.error ?? "Failed to save location");
      }

      await refreshProfile();
      emitLocationUpdatedToast();
      setMessage("Location confirmed and synced across insights.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save location");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#eef9e3_0%,#f8fcf5_40%,#f1f6ec_100%)] px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-5">
        <div className="flex items-center justify-between rounded-3xl border border-lime-200/80 bg-white p-5 shadow-sm">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Select Farm Location</h1>
            <p className="mt-1 text-sm text-slate-600">Search, drag marker, or use GPS to set your precise farm location.</p>
          </div>
          <Link href="/home" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        </div>

        <section className="rounded-3xl border border-lime-100 bg-white p-5 shadow-sm">
          <MapSelector onLocationConfirmed={setSelected} />
        </section>

        <section className="rounded-3xl border border-lime-100 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-lime-700">Selected location</p>
          <div className="mt-3 space-y-1 text-sm text-slate-700">
            <p className="inline-flex items-center gap-2 font-semibold text-slate-900">
              <MapPin className="h-4 w-4 text-lime-700" />
              {selected?.full_address ?? "No location selected yet"}
            </p>
            {selected ? (
              <>
                <p>Village: {selected.village || "-"}</p>
                <p>District: {selected.district || "-"}</p>
                <p>State: {selected.state || "-"}</p>
                <p>Coordinates: {selected.lat.toFixed(5)}, {selected.lon.toFixed(5)}</p>
              </>
            ) : null}
          </div>

          <button
            type="button"
            disabled={!selected || !user || saving}
            onClick={confirmLocation}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-lime-700 px-4 py-2 text-sm font-semibold text-white hover:bg-lime-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <CheckCircle2 className="h-4 w-4" />
            {saving ? "Saving..." : "Confirm Location"}
          </button>

          {message ? <p className="mt-3 text-sm text-slate-600">{message}</p> : null}
        </section>
      </div>
    </main>
  );
}
