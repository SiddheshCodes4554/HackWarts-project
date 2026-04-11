"use client";

import dynamic from "next/dynamic";
import { X } from "lucide-react";
import { useState } from "react";
import { useUser } from "@/context/UserContext";
import { emitLocationUpdatedToast } from "@/lib/locationEvents";
import type { StructuredLocation } from "../utils/reverseGeocode";

const MapSelector = dynamic(() => import("./MapSelector"), { ssr: false });

type LocationModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export function LocationModal({ isOpen, onClose }: LocationModalProps) {
  const { user, updateProfile, refreshProfile } = useUser();
  const [error, setError] = useState("");

  const persistLocation = async (location: StructuredLocation) => {
    if (!user) {
      return;
    }

    setError("");

    try {
      await updateProfile({
        location_name: location.full_address,
        latitude: location.lat,
        longitude: location.lon,
      });

      await refreshProfile();
      emitLocationUpdatedToast();
    } catch (persistenceError) {
      setError(
        persistenceError instanceof Error
          ? persistenceError.message
          : "Unable to persist location",
      );
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-4 sm:items-center">
      <div className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-4 shadow-2xl sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Set Farm Location</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-100"
            aria-label="Close location modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <MapSelector onDone={onClose} onLocationConfirmed={persistLocation} />
        {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
      </div>
    </div>
  );
}
