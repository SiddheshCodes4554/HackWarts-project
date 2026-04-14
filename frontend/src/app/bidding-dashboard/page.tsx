"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useLocation } from "@/context/LocationContext";
import { useUser } from "@/context/UserContext";
import { supabase } from "@/lib/supabaseClient";

type Listing = {
  id: string;
  farmer_id: string;
  crop: string;
  quantity: number;
  min_price: number;
  district: string;
  status: string;
  latitude?: number | null;
  longitude?: number | null;
  created_at?: string;
};

type Bid = {
  id: string;
  listing_id: string;
  buyer_id: string;
  price: number;
  status: string;
};

type ProfileLite = {
  id: string;
  name: string;
};

type PriceGuardianResult = {
  mandiPrice: number;
  fairPrice: number;
  bidPrice: number;
  warning: string | null;
};

type NotificationItem = {
  id: string;
  text: string;
};

const LISTING_CACHE_TTL = 30_000;
const QUERY_TIMEOUT_MS = 45_000;

async function withTimeout<T>(promise: PromiseLike<T>, label: string, timeoutMs = QUERY_TIMEOUT_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out. Please retry.`)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

function districtFromPlace(place: string): { district: string; state: string } {
  const [district = "", state = ""] = place.split(",").map((part) => part.trim());
  return {
    district: district || "Pune",
    state: state || "Maharashtra",
  };
}

function toRad(value: number): number {
  return (value * Math.PI) / 180;
}

function distanceKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const earth = 6371;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const p1 = toRad(aLat);
  const p2 = toRad(bLat);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dLon / 2) ** 2;
  return earth * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function guardianProgress(guardian: PriceGuardianResult): number {
  if (!guardian.fairPrice || guardian.fairPrice <= 0) {
    return 0;
  }

  return Math.max(0, Math.min(180, (guardian.bidPrice / guardian.fairPrice) * 100));
}

export default function BiddingDashboardPage() {
  const router = useRouter();
  const { user, profile, loading: userLoading } = useUser();
  const { latitude, longitude, placeName } = useLocation();

  const { district: defaultDistrict, state: defaultState } = useMemo(
    () => districtFromPlace(profile?.location_name || placeName || ""),
    [profile?.location_name, placeName],
  );

  const roleSource =
    (typeof profile?.role === "string" ? profile.role : "") ||
    (typeof profile?.user_type === "string" ? profile.user_type : "") ||
    (typeof profile?.account_type === "string" ? profile.account_type : "") ||
    (typeof user?.user_metadata?.role === "string" ? user.user_metadata.role : "farmer");
  const role = String(roleSource).toLowerCase();

  const [filters, setFilters] = useState({
    crop: "",
    district: "",
    maxPrice: "",
    nearbyOnly: false,
  });
  const cacheRef = useRef<{ key: string; at: number; data: Listing[] } | null>(null);

  const [listings, setListings] = useState<Listing[]>([]);
  const [bidsMap, setBidsMap] = useState<Record<string, Bid[]>>({});
  const [profileMap, setProfileMap] = useState<Record<string, ProfileLite>>({});
  const [guardianMap, setGuardianMap] = useState<Record<string, PriceGuardianResult>>({});
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [hotListingId, setHotListingId] = useState<string | null>(null);
  const [hotBidId, setHotBidId] = useState<string | null>(null);
  const [bidDrafts, setBidDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userLoading && (!user || !profile)) {
      router.replace("/login");
      return;
    }

    if (!userLoading && user && role !== "buyer") {
      router.replace("/marketplace");
    }
  }, [userLoading, user, profile, role, router]);

  const fetchProfiles = useCallback(async (ids: string[]) => {
    if (!ids.length) {
      return;
    }

    const profileResult = await withTimeout(
      supabase.from("profiles").select("id,name").in("id", ids),
      "Fetching profiles",
    ) as { data: ProfileLite[] | null };
    const mapped: Record<string, ProfileLite> = {};
    (profileResult.data ?? []).forEach((row) => {
      mapped[row.id] = row;
    });
    setProfileMap((prev) => ({ ...prev, ...mapped }));
  }, []);

  const fetchBidsForListings = useCallback(async (listingIds: string[]) => {
    if (!listingIds.length) {
      setBidsMap({});
      return;
    }

    const bidsResult = await withTimeout(
      supabase
        .from("bids")
        .select("*")
        .in("listing_id", listingIds)
        .order("price", { ascending: false }),
      "Fetching bids",
    ) as { data: Bid[] | null };

    const grouped: Record<string, Bid[]> = {};
    (bidsResult.data ?? []).forEach((bid) => {
      grouped[bid.listing_id] = [...(grouped[bid.listing_id] ?? []), bid];
    });

    setBidsMap(grouped);
    const buyerIds = Array.from(new Set((bidsResult.data ?? []).map((bid) => bid.buyer_id)));
    await fetchProfiles(buyerIds);
  }, [fetchProfiles]);

  const fetchListings = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const cacheKey = JSON.stringify(filters);
      const now = Date.now();
      if (cacheRef.current && cacheRef.current.key === cacheKey && now - cacheRef.current.at < LISTING_CACHE_TTL) {
        setListings(cacheRef.current.data);
        await fetchBidsForListings(cacheRef.current.data.map((row) => row.id));
        setLoading(false);
        return;
      }

      let query = supabase
        .from("listings")
        .select("*")
        .eq("status", "open")
        .order("created_at", { ascending: false });

      if (filters.crop.trim()) {
        query = query.ilike("crop", `%${filters.crop.trim()}%`);
      }

      if (filters.district.trim()) {
        query = query.eq("district", filters.district.trim());
      }

      if (filters.maxPrice.trim()) {
        query = query.lte("min_price", Number(filters.maxPrice));
      }

      const listingResult = await withTimeout(query, "Fetching listings") as { data: Listing[] | null; error: { message: string } | null };
      if (listingResult.error) throw listingResult.error;

      const rows = listingResult.data ?? [];
      const nearbyFiltered = rows.filter((row) => {
        if (!filters.nearbyOnly) {
          return true;
        }

        if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !Number.isFinite(row.latitude) || !Number.isFinite(row.longitude)) {
          if (!defaultDistrict.trim()) {
            return true;
          }
          return row.district.toLowerCase() === defaultDistrict.toLowerCase();
        }

        const km = distanceKm(latitude as number, longitude as number, row.latitude as number, row.longitude as number);
        return km >= 50 && km <= 200;
      });

      setListings(nearbyFiltered);
      cacheRef.current = { key: cacheKey, at: now, data: nearbyFiltered };
      await fetchBidsForListings(nearbyFiltered.map((row) => row.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load listings");
      setListings([]);
    } finally {
      setLoading(false);
    }
  }, [defaultDistrict, fetchBidsForListings, filters, latitude, longitude, user]);

  useEffect(() => {
    if (user && role === "buyer") {
      void fetchListings();
    }
  }, [user, role, filters, fetchListings]);

  useEffect(() => {
    const channel = supabase
      .channel("buyer-bidding-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "bids" }, (payload) => {
        const next = payload.new as Bid;
        setHotListingId(next.listing_id);
        setHotBidId(next.id);
        setNotifications((prev) => [{ id: `${Date.now()}-${next.id}`, text: `New bid ₹${next.price} on ${next.listing_id.slice(0, 8)}` }, ...prev].slice(0, 8));

        window.setTimeout(() => {
          setHotListingId((current) => (current === next.listing_id ? null : current));
          setHotBidId((current) => (current === next.id ? null : current));
        }, 2200);

        void fetchListings();
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [fetchListings]);

  async function placeBid(listing: Listing) {
    if (!user) {
      return;
    }

    const bidValue = Number(bidDrafts[listing.id]);
    if (!Number.isFinite(bidValue) || bidValue <= 0) {
      setError("Enter a valid bid amount.");
      return;
    }

    try {
      const guardian = await fetch("/api/marketplace/price-guardian", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          commodity: listing.crop,
          district: listing.district,
          state: defaultState,
          bidPrice: bidValue,
        }),
      }).then((response) => response.json() as Promise<PriceGuardianResult>);

      if (guardian && typeof guardian === "object" && "fairPrice" in guardian) {
        setGuardianMap((prev) => ({ ...prev, [listing.id]: guardian }));
      }
    } catch {
      // Keep bidding operational if guardian service is unavailable.
    }

    const basePayload = {
      listing_id: listing.id,
      buyer_id: user.id,
      price: bidValue,
    };
    const extendedPayload = {
      ...basePayload,
      status: "pending",
      created_at: new Date().toISOString(),
    };

    let bidError: string | null = null;

    const { error: insertError } = await supabase.from("bids").insert(extendedPayload);
    if (insertError) {
      const duplicateIssue = /duplicate key|unique constraint|already exists/i.test(insertError.message || "");
      const columnIssue = /column|schema cache|not found|does not exist/i.test(insertError.message || "");

      if (duplicateIssue) {
        const { error: updateExistingError } = await supabase
          .from("bids")
          .update({ price: bidValue, status: "pending" })
          .eq("listing_id", listing.id)
          .eq("buyer_id", user.id);
        if (updateExistingError) {
          bidError = updateExistingError.message;
        }
      } else if (columnIssue) {
        const { error: fallbackInsertError } = await supabase.from("bids").insert(basePayload);
        if (fallbackInsertError) {
          bidError = fallbackInsertError.message;
        }
      } else {
        bidError = insertError.message;
      }
    }

    if (bidError) {
      setError(bidError);
      return;
    }

    setBidDrafts((prev) => ({ ...prev, [listing.id]: "" }));
    await fetchListings();
  }

  if (!user || !profile || role !== "buyer") {
    return <main className="min-h-screen bg-[#f7f8fa]" />;
  }

  return (
    <main className="min-h-screen bg-linear-to-b from-[#eef7ff] to-[#f8fbff] px-3 py-4 sm:px-5">
      <section className="mx-auto w-full max-w-5xl space-y-4">
        <header className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">Buyer Bidding Dashboard</p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">Single place to bid on farm listings</h1>
          <p className="mt-1 text-sm text-slate-600">Browse open listings, compare fair-price insights, and place bids quickly.</p>
        </header>

        <section className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">Filters</h2>
          <div className="mt-3 space-y-2">
            <input
              value={filters.crop}
              onChange={(event) => setFilters((prev) => ({ ...prev, crop: event.target.value }))}
              placeholder="Filter by crop"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                value={filters.district}
                onChange={(event) => setFilters((prev) => ({ ...prev, district: event.target.value }))}
                placeholder="District"
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
              <input
                value={filters.maxPrice}
                onChange={(event) => setFilters((prev) => ({ ...prev, maxPrice: event.target.value }))}
                placeholder="Max min price"
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={filters.nearbyOnly}
                onChange={(event) => setFilters((prev) => ({ ...prev, nearbyOnly: event.target.checked }))}
              />
              Nearby only (50-200 km)
            </label>
          </div>
        </section>

        {!!notifications.length && (
          <section className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <h3 className="text-sm font-semibold text-slate-900">Live Bidding Events</h3>
            <div className="mt-2 space-y-1 text-xs text-slate-600">
              <AnimatePresence initial={false}>
                {notifications.map((item) => (
                  <motion.p
                    key={item.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.24 }}
                    className="text-sky-700"
                  >
                    • {item.text}
                  </motion.p>
                ))}
              </AnimatePresence>
            </div>
          </section>
        )}

        {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

        <section className="space-y-4 pb-8">
          {loading && !listings.length && <p className="text-sm text-slate-500">Loading listings...</p>}

          {!loading && !listings.length && (
            <p className="rounded-2xl bg-white px-4 py-4 text-sm text-slate-600 ring-1 ring-slate-200">No open listings found for current filters.</p>
          )}

          {listings.map((listing) => {
            const bids = bidsMap[listing.id] ?? [];
            const highest = bids[0];
            const guardian = guardianMap[listing.id];
            const isHot = hotListingId === listing.id;

            return (
              <motion.article
                key={listing.id}
                layout
                animate={isHot ? { scale: [1, 1.01, 1], boxShadow: ["0 2px 8px rgba(15,23,42,0.04)", "0 8px 22px rgba(14,165,233,0.22)", "0 2px 8px rgba(15,23,42,0.04)"] } : { scale: 1, boxShadow: "0 2px 8px rgba(15,23,42,0.04)" }}
                transition={{ duration: 0.7 }}
                className="rounded-3xl bg-white p-4 ring-1 ring-slate-200"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold text-slate-900">{listing.crop} - {listing.quantity} Quintals</p>
                    <p className="text-xs text-slate-500">📍 {listing.district}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-slate-500">Min Price</p>
                    <p className="text-xl font-bold text-sky-700">₹{listing.min_price}</p>
                  </div>
                </div>

                <motion.div
                  animate={isHot ? { backgroundColor: ["#f8fafc", "#ecfeff", "#f8fafc"] } : { backgroundColor: "#f8fafc" }}
                  transition={{ duration: 1.1 }}
                  className="mt-3 rounded-2xl bg-slate-50 p-3"
                >
                  <p className="text-xs text-slate-500">Highest Bid</p>
                  <div className="flex items-center justify-between">
                    <p className="text-lg font-semibold text-emerald-700">{highest ? `₹${highest.price}` : "No bids yet"}</p>
                    {isHot && <span className="rounded-full bg-sky-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-sky-700">Live update</span>}
                  </div>
                </motion.div>

                {!!bids.length && (
                  <motion.div layout className="mt-3 space-y-2">
                    <AnimatePresence initial={false}>
                      {bids.map((bid) => (
                        <motion.div
                          key={bid.id}
                          layout
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -8 }}
                          transition={{ duration: 0.2 }}
                          className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm ${bid.id === highest?.id ? "bg-emerald-50 text-emerald-800" : "bg-slate-50 text-slate-700"} ${hotBidId === bid.id ? "ring-2 ring-sky-300" : ""}`}
                        >
                          <span>{profileMap[bid.buyer_id]?.name || "Buyer"} bid ₹{bid.price}</span>
                          <span className="text-xs uppercase">{bid.status}</span>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </motion.div>
                )}

                {guardian && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`mt-3 rounded-2xl p-3 ${guardian.warning ? "bg-amber-50" : "bg-emerald-50"}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className={`text-[11px] font-semibold uppercase tracking-[0.16em] ${guardian.warning ? "text-amber-700" : "text-emerald-700"}`}>
                          AI Price Guardian
                        </p>
                        <p className="mt-1 text-xs text-slate-700">Mandi: ₹{guardian.mandiPrice} · Fair: ₹{guardian.fairPrice} · Bid: ₹{guardian.bidPrice}</p>
                      </div>
                      <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${guardian.warning ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>
                        {guardian.warning ? "Warning" : "Fair Deal"}
                      </span>
                    </div>

                    <div className="mt-3">
                      <div className="h-2 overflow-hidden rounded-full bg-white/90">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${guardianProgress(guardian)}%` }}
                          transition={{ duration: 0.6 }}
                          className={`h-full ${guardian.warning ? "bg-amber-500" : "bg-emerald-500"}`}
                        />
                      </div>
                      <p className={`mt-2 text-xs font-semibold ${guardian.warning ? "text-amber-800" : "text-emerald-800"}`}>
                        {guardian.warning ? guardian.warning : "Bid is above fair benchmark. Good deal for farmer."}
                      </p>
                    </div>
                  </motion.div>
                )}

                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <input
                    value={bidDrafts[listing.id] ?? ""}
                    onChange={(event) => setBidDrafts((prev) => ({ ...prev, [listing.id]: event.target.value }))}
                    placeholder="Place bid amount"
                    className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                  <button
                    onClick={() => void placeBid(listing)}
                    className="rounded-xl bg-sky-700 px-4 py-2 text-sm font-semibold text-white"
                  >
                    Place Bid
                  </button>
                </div>
              </motion.article>
            );
          })}
        </section>
      </section>
    </main>
  );
}
