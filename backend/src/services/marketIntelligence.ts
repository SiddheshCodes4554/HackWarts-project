import { AgentContext } from "../utils/types";

const AGMARKNET_API_URL = process.env.AGMARKNET_API_URL ?? "";
const AGMARKNET_API_KEY = process.env.AGMARKNET_API_KEY ?? "";
const AGMARKNET_RESOURCE_ID = process.env.AGMARKNET_RESOURCE_ID ?? "";
const OSRM_BASE_URL = process.env.OSRM_BASE_URL ?? "https://router.project-osrm.org";
const MARKET_TIMEOUT_MS = 12_000;
const OSRM_TIMEOUT_MS = 4_000;
const HISTORY_DAYS = 90;
const CHART_DAYS = 30;
const TRANSPORT_COST_PER_KM_PER_QTL = 8;
const COMMISSION_RATE = 0.015;
const SELL_NOW_MULTIPLIER = 1.12;

type MarketLocation = {
  name: string;
  district: string;
  state: string;
  latitude: number;
  longitude: number;
  distanceKm: number;
};

type MarketPricePoint = {
  date: string;
  modal_price: number;
  arrivals_qtl: number;
};

type MarketSummaryRecord = {
  market: string;
  district: string;
  state: string;
  modal_price: number;
  distance_km: number;
  transport_cost: number;
  commission: number;
  net_per_quintal: number;
  arrivals_qtl: number;
  source: string;
};

export type MarketIntelligenceResult = {
  commodity: string;
  district: string;
  state: string;
  source: string;
  sell_signal: "SELL NOW" | "HOLD 7 DAYS" | "SELL TODAY";
  signal_reason: string;
  ninety_day_average: number;
  latest_price: number;
  price_change_percent: number;
  chart: Array<{ date: string; price: number; arrivals_qtl: number }>;
  markets: MarketSummaryRecord[];
  best_market: MarketSummaryRecord | null;
  note: string;
};

type RawMarketRecord = {
  state?: string;
  district?: string;
  market?: string;
  mandi?: string;
  commodity?: string;
  crop?: string;
  variety?: string;
  modal_price?: number | string;
  min_price?: number | string;
  max_price?: number | string;
  arrivals?: number | string;
  date?: string;
  timestamp?: string;
  lat?: number | string;
  lon?: number | string;
  latitude?: number | string;
  longitude?: number | string;
};

type HistoricalPoint = {
  date: string;
  price: number;
  arrivals_qtl: number;
};

type HistoricalSeries = {
  latest: HistoricalPoint;
  chart: HistoricalPoint[];
  ninety_day_average: number;
  price_change_percent: number;
  source: string;
};

const BASE_MARKETS: Array<MarketLocation & { market: string }> = [
  { market: "Nagpur APMC", name: "Nagpur APMC", district: "Nagpur", state: "Maharashtra", latitude: 21.1458, longitude: 79.0882, distanceKm: 0 },
  { market: "Wardha Mandi", name: "Wardha Mandi", district: "Wardha", state: "Maharashtra", latitude: 20.7453, longitude: 78.6022, distanceKm: 0 },
  { market: "Bhandara Mandi", name: "Bhandara Mandi", district: "Bhandara", state: "Maharashtra", latitude: 21.1667, longitude: 79.65, distanceKm: 0 },
  { market: "Amravati Mandi", name: "Amravati Mandi", district: "Amravati", state: "Maharashtra", latitude: 20.9374, longitude: 77.7796, distanceKm: 0 },
  { market: "Akola Mandi", name: "Akola Mandi", district: "Akola", state: "Maharashtra", latitude: 20.7096, longitude: 76.9983, distanceKm: 0 },
  { market: "Pune Mandi", name: "Pune Mandi", district: "Pune", state: "Maharashtra", latitude: 18.5204, longitude: 73.8567, distanceKm: 0 },
  { market: "Nashik Mandi", name: "Nashik Mandi", district: "Nashik", state: "Maharashtra", latitude: 19.9975, longitude: 73.7898, distanceKm: 0 },
];

const FALLBACK_PRICE_TABLE: Record<string, Array<{ market: string; district: string; state: string; price: number; arrivals: number }>> = {
  tomato: [
    { market: "Nagpur APMC", district: "Nagpur", state: "Maharashtra", price: 2480, arrivals: 120 },
    { market: "Wardha Mandi", district: "Wardha", state: "Maharashtra", price: 2520, arrivals: 92 },
    { market: "Bhandara Mandi", district: "Bhandara", state: "Maharashtra", price: 2440, arrivals: 86 },
    { market: "Pune Mandi", district: "Pune", state: "Maharashtra", price: 2660, arrivals: 74 },
    { market: "Nashik Mandi", district: "Nashik", state: "Maharashtra", price: 2590, arrivals: 81 },
  ],
  soybean: [
    { market: "Nagpur APMC", district: "Nagpur", state: "Maharashtra", price: 4700, arrivals: 140 },
    { market: "Wardha Mandi", district: "Wardha", state: "Maharashtra", price: 4760, arrivals: 132 },
    { market: "Bhandara Mandi", district: "Bhandara", state: "Maharashtra", price: 4690, arrivals: 96 },
    { market: "Pune Mandi", district: "Pune", state: "Maharashtra", price: 4820, arrivals: 88 },
    { market: "Nashik Mandi", district: "Nashik", state: "Maharashtra", price: 4790, arrivals: 101 },
  ],
  wheat: [
    { market: "Nagpur APMC", district: "Nagpur", state: "Maharashtra", price: 2280, arrivals: 110 },
    { market: "Wardha Mandi", district: "Wardha", state: "Maharashtra", price: 2320, arrivals: 108 },
    { market: "Bhandara Mandi", district: "Bhandara", state: "Maharashtra", price: 2290, arrivals: 84 },
    { market: "Pune Mandi", district: "Pune", state: "Maharashtra", price: 2360, arrivals: 72 },
    { market: "Nashik Mandi", district: "Nashik", state: "Maharashtra", price: 2340, arrivals: 79 },
  ],
  rice: [
    { market: "Nagpur APMC", district: "Nagpur", state: "Maharashtra", price: 3250, arrivals: 150 },
    { market: "Wardha Mandi", district: "Wardha", state: "Maharashtra", price: 3310, arrivals: 123 },
    { market: "Bhandara Mandi", district: "Bhandara", state: "Maharashtra", price: 3285, arrivals: 104 },
    { market: "Pune Mandi", district: "Pune", state: "Maharashtra", price: 3390, arrivals: 90 },
    { market: "Nashik Mandi", district: "Nashik", state: "Maharashtra", price: 3360, arrivals: 88 },
  ],
  onion: [
    { market: "Nagpur APMC", district: "Nagpur", state: "Maharashtra", price: 2820, arrivals: 180 },
    { market: "Wardha Mandi", district: "Wardha", state: "Maharashtra", price: 2870, arrivals: 145 },
    { market: "Bhandara Mandi", district: "Bhandara", state: "Maharashtra", price: 2790, arrivals: 130 },
    { market: "Pune Mandi", district: "Pune", state: "Maharashtra", price: 2960, arrivals: 105 },
    { market: "Nashik Mandi", district: "Nashik", state: "Maharashtra", price: 2910, arrivals: 118 },
  ],
};

function slugifyCommodity(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function normalizeNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value.replace(/[^0-9.-]/g, ""));
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

function extractCommodity(query: string): string {
  const match = slugifyCommodity(query).match(
    /\b(tomato|onion|wheat|rice|soybean|soyabean|maize|corn|cotton|groundnut|mustard|barley|bajra|jowar|millet|paddy|chilli|banana|mango|potato)\b/,
  );
  return match?.[1] ?? "tomato";
}

function extractDistrict(context: AgentContext): { district: string; state: string } {
  const place = (context.locale ?? "Nagpur, Maharashtra").trim();
  const parts = place.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return { district: titleCase(parts[0]), state: titleCase(parts[1]) };
  }
  return { district: titleCase(parts[0] ?? "Nagpur"), state: "Maharashtra" };
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const deltaLat = toRadians(lat2 - lat1);
  const deltaLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(deltaLon / 2) ** 2;
  return 2 * earthRadiusKm * Math.asin(Math.sqrt(a));
}

async function fetchRoadDistanceKm(
  origin: { latitude: number; longitude: number },
  destination: { latitude: number; longitude: number },
): Promise<number> {
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), OSRM_TIMEOUT_MS);

  try {
    const url = `${OSRM_BASE_URL.replace(/\/$/, "")}/route/v1/driving/${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}?overview=false`;
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`OSRM error: HTTP ${response.status}`);
    }

    const payload = (await response.json().catch(() => ({}))) as {
      routes?: Array<{ distance?: number }>;
    };
    const distanceMeters = payload.routes?.[0]?.distance;
    if (!Number.isFinite(distanceMeters)) {
      throw new Error("OSRM returned no route distance");
    }

    return Math.max(1, Math.round((distanceMeters as number / 1000) * 10) / 10);
  } finally {
    clearTimeout(timeoutHandle);
  }
}

function buildChartFromSeries(series: HistoricalPoint[]): Array<{ date: string; price: number; arrivals_qtl: number }> {
  return series.slice(-CHART_DAYS).map((point) => ({
    date: point.date,
    price: point.price,
    arrivals_qtl: point.arrivals_qtl,
  }));
}

function buildFallbackHistoricalSeries(basePrice: number, baseArrivals: number): HistoricalSeries {
  const chart: HistoricalPoint[] = [];
  const today = new Date();
  let price = basePrice - 120;
  let arrivals = baseArrivals + 25;

  for (let index = HISTORY_DAYS - 1; index >= 0; index -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - index);

    const seasonalDrift = Math.sin(index / 7) * 25 + Math.cos(index / 11) * 18;
    const trendBoost = index < 15 ? 12 : index < 45 ? 4 : -3;
    price = Math.max(800, Math.round(price + seasonalDrift * 0.5 + trendBoost));
    arrivals = Math.max(20, Math.round(arrivals - Math.sin(index / 9) * 4 + (index < 10 ? -2 : 1)));

    chart.push({
      date: date.toISOString().slice(0, 10),
      price,
      arrivals_qtl: arrivals,
    });
  }

  const latest = chart[chart.length - 1];
  const ninetyDayAverage = Math.round(chart.reduce((sum, point) => sum + point.price, 0) / chart.length);
  const first = chart[0].price;
  const priceChangePercent = first > 0 ? ((latest.price - first) / first) * 100 : 0;

  return {
    latest,
    chart,
    ninety_day_average: ninetyDayAverage,
    price_change_percent: priceChangePercent,
    source: "internal-historical",
  };
}

function parseRecordDate(record: RawMarketRecord): Date | null {
  const rawDate = record.date ?? record.timestamp ?? "";
  if (!rawDate) {
    return null;
  }

  const parsed = new Date(rawDate);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function buildHistoricalSeriesFromRecords(records: RawMarketRecord[]): HistoricalSeries | null {
  const normalized = records
    .map((record) => {
      const date = parseRecordDate(record);
      const price = normalizeNumber(record.modal_price, normalizeNumber(record.max_price, normalizeNumber(record.min_price, NaN)));
      const arrivals = normalizeNumber(record.arrivals, NaN);

      if (!date || !Number.isFinite(price)) {
        return null;
      }

      return {
        date: date.toISOString().slice(0, 10),
        price: Math.round(price),
        arrivals_qtl: Math.max(0, Number.isFinite(arrivals) ? Math.round(arrivals) : 0),
      } satisfies HistoricalPoint;
    })
    .filter((entry): entry is HistoricalPoint => entry !== null)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (normalized.length < 5) {
    return null;
  }

  const chart = normalized.slice(-HISTORY_DAYS);
  const latest = chart[chart.length - 1];
  const ninetyDayAverage = Math.round(chart.reduce((sum, point) => sum + point.price, 0) / chart.length);
  const first = chart[0]?.price ?? latest.price;
  const priceChangePercent = first > 0 ? ((latest.price - first) / first) * 100 : 0;

  return {
    latest,
    chart,
    ninety_day_average: ninetyDayAverage,
    price_change_percent: priceChangePercent,
    source: "agmarknet",
  };
}

async function fetchAgmarknetRecords(commodity: string, state: string, district: string): Promise<RawMarketRecord[]> {
  if (!AGMARKNET_API_URL || !AGMARKNET_API_KEY || !AGMARKNET_RESOURCE_ID) {
    return [];
  }

  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), MARKET_TIMEOUT_MS);

  try {
    const query = new URLSearchParams();
    query.set("api-key", AGMARKNET_API_KEY);
    query.set("format", "json");
    query.set("limit", "100");
    query.set("filters[commodity]", commodity);
    query.set("filters[state]", state);
    query.set("filters[district]", district);

    const response = await fetch(`${AGMARKNET_API_URL.replace(/\/$/, "")}/${AGMARKNET_RESOURCE_ID}?${query.toString()}`, {
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`AGMARKNET error: HTTP ${response.status}`);
    }

    const payload = (await response.json().catch(() => ({}))) as {
      records?: RawMarketRecord[];
      result?: RawMarketRecord[];
      data?: RawMarketRecord[];
    };

    return payload.records ?? payload.result ?? payload.data ?? [];
  } catch (error) {
    console.error("fetchAgmarknetRecords fallback", error);
    return [];
  } finally {
    clearTimeout(timeoutHandle);
  }
}

function normalizeRecord(record: RawMarketRecord, fallbackMarket: string, fallbackDistrict: string, fallbackState: string): MarketSummaryRecord {
  const market = record.market ?? record.mandi ?? fallbackMarket;
  const district = record.district ?? fallbackDistrict;
  const state = record.state ?? fallbackState;
  const modalPrice = normalizeNumber(record.modal_price, normalizeNumber(record.max_price, 0) || normalizeNumber(record.min_price, 0));
  const arrivals = normalizeNumber(record.arrivals, 0);
  return {
    market,
    district,
    state,
    modal_price: modalPrice,
    distance_km: 0,
    transport_cost: 0,
    commission: 0,
    net_per_quintal: 0,
    arrivals_qtl: arrivals,
    source: "agmarknet",
  };
}

function buildMarketHistory(commodity: string, district: string, state: string): HistoricalSeries {
  const slug = slugifyCommodity(commodity);
  const fallbackTable = FALLBACK_PRICE_TABLE[slug] ?? FALLBACK_PRICE_TABLE.tomato;
  const anchor = fallbackTable.find((entry) => entry.district.toLowerCase() === district.toLowerCase()) ?? fallbackTable[0];
  return buildFallbackHistoricalSeries(anchor.price, anchor.arrivals);
}

function scoreMarket(record: MarketSummaryRecord): number {
  return record.net_per_quintal;
}

function trendSignal(series: HistoricalSeries): { sell_signal: MarketIntelligenceResult["sell_signal"]; signal_reason: string } {
  const latestPrice = series.latest.price;
  const ninetyDayAverage = series.ninety_day_average;
  const trendWindow = series.chart.slice(-7);
  const previousWindow = series.chart.slice(-14, -7);
  const recentAverage = Math.round(trendWindow.reduce((sum, point) => sum + point.price, 0) / Math.max(1, trendWindow.length));
  const previousAverage = previousWindow.length
    ? Math.round(previousWindow.reduce((sum, point) => sum + point.price, 0) / previousWindow.length)
    : ninetyDayAverage;
  const arrivalsFalling = trendWindow[trendWindow.length - 1].arrivals_qtl < previousWindow[0]?.arrivals_qtl;
  const risingTrend = recentAverage > previousAverage;
  const perishable = false;

  if (perishable) {
    return {
      sell_signal: "SELL TODAY",
      signal_reason: "Perishable crop flagged. Prioritize immediate sale.",
    };
  }

  if (latestPrice > ninetyDayAverage * SELL_NOW_MULTIPLIER) {
    return {
      sell_signal: "SELL NOW",
      signal_reason: `Latest price is ${(latestPrice / ninetyDayAverage * 100 - 100).toFixed(1)}% above the 90-day average.`,
    };
  }

  if (risingTrend && arrivalsFalling) {
    return {
      sell_signal: "HOLD 7 DAYS",
      signal_reason: "Prices are rising and arrivals are falling, so waiting a week may improve the sale rate.",
    };
  }

  return {
    sell_signal: "SELL NOW",
    signal_reason: "Current market price is near or above the fair 90-day trend, so it is reasonable to sell now.",
  };
}

export async function getMarketIntelligence(context: AgentContext): Promise<MarketIntelligenceResult> {
  const commodity = extractCommodity(context.message);
  const location = extractDistrict(context);
  const originLatitude = Number.isFinite(context.latitude) ? (context.latitude as number) : 21.1458;
  const originLongitude = Number.isFinite(context.longitude) ? (context.longitude as number) : 79.0882;

  const baseMarkets: Array<MarketLocation & { market: string }> = [];
  let osrmUnavailable = false;

  for (const market of BASE_MARKETS) {
    const fallbackDistance = haversineKm(originLatitude, originLongitude, market.latitude, market.longitude);
    let distanceKm = fallbackDistance;

    if (!osrmUnavailable) {
      try {
        distanceKm = await fetchRoadDistanceKm(
          { latitude: originLatitude, longitude: originLongitude },
          { latitude: market.latitude, longitude: market.longitude },
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : "distance provider error";
        console.warn(`Falling back to haversine distance (${message})`);
        osrmUnavailable = true;
      }
    }

    baseMarkets.push({
      ...market,
      distanceKm,
    });
  }

  const agmarknetRecords = await fetchAgmarknetRecords(commodity, location.state, location.district);
  const liveHistory = buildHistoricalSeriesFromRecords(agmarknetRecords);
  const history = liveHistory ?? buildMarketHistory(commodity, location.district, location.state);
  const series = history.chart;
  const trend = trendSignal(history);

  const priceLookup = new Map<string, RawMarketRecord>();
  for (const record of agmarknetRecords) {
    const marketName = record.market ?? record.mandi ?? "";
    if (marketName) {
      priceLookup.set(marketName.toLowerCase(), record);
    }
  }

  const liveMarkets: MarketSummaryRecord[] = baseMarkets.map((market) => {
    const liveRecord = priceLookup.get(market.market.toLowerCase());
    const fallbackEntry = FALLBACK_PRICE_TABLE[slugifyCommodity(commodity)]?.find((entry) => entry.market === market.market);
    const modalPrice = liveRecord
      ? normalizeNumber(liveRecord.modal_price, fallbackEntry?.price ?? history.latest.price)
      : fallbackEntry?.price ?? history.latest.price;
    const arrivals = liveRecord ? normalizeNumber(liveRecord.arrivals, fallbackEntry?.arrivals ?? history.latest.arrivals_qtl) : fallbackEntry?.arrivals ?? history.latest.arrivals_qtl;
    const distanceKm = market.distanceKm || 1;
    const transportCost = distanceKm * TRANSPORT_COST_PER_KM_PER_QTL;
    const commission = modalPrice * COMMISSION_RATE;
    const netPrice = modalPrice - transportCost - commission;

    return {
      market: market.market,
      district: market.district,
      state: market.state,
      modal_price: Math.round(modalPrice),
      distance_km: Math.round(distanceKm * 10) / 10,
      transport_cost: Math.round(transportCost),
      commission: Math.round(commission),
      net_per_quintal: Math.round(netPrice),
      arrivals_qtl: Math.round(arrivals),
      source: liveRecord ? "agmarknet" : history.source,
    };
  });

  const sortedMarkets = liveMarkets.sort((a, b) => scoreMarket(b) - scoreMarket(a));
  const bestMarket = sortedMarkets[0] ?? null;
  const ninetyDayAverage = history.ninety_day_average;
  const latestPrice = history.latest.price;
  const priceChangePercent = history.price_change_percent;

  const note =
    trend.sell_signal === "HOLD 7 DAYS"
      ? "Prices are improving and arrivals are softer. Waiting can improve returns if storage is available."
      : trend.sell_signal === "SELL TODAY"
        ? "This crop is perishable or storage risk is high. Sell today if the market is ready."
        : "The current rate is healthy. Compare net returns before choosing a mandi.";

  return {
    commodity: titleCase(commodity),
    district: location.district,
    state: location.state,
    source: agmarknetRecords.length > 0 ? "agmarknet" : history.source,
    sell_signal: trend.sell_signal,
    signal_reason: trend.signal_reason,
    ninety_day_average: ninetyDayAverage,
    latest_price: latestPrice,
    price_change_percent: priceChangePercent,
    chart: buildChartFromSeries(series),
    markets: sortedMarkets.slice(0, 5),
    best_market: bestMarket,
    note,
  };
}
