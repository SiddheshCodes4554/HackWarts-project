"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/context/UserContext";
import { useLocation } from "@/context/LocationContext";
import { supabase } from "@/lib/supabaseClient";
import { AnimatePresence, motion } from "framer-motion";

type Listing = {
  id: string;
  farmer_id: string;
  crop: string;
  quantity: number;
  min_price: number;
  district: string;
  status: string;
  quality?: string | null;
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
  created_at?: string;
};

type ProfileLite = {
  id: string;
  name: string;
  location_name: string;
};

type PriceGuardianResult = {
  commodity: string;
  district: string;
  state: string;
  mandiPrice: number;
  fairPrice: number;
  bidPrice: number;
  verdict: string;
  warning: string | null;
};

type NotificationItem = {
  id: string;
  type: "new_bid" | "bid_accepted";
  text: string;
  createdAt: number;
};

const LISTING_CACHE_TTL = 30_000;

function districtFromPlace(place: string): { district: string; state: string } {
  const [district = "", state = ""] = place.split(",").map((part) => part.trim());
  return {
    district: district || "Pune",
    state: state || "Maharashtra",
  };
}

function roleOf(profile: unknown): string {
  if (!profile || typeof profile !== "object") return "farmer";
  const value = (profile as Record<string, unknown>).role
    ?? (profile as Record<string, unknown>).user_type
    ?? (profile as Record<string, unknown>).account_type;

  return typeof value === "string" ? value.toLowerCase() : "farmer";
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

  const ratio = (guardian.bidPrice / guardian.fairPrice) * 100;
  return Math.max(0, Math.min(180, ratio));
}

export default function MarketplacePage() {
  const router = useRouter();
  const { user, profile, loading: userLoading } = useUser();
  const { latitude, longitude, placeName } = useLocation();
  const roleSource =
    (typeof (profile as { role?: unknown } | null)?.role === "string" ? (profile as { role: string }).role : "") ||
    (typeof (profile as { user_type?: unknown } | null)?.user_type === "string" ? (profile as { user_type: string }).user_type : "") ||
    (typeof (profile as { account_type?: unknown } | null)?.account_type === "string" ? (profile as { account_type: string }).account_type : "") ||
    (typeof user?.user_metadata?.role === "string" ? user.user_metadata.role : "");

  const { district: defaultDistrict, state: defaultState } = useMemo(
    () => districtFromPlace(profile?.location_name || placeName || ""),
    [placeName, profile?.location_name],
  );

  const userRole = (roleSource || roleOf(profile as unknown)).toLowerCase();
  const canCreateListing = userRole !== "buyer";
  const canBid = userRole !== "farmer";

  const [filters, setFilters] = useState({
    crop: "",
    district: defaultDistrict,
    maxPrice: "",
    nearbyOnly: true,
  });

  const cacheRef = useRef<{ key: string; at: number; data: Listing[] } | null>(null);

  const [listings, setListings] = useState<Listing[]>([]);
  const [bidsMap, setBidsMap] = useState<Record<string, Bid[]>>({});
  const [profileMap, setProfileMap] = useState<Record<string, ProfileLite>>({});
  const [guardianMap, setGuardianMap] = useState<Record<string, PriceGuardianResult>>({});
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [hotListingId, setHotListingId] = useState<string | null>(null);
  const [hotBidId, setHotBidId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [listingForm, setListingForm] = useState({
    crop: "",
    quantity: "",
    district: defaultDistrict,
    minPrice: "",
    quality: "",
  });

  const [bidDrafts, setBidDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    setFilters((prev) => ({ ...prev, district: defaultDistrict }));
    setListingForm((prev) => ({ ...prev, district: defaultDistrict }));
  }, [defaultDistrict]);

  useEffect(() => {
    if (!userLoading && (!user || !profile)) {
      router.replace("/login");
    }
  }, [profile, router, user, userLoading]);

  useEffect(() => {
    if (!userLoading && user && userRole === "buyer") {
      router.replace("/bidding-dashboard");
    }
  }, [userLoading, user, userRole, router]);

  const fetchProfiles = useCallback(async (ids: string[]) => {
    if (!ids.length) return;

    const { data } = await supabase
      .from("profiles")
      .select("id,name,location_name")
      .in("id", ids);

    const mapped: Record<string, ProfileLite> = {};
    (data as ProfileLite[] | null)?.forEach((row) => {
      mapped[row.id] = row;
    });

    setProfileMap((prev) => ({ ...prev, ...mapped }));
  }, []);

  const fetchBidsForListings = useCallback(async (listingIds: string[]) => {
    if (!listingIds.length) {
      setBidsMap({});
      return;
    }

    const { data } = await supabase
      .from("bids")
      .select("id,listing_id,buyer_id,price,status,created_at")
      .in("listing_id", listingIds)
      .order("price", { ascending: false });

    const grouped: Record<string, Bid[]> = {};
    (data as Bid[] | null)?.forEach((bid) => {
      grouped[bid.listing_id] = [...(grouped[bid.listing_id] ?? []), bid];
    });

    setBidsMap(grouped);
    const buyerIds = Array.from(new Set((data as Bid[] | null)?.map((bid) => bid.buyer_id) ?? []));
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
        .select("id,farmer_id,crop,quantity,min_price,district,status,quality,latitude,longitude,created_at")
        .in("status", ["open", "active"])
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

      const { data, error: listingError } = await query;
      if (listingError) {
        throw listingError;
      }

      const rows = (data as Listing[] | null) ?? [];

      const filteredNearby = rows.filter((row) => {
        if (!filters.nearbyOnly) {
          return true;
        }

        if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !Number.isFinite(row.latitude) || !Number.isFinite(row.longitude)) {
          return row.district.toLowerCase() === defaultDistrict.toLowerCase();
        }

        const km = distanceKm(latitude as number, longitude as number, row.latitude as number, row.longitude as number);
        return km >= 50 && km <= 200;
      });

      setListings(filteredNearby);
      cacheRef.current = { key: cacheKey, at: now, data: filteredNearby };

      const farmerIds = Array.from(new Set(filteredNearby.map((row) => row.farmer_id)));
      await fetchProfiles(farmerIds);
      await fetchBidsForListings(filteredNearby.map((row) => row.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load listings");
    } finally {
      setLoading(false);
    }
  }, [defaultDistrict, fetchBidsForListings, fetchProfiles, filters, latitude, longitude, user]);

  useEffect(() => {
    if (user) {
      void fetchListings();
    }
  }, [user, filters, fetchListings]);

  useEffect(() => {
    const channel = supabase
      .channel("marketplace-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "bids" }, (payload) => {
        const next = payload.new as Bid;
        setHotListingId(next.listing_id);
        setHotBidId(next.id);
        setNotifications((prev) => [
          {
            id: `${Date.now()}-${next.id}`,
            type: "new_bid" as const,
            text: `New bid ₹${next.price} placed on listing ${next.listing_id.slice(0, 8)}.`,
            createdAt: Date.now(),
          },
          ...prev,
        ].slice(0, 8));

        window.setTimeout(() => {
          setHotListingId((current) => (current === next.listing_id ? null : current));
          setHotBidId((current) => (current === next.id ? null : current));
        }, 2200);

        void fetchListings();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "bids" }, (payload) => {
        const next = payload.new as Bid;
        if (next.status === "accepted") {
          setNotifications((prev) => [
            {
              id: `${Date.now()}-${next.id}`,
              type: "bid_accepted" as const,
              text: `Bid accepted for listing ${next.listing_id.slice(0, 8)}.`,
              createdAt: Date.now(),
            },
            ...prev,
          ].slice(0, 8));
          void fetchListings();
        }
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [fetchListings]);

  async function createListing(event: FormEvent) {
    event.preventDefault();

    if (!user || !canCreateListing) {
      setError("Only farmer accounts can create listings.");
      return;
    }

    const minPrice = Number(listingForm.minPrice);
    const quantity = Number(listingForm.quantity);

    if (!listingForm.crop.trim() || !Number.isFinite(minPrice) || !Number.isFinite(quantity)) {
      setError("Fill crop, quantity, and minimum price.");
      return;
    }

    const { error: insertError } = await supabase.from("listings").insert({
      farmer_id: user.id,
      crop: listingForm.crop.trim(),
      quantity,
      min_price: minPrice,
      district: listingForm.district.trim() || defaultDistrict,
      quality: listingForm.quality.trim() || null,
      status: "open",
      latitude: Number.isFinite(latitude) ? latitude : null,
      longitude: Number.isFinite(longitude) ? longitude : null,
    });

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setListingForm({ crop: "", quantity: "", district: defaultDistrict, minPrice: "", quality: "" });
    await fetchListings();
  }

  async function placeBid(listing: Listing) {
    if (!user || !canBid) {
      setError("Only buyer accounts can place bids.");
      return;
    }

    const value = Number(bidDrafts[listing.id]);
    if (!Number.isFinite(value) || value <= 0) {
      setError("Enter a valid bid amount.");
      return;
    }

    const guard = await fetch("/api/marketplace/price-guardian", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        commodity: listing.crop,
        district: listing.district,
        state: defaultState,
        bidPrice: value,
      }),
    }).then((response) => response.json() as Promise<PriceGuardianResult>);

    setGuardianMap((prev) => ({ ...prev, [listing.id]: guard }));

    const { error: insertError } = await supabase.from("bids").insert({
      listing_id: listing.id,
      buyer_id: user.id,
      price: value,
      status: "pending",
    });

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setBidDrafts((prev) => ({ ...prev, [listing.id]: "" }));
    await fetchListings();
  }

  async function acceptBid(listing: Listing, bid: Bid) {
    if (!user || listing.farmer_id !== user.id) {
      return;
    }

    await supabase.from("bids").update({ status: "accepted" }).eq("id", bid.id);
    await supabase.from("bids").update({ status: "rejected" }).eq("listing_id", listing.id).neq("id", bid.id);
    await supabase.from("listings").update({ status: "sold" }).eq("id", listing.id);

    await supabase.from("transactions").insert({
      listing_id: listing.id,
      bid_id: bid.id,
      farmer_id: listing.farmer_id,
      buyer_id: bid.buyer_id,
      price: bid.price,
      status: "completed",
    });

    await fetchListings();
  }

  const decoratedListings = useMemo(() => {
    return listings.map((listing) => {
      let km: number | null = null;
      if (
        Number.isFinite(latitude) &&
        Number.isFinite(longitude) &&
        Number.isFinite(listing.latitude) &&
        Number.isFinite(listing.longitude)
      ) {
        km = distanceKm(latitude as number, longitude as number, listing.latitude as number, listing.longitude as number);
      }

      return {
        ...listing,
        distanceKm: km,
        bids: bidsMap[listing.id] ?? [],
      };
    });
  }, [bidsMap, latitude, listings, longitude]);

  if (!user || !profile) {
    return <main className="min-h-screen bg-[#f7f8fa]" />;
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#f7f8fa] to-[#eef3f7] px-3 py-4 sm:px-5">
      <section className="mx-auto w-full max-w-5xl space-y-4">
        <header className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">Marketplace Community</p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">District-aware listings and live bidding</h1>
          <p className="mt-1 text-sm text-slate-600">Browse nearby deals, run AI fair-price checks, and complete transactions safely.</p>
        </header>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <form onSubmit={createListing} className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-lg font-semibold text-slate-900">Create Listing</h2>
            <p className="mt-1 text-xs text-slate-500">Only farmer accounts can publish new listings.</p>

            <div className="mt-3 space-y-2">
              <input
                value={listingForm.crop}
                onChange={(event) => setListingForm((prev) => ({ ...prev, crop: event.target.value }))}
                placeholder="Crop type"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                disabled={!canCreateListing}
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={listingForm.quantity}
                  onChange={(event) => setListingForm((prev) => ({ ...prev, quantity: event.target.value }))}
                  placeholder="Quantity"
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  disabled={!canCreateListing}
                />
                <input
                  value={listingForm.minPrice}
                  onChange={(event) => setListingForm((prev) => ({ ...prev, minPrice: event.target.value }))}
                  placeholder="Min price (₹)"
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  disabled={!canCreateListing}
                />
              </div>
              <input
                value={listingForm.district}
                onChange={(event) => setListingForm((prev) => ({ ...prev, district: event.target.value }))}
                placeholder="District"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                disabled={!canCreateListing}
              />
              <input
                value={listingForm.quality}
                onChange={(event) => setListingForm((prev) => ({ ...prev, quality: event.target.value }))}
                placeholder="Quality grade (AI assisted optional)"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                disabled={!canCreateListing}
              />
            </div>

            <button
              type="submit"
              className="mt-3 w-full rounded-2xl bg-sky-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              disabled={!canCreateListing}
            >
              Publish Listing
            </button>
          </form>

          <section className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-lg font-semibold text-slate-900">Buyer Filters</h2>
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
        </div>

        {!!notifications.length && (
          <section className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <h3 className="text-sm font-semibold text-slate-900">Real-time Events</h3>
            <div className="mt-2 space-y-1 text-xs text-slate-600">
              <AnimatePresence initial={false}>
                {notifications.map((item) => (
                  <motion.p
                    key={item.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.24 }}
                    className={item.type === "new_bid" ? "text-sky-700" : "text-emerald-700"}
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
          {loading && <p className="text-sm text-slate-500">Loading listings...</p>}

          {!loading && !decoratedListings.length && (
            <p className="rounded-2xl bg-white px-4 py-4 text-sm text-slate-600 ring-1 ring-slate-200">No listings found for the selected filters.</p>
          )}

          {decoratedListings.map((listing) => {
            const bids = listing.bids;
            const highest = bids[0];
            const guardian = guardianMap[listing.id];
            const isLiveHot = hotListingId === listing.id;

            return (
              <motion.article
                key={listing.id}
                layout
                animate={isLiveHot ? { scale: [1, 1.01, 1], boxShadow: ["0 2px 8px rgba(15,23,42,0.04)", "0 8px 22px rgba(14,165,233,0.22)", "0 2px 8px rgba(15,23,42,0.04)"] } : { scale: 1, boxShadow: "0 2px 8px rgba(15,23,42,0.04)" }}
                transition={{ duration: 0.7 }}
                className="rounded-3xl bg-white p-4 ring-1 ring-slate-200"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-lg font-semibold text-slate-900">{listing.crop} - {listing.quantity} Quintals</p>
                    <p className="text-xs text-slate-500">📍 {listing.district} · Farmer: {profileMap[listing.farmer_id]?.name || "Farmer"}</p>
                    {listing.distanceKm && <p className="text-xs text-slate-500">Distance: {listing.distanceKm.toFixed(1)} km</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-slate-500">Min Price</p>
                    <p className="text-xl font-bold text-sky-700">₹{listing.min_price}</p>
                  </div>
                </div>

                <motion.div
                  animate={isLiveHot ? { backgroundColor: ["#f8fafc", "#ecfeff", "#f8fafc"] } : { backgroundColor: "#f8fafc" }}
                  transition={{ duration: 1.1 }}
                  className="mt-3 rounded-2xl bg-slate-50 p-3"
                >
                  <p className="text-xs text-slate-500">Highest Bid</p>
                  <div className="flex items-center justify-between">
                    <p className="text-lg font-semibold text-emerald-700">{highest ? `₹${highest.price}` : "No bids yet"}</p>
                    {isLiveHot && <span className="rounded-full bg-sky-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-sky-700">Live update</span>}
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
                    disabled={!canBid || listing.status !== "open"}
                  />
                  <button
                    onClick={() => void placeBid(listing)}
                    className="rounded-xl bg-sky-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                    disabled={!canBid || listing.status !== "open"}
                  >
                    Place Bid
                  </button>
                </div>

                {listing.farmer_id === user.id && highest && listing.status === "open" && (
                  <button
                    onClick={() => void acceptBid(listing, highest)}
                    className="mt-3 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white"
                  >
                    Accept Highest Bid
                  </button>
                )}
              </motion.article>
            );
          })}
        </section>
      </section>
    </main>
  );
}
