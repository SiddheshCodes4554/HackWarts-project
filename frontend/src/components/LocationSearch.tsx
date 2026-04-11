"use client";

import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Loader2, Search } from "lucide-react";

export type LocationSuggestion = {
  lat: number;
  lon: number;
  label: string;
  village: string;
  district: string;
  state: string;
  country: string;
};

type NominatimSearchItem = {
  lat?: string;
  lon?: string;
  display_name?: string;
  address?: {
    village?: string;
    town?: string;
    city?: string;
    county?: string;
    state_district?: string;
    district?: string;
    state?: string;
    country?: string;
  };
};

type LocationSearchProps = {
  onSelect: (suggestion: LocationSuggestion) => void;
  placeholder?: string;
  className?: string;
};

function toSuggestion(item: NominatimSearchItem): LocationSuggestion | null {
  const lat = Number(item.lat);
  const lon = Number(item.lon);

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return null;
  }

  const village =
    item.address?.village ??
    item.address?.town ??
    item.address?.city ??
    "";

  const district =
    item.address?.district ??
    item.address?.state_district ??
    item.address?.county ??
    "";

  const state = item.address?.state ?? "";
  const country = item.address?.country ?? "";

  return {
    lat,
    lon,
    label: item.display_name ?? [village, district, state, country].filter(Boolean).join(", "),
    village,
    district,
    state,
    country,
  };
}

export function LocationSearch({ onSelect, placeholder = "Search village, district or state", className = "" }: LocationSearchProps) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [error, setError] = useState("");

  const trimmedQuery = useMemo(() => query.trim(), [query]);

  useEffect(() => {
    if (trimmedQuery.length < 3) {
      setSuggestions([]);
      setOpen(false);
      setError("");
      return;
    }

    const controller = new AbortController();
    const timerId = window.setTimeout(async () => {
      setLoading(true);
      setError("");

      try {
        const response = await axios.get<NominatimSearchItem[]>(
          "https://nominatim.openstreetmap.org/search",
          {
            params: {
              q: trimmedQuery,
              format: "jsonv2",
              addressdetails: 1,
              limit: 6,
              countrycodes: "in",
            },
            headers: {
              "Accept-Language": "en",
            },
            signal: controller.signal,
            timeout: 10000,
          },
        );

        const next = response.data
          .map(toSuggestion)
          .filter((entry): entry is LocationSuggestion => Boolean(entry));

        setSuggestions(next);
        setOpen(next.length > 0);
      } catch (requestError) {
        if (axios.isCancel(requestError)) {
          return;
        }

        setSuggestions([]);
        setOpen(false);
        setError("Unable to fetch locations right now.");
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      window.clearTimeout(timerId);
      controller.abort();
    };
  }, [trimmedQuery]);

  const handleSelect = (suggestion: LocationSuggestion) => {
    setQuery(suggestion.label);
    setOpen(false);
    onSelect(suggestion);
  };

  return (
    <div className={`relative ${className}`}>
      <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
        <Search className="h-4 w-4 text-slate-500" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => setOpen(suggestions.length > 0)}
          placeholder={placeholder}
          className="w-full bg-transparent text-sm text-slate-900 outline-none"
          autoComplete="off"
        />
        {loading ? <Loader2 className="h-4 w-4 animate-spin text-slate-500" /> : null}
      </div>

      {open ? (
        <div className="absolute z-[70] mt-2 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
          {suggestions.map((suggestion) => (
            <button
              key={`${suggestion.lat}-${suggestion.lon}-${suggestion.label}`}
              type="button"
              onClick={() => handleSelect(suggestion)}
              className="block w-full border-b border-slate-100 px-4 py-3 text-left text-sm text-slate-700 transition hover:bg-slate-50 last:border-b-0"
            >
              {suggestion.label}
            </button>
          ))}
        </div>
      ) : null}

      {error ? <p className="mt-2 text-xs text-rose-600">{error}</p> : null}
    </div>
  );
}
