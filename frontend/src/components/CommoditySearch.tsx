"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";

type CommodityItem = {
  name: string;
  category: string;
};

type CommoditySearchProps = {
  state: string;
  district: string;
  value: string;
  onSelect: (commodity: CommodityItem) => void;
};

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  ""
).replace(/\/$/, "");

function getApiBase(): string {
  if (typeof window !== "undefined" && (window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") && (!API_BASE_URL || /localhost|127\.0\.0\.1/i.test(API_BASE_URL))) {
    return "/api";
  }
  return API_BASE_URL || "/api";
}

function highlightMatch(value: string, query: string): Array<{ text: string; match: boolean }> {
  if (!query.trim()) {
    return [{ text: value, match: false }];
  }

  const q = query.toLowerCase();
  const input = value.toLowerCase();
  const index = input.indexOf(q);

  if (index < 0) {
    return [{ text: value, match: false }];
  }

  return [
    { text: value.slice(0, index), match: false },
    { text: value.slice(index, index + q.length), match: true },
    { text: value.slice(index + q.length), match: false },
  ].filter((part) => part.text.length > 0);
}

function readRecentSearches(): CommodityItem[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem("market_recent_searches");
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as CommodityItem[];
    return Array.isArray(parsed) ? parsed.slice(0, 6) : [];
  } catch {
    return [];
  }
}

function saveRecentSearch(item: CommodityItem): void {
  if (typeof window === "undefined") {
    return;
  }

  const existing = readRecentSearches().filter((entry) => entry.name.toLowerCase() !== item.name.toLowerCase());
  const updated = [item, ...existing].slice(0, 6);
  window.localStorage.setItem("market_recent_searches", JSON.stringify(updated));
}

export function CommoditySearch({ state, district, value, onSelect }: CommoditySearchProps) {
  const [query, setQuery] = useState(value);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [suggestions, setSuggestions] = useState<CommodityItem[]>([]);
  const [recentSearches, setRecentSearches] = useState<CommodityItem[]>([]);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const apiBase = useMemo(() => getApiBase(), []);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    setRecentSearches(readRecentSearches());
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      if (!state || !district) {
        return;
      }

      setLoading(true);
      setError("");

      try {
        const params = new URLSearchParams({
          state,
          district,
          q: query,
        });

        const response = await fetch(`${apiBase}/commodities/list?${params.toString()}`, { cache: "no-store" });
        const data = (await response.json().catch(() => ({}))) as {
          commodities?: CommodityItem[];
          error?: string;
        };

        if (!response.ok) {
          throw new Error(data.error ?? "Unable to fetch commodity list");
        }

        setSuggestions((data.commodities ?? []).slice(0, 12));
        setActiveIndex(0);
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : "Unable to fetch commodity list");
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => window.clearTimeout(timer);
  }, [apiBase, district, query, state]);

  useEffect(() => {
    const onOutsideClick = (event: MouseEvent) => {
      if (!wrapperRef.current) {
        return;
      }
      if (!wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    window.addEventListener("mousedown", onOutsideClick);
    return () => window.removeEventListener("mousedown", onOutsideClick);
  }, []);

  const shownSuggestions = query.trim() ? suggestions : recentSearches;

  const selectItem = (item: CommodityItem) => {
    onSelect(item);
    setQuery(item.name);
    saveRecentSearch(item);
    setRecentSearches(readRecentSearches());
    setIsOpen(false);
  };

  return (
    <div ref={wrapperRef} className="relative">
      <div className="flex items-center rounded-3xl border border-slate-200 bg-white/70 px-4 py-3 shadow-[0_10px_30px_rgba(15,23,42,0.08)] backdrop-blur-md">
        <Search className="mr-2 h-4 w-4 text-slate-500" />
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={(event) => {
            if (!shownSuggestions.length) {
              return;
            }

            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActiveIndex((prev) => (prev + 1) % shownSuggestions.length);
            }

            if (event.key === "ArrowUp") {
              event.preventDefault();
              setActiveIndex((prev) => (prev - 1 + shownSuggestions.length) % shownSuggestions.length);
            }

            if (event.key === "Enter") {
              event.preventDefault();
              const item = shownSuggestions[activeIndex];
              if (item) {
                selectItem(item);
              }
            }
          }}
          placeholder="Search Commodity..."
          className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
        />
      </div>

      {isOpen ? (
        <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-2xl border border-white/50 bg-white/80 shadow-[0_20px_60px_rgba(15,23,42,0.18)] backdrop-blur-xl">
          <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            {query.trim() ? "Suggestions" : "Recent Searches"}
          </div>

          {loading ? <p className="px-3 pb-3 text-sm text-slate-500">Loading commodities...</p> : null}
          {!loading && error ? <p className="px-3 pb-3 text-sm text-rose-600">{error}</p> : null}
          {!loading && !error && shownSuggestions.length === 0 ? (
            <p className="px-3 pb-3 text-sm text-slate-500">No commodities found for this district/state.</p>
          ) : null}

          {!loading && !error ? (
            <ul className="max-h-72 overflow-y-auto pb-2">
              {shownSuggestions.map((item, index) => (
                <li key={`${item.name}-${item.category}`}>
                  <button
                    type="button"
                    onClick={() => selectItem(item)}
                    className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition ${
                      index === activeIndex ? "bg-emerald-50 text-emerald-900" : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <span>
                      {highlightMatch(item.name, query).map((part, partIndex) => (
                        <span key={`${item.name}-part-${partIndex}`} className={part.match ? "font-semibold text-emerald-700" : ""}>
                          {part.text}
                        </span>
                      ))}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-500">{item.category}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
