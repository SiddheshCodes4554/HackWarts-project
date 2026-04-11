import { Request, Response, Router } from "express";
import { getMarketIntelligence } from "../services/marketIntelligence";
import { addMarketAlertSubscription, listMarketAlertSubscriptions } from "../services/marketAlerts";
import { AgentContext } from "../utils/types";

const marketRouter = Router();

const MARKET_CACHE_TTL_MS = 4 * 60 * 60 * 1000;

function getDataGovBaseUrl(): string {
  return (process.env.AGMARKNET_API_URL ?? "https://api.data.gov.in/resource").replace(/\/$/, "");
}

function getDataGovResourceId(): string {
  return process.env.AGMARKNET_RESOURCE_ID ?? "9ef84268-d588-465a-a308-a864a43d0070";
}

function getDataGovApiKey(): string {
  return (process.env.AGMARKNET_API_KEY ?? process.env.DATAGOV_API_KEY ?? "").trim();
}

type CachedEntry = {
  expiresAt: number;
  payload: unknown;
};

type RawMarketRecord = {
  commodity?: string;
  market?: string;
  district?: string;
  state?: string;
  modal_price?: string;
  min_price?: string;
  max_price?: string;
  arrivals?: string;
  arrival_date?: string;
};

type TrendItem = {
  commodity: string;
  currentPrice: number;
  sevenDayAvg: number;
  changePct: number;
  trend: "RISING" | "FALLING" | "STABLE";
  demandSignal: "HIGH" | "MEDIUM" | "LOW";
};

const marketCache = new Map<string, CachedEntry>();

function getCacheKey(prefix: string, query: Record<string, unknown>): string {
  const parts = Object.entries(query)
    .filter(([, value]) => value !== undefined && value !== null && String(value).trim().length > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}:${String(value).trim().toLowerCase()}`);
  return `${prefix}|${parts.join("|")}`;
}

function fromCache<T>(key: string): T | null {
  const cached = marketCache.get(key);
  if (!cached) {
    return null;
  }

  if (cached.expiresAt < Date.now()) {
    marketCache.delete(key);
    return null;
  }

  return cached.payload as T;
}

function saveCache(key: string, payload: unknown): void {
  marketCache.set(key, {
    expiresAt: Date.now() + MARKET_CACHE_TTL_MS,
    payload,
  });
}

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeLocationToken(value: string): string {
  return value.replace(/[.,]/g, "").replace(/\s+/g, " ").trim();
}

function isUsefulLocationToken(value: string): boolean {
  const token = normalizeLocationToken(value).toLowerCase();
  return token.length >= 2 && token !== "na" && token !== "n/a" && token !== "unknown";
}

function parsePrice(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value.replace(/[^0-9.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function parseDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function classifyCommodityCategory(commodity: string): "Grains" | "Vegetables" | "Fruits" | "Other" {
  const normalized = commodity.toLowerCase();
  if (["wheat", "rice", "maize", "millet", "bajra", "jowar", "barley", "paddy", "gram", "soybean", "cotton"].some((item) => normalized.includes(item))) {
    return "Grains";
  }
  if (["tomato", "onion", "potato", "chilli", "cauliflower", "cabbage", "brinjal", "okra", "lady finger"].some((item) => normalized.includes(item))) {
    return "Vegetables";
  }
  if (["banana", "mango", "apple", "grape", "orange", "papaya", "guava", "pomegranate"].some((item) => normalized.includes(item))) {
    return "Fruits";
  }
  return "Other";
}

const FALLBACK_COMMODITIES = [
  { name: "Tomato", category: "Vegetables" },
  { name: "Onion", category: "Vegetables" },
  { name: "Wheat", category: "Grains" },
  { name: "Rice", category: "Grains" },
  { name: "Soybean", category: "Grains" },
  { name: "Cotton", category: "Grains" },
  { name: "Potato", category: "Vegetables" },
  { name: "Maize", category: "Grains" },
  { name: "Banana", category: "Fruits" },
  { name: "Mango", category: "Fruits" },
] as const;

function fallbackTrendingPayload() {
  return {
    rising: [
      { commodity: "Tomato", currentPrice: 2480, sevenDayAvg: 2220, changePct: 11.71, trend: "RISING" as const, demandSignal: "HIGH" as const },
      { commodity: "Onion", currentPrice: 2860, sevenDayAvg: 2660, changePct: 7.52, trend: "RISING" as const, demandSignal: "MEDIUM" as const },
      { commodity: "Soybean", currentPrice: 4780, sevenDayAvg: 4540, changePct: 5.29, trend: "RISING" as const, demandSignal: "MEDIUM" as const },
    ],
    falling: [
      { commodity: "Wheat", currentPrice: 2280, sevenDayAvg: 2405, changePct: -5.2, trend: "FALLING" as const, demandSignal: "LOW" as const },
      { commodity: "Rice", currentPrice: 3230, sevenDayAvg: 3350, changePct: -3.58, trend: "FALLING" as const, demandSignal: "LOW" as const },
      { commodity: "Cotton", currentPrice: 6150, sevenDayAvg: 6320, changePct: -2.69, trend: "FALLING" as const, demandSignal: "MEDIUM" as const },
    ],
    stable: [
      { commodity: "Potato", currentPrice: 2050, sevenDayAvg: 2040, changePct: 0.49, trend: "STABLE" as const, demandSignal: "MEDIUM" as const },
      { commodity: "Maize", currentPrice: 2140, sevenDayAvg: 2135, changePct: 0.23, trend: "STABLE" as const, demandSignal: "MEDIUM" as const },
      { commodity: "Banana", currentPrice: 3120, sevenDayAvg: 3135, changePct: -0.48, trend: "STABLE" as const, demandSignal: "MEDIUM" as const },
    ],
    mostProfitable: { commodity: "Tomato", currentPrice: 2480, sevenDayAvg: 2220, changePct: 11.71, trend: "RISING" as const, demandSignal: "HIGH" as const },
  };
}

function fallbackDetailsPayload(commodity: string, district: string, state: string) {
  return {
    commodity,
    district: district || "Pune",
    state: state || "Maharashtra",
    latestPrice: 2480,
    sevenDayAvg: 2310,
    changePct: 7.36,
    demandSignal: "HIGH",
    sellRecommendation: "Good time to sell based on recent trend and mandi spread.",
    aiInsights: [
      "Prices are holding above the short-term average, indicating positive market momentum.",
      "Arrivals are softer than average, suggesting better realization potential for sellers.",
      "Sell in the strongest nearby mandi if logistics are ready; otherwise hold 1-2 days.",
    ],
    priceTrend: [
      { date: "D-6", price: 2280, arrivals: 130 },
      { date: "D-5", price: 2310, arrivals: 124 },
      { date: "D-4", price: 2350, arrivals: 118 },
      { date: "D-3", price: 2390, arrivals: 110 },
      { date: "D-2", price: 2420, arrivals: 102 },
      { date: "D-1", price: 2460, arrivals: 96 },
      { date: "D0", price: 2480, arrivals: 92 },
    ],
    topMandis: [
      { market: "Pune Mandi", modalPrice: 2520, arrivals: 88 },
      { market: "Nashik Mandi", modalPrice: 2490, arrivals: 93 },
      { market: "Nagpur APMC", modalPrice: 2440, arrivals: 106 },
    ],
    source: "fallback",
  };
}

async function fetchAgmarknetRecords(filters: Record<string, string>): Promise<RawMarketRecord[]> {
  const dataGovApiKey = getDataGovApiKey();
  const dataGovBaseUrl = getDataGovBaseUrl();
  const dataGovResourceId = getDataGovResourceId();

  if (!dataGovApiKey) {
    throw new Error("AGMARKNET API key is missing");
  }

  const query = new URLSearchParams({
    "api-key": dataGovApiKey,
    format: "json",
    limit: "400",
  });

  for (const [key, value] of Object.entries(filters)) {
    if (value.trim()) {
      query.set(`filters[${key}]`, value.trim());
    }
  }

  const response = await fetch(`${dataGovBaseUrl}/${dataGovResourceId}?${query.toString()}`);
  if (!response.ok) {
    throw new Error(`AGMARKNET request failed: HTTP ${response.status}`);
  }

  const payload = (await response.json().catch(() => ({}))) as { records?: RawMarketRecord[] };
  return payload.records ?? [];
}

async function fetchAgmarknetRecordsWithFallback(attempts: Array<Record<string, string>>): Promise<RawMarketRecord[]> {
  let lastError: unknown = null;

  for (const attempt of attempts) {
    try {
      const records = await fetchAgmarknetRecords(attempt);
      if (records.length > 0) {
        return records;
      }
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError) {
    throw lastError;
  }

  return [];
}

function groupLatestPerCommodity(records: RawMarketRecord[]): TrendItem[] {
  const byCommodity = new Map<string, RawMarketRecord[]>();

  for (const record of records) {
    const commodity = normalizeText(record.commodity);
    if (!commodity) {
      continue;
    }

    const list = byCommodity.get(commodity) ?? [];
    list.push(record);
    byCommodity.set(commodity, list);
  }

  const items: TrendItem[] = [];

  for (const [commodity, commodityRecords] of byCommodity.entries()) {
    const sorted = commodityRecords
      .map((record) => ({
        record,
        date: parseDate(record.arrival_date),
      }))
      .filter((entry) => entry.date !== null)
      .sort((a, b) => (b.date as Date).getTime() - (a.date as Date).getTime());

    if (sorted.length < 2) {
      continue;
    }

    const latest = parsePrice(sorted[0].record.modal_price);
    if (latest <= 0) {
      continue;
    }

    const window = sorted.slice(0, 7).map((entry) => parsePrice(entry.record.modal_price)).filter((value) => value > 0);
    if (window.length < 2) {
      continue;
    }

    const sevenDayAvg = window.reduce((sum, value) => sum + value, 0) / window.length;
    const changePct = sevenDayAvg > 0 ? ((latest - sevenDayAvg) / sevenDayAvg) * 100 : 0;
    const latestArrivals = parsePrice(sorted[0].record.arrivals);
    const avgArrivals = sorted.slice(0, 7).map((entry) => parsePrice(entry.record.arrivals)).filter((value) => value > 0);
    const arrivalsAvg = avgArrivals.length > 0 ? avgArrivals.reduce((sum, value) => sum + value, 0) / avgArrivals.length : latestArrivals;

    const demandSignal: TrendItem["demandSignal"] = latestArrivals < arrivalsAvg * 0.9 ? "HIGH" : latestArrivals > arrivalsAvg * 1.1 ? "LOW" : "MEDIUM";
    const trend: TrendItem["trend"] = changePct > 1 ? "RISING" : changePct < -1 ? "FALLING" : "STABLE";

    items.push({
      commodity,
      currentPrice: Math.round(latest),
      sevenDayAvg: Math.round(sevenDayAvg),
      changePct: Number(changePct.toFixed(2)),
      trend,
      demandSignal,
    });
  }

  return items;
}

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

marketRouter.get("/market-intelligence", async (req: Request, res: Response) => {
  try {
    const message = typeof req.query.message === "string" ? req.query.message : "market price";
    const latitude = toNumber(req.query.latitude, NaN);
    const longitude = toNumber(req.query.longitude, NaN);
    const locale = typeof req.query.locale === "string" ? req.query.locale : undefined;

    const context: AgentContext = {
      message,
      locale,
      latitude: Number.isFinite(latitude) ? latitude : undefined,
      longitude: Number.isFinite(longitude) ? longitude : undefined,
      timestamp: new Date().toISOString(),
    };

    const result = await getMarketIntelligence(context);
    return res.status(200).json(result);
  } catch (error) {
    console.error("market-intelligence route error", error);
    return res.status(500).json({ error: "Unable to fetch market intelligence" });
  }
});

marketRouter.get("/commodities/list", async (req: Request, res: Response) => {
  try {
    const rawState = typeof req.query.state === "string" ? req.query.state : "";
    const rawDistrict = typeof req.query.district === "string" ? req.query.district : "";
    const state = isUsefulLocationToken(rawState) ? normalizeLocationToken(rawState) : "";
    const district = isUsefulLocationToken(rawDistrict) ? normalizeLocationToken(rawDistrict) : "";
    const search = typeof req.query.q === "string" ? req.query.q.trim().toLowerCase() : "";

    const cacheKey = getCacheKey("commodities", { state, district, search });
    const cached = fromCache<{ commodities: Array<{ name: string; category: string }> }>(cacheKey);
    if (cached) {
      return res.status(200).json(cached);
    }

    const records = await fetchAgmarknetRecordsWithFallback([
      { state, district },
      { state },
      { district },
      {},
    ]);
    if (!records.length) {
      return res.status(404).json({ error: "No commodity records found for the selected location" });
    }

    const unique = new Set<string>();
    for (const record of records) {
      const commodity = normalizeText(record.commodity);
      if (commodity) {
        unique.add(commodity);
      }
    }

    let list = Array.from(unique)
      .map((name) => ({ name, category: classifyCommodityCategory(name) }))
      .sort((a, b) => a.name.localeCompare(b.name));

    if (search) {
      list = list.filter((item) => item.name.toLowerCase().includes(search));
    }

    const payload = { commodities: list.slice(0, 120) };
    saveCache(cacheKey, payload);
    return res.status(200).json(payload);
  } catch (error) {
    console.error("commodities/list route error", error);
    const fallback = {
      commodities: FALLBACK_COMMODITIES,
      source: "fallback",
      warning: "Live commodity feed unavailable. Showing fallback list.",
    };
    return res.status(200).json(fallback);
  }
});

marketRouter.get("/market/trending", async (req: Request, res: Response) => {
  try {
    const rawState = typeof req.query.state === "string" ? req.query.state : "";
    const rawDistrict = typeof req.query.district === "string" ? req.query.district : "";
    const state = isUsefulLocationToken(rawState) ? normalizeLocationToken(rawState) : "";
    const district = isUsefulLocationToken(rawDistrict) ? normalizeLocationToken(rawDistrict) : "";

    const cacheKey = getCacheKey("trending", { state, district });
    const cached = fromCache<{
      rising: TrendItem[];
      falling: TrendItem[];
      stable: TrendItem[];
      mostProfitable: TrendItem | null;
    }>(cacheKey);
    if (cached) {
      return res.status(200).json(cached);
    }

    const records = await fetchAgmarknetRecordsWithFallback([
      { state, district },
      { state },
      { district },
      {},
    ]);
    if (!records.length) {
      return res.status(404).json({ error: "No market records found for trending analysis" });
    }

    const trendItems = groupLatestPerCommodity(records);
    const rising = trendItems.filter((item) => item.trend === "RISING").sort((a, b) => b.changePct - a.changePct).slice(0, 3);
    const falling = trendItems.filter((item) => item.trend === "FALLING").sort((a, b) => a.changePct - b.changePct).slice(0, 3);
    const stable = trendItems.filter((item) => item.trend === "STABLE").sort((a, b) => Math.abs(a.changePct) - Math.abs(b.changePct)).slice(0, 3);

    const mostProfitable = trendItems
      .slice()
      .sort((a, b) => {
        const demandBoostA = a.demandSignal === "HIGH" ? 3 : a.demandSignal === "MEDIUM" ? 1 : -1;
        const demandBoostB = b.demandSignal === "HIGH" ? 3 : b.demandSignal === "MEDIUM" ? 1 : -1;
        return b.changePct + demandBoostB - (a.changePct + demandBoostA);
      })[0] ?? null;

    const payload = { rising, falling, stable, mostProfitable };
    saveCache(cacheKey, payload);
    return res.status(200).json(payload);
  } catch (error) {
    console.error("market/trending route error", error);
    return res.status(200).json({
      ...fallbackTrendingPayload(),
      source: "fallback",
      warning: "Live trending feed unavailable. Showing fallback analytics.",
    });
  }
});

marketRouter.get("/market/details", async (req: Request, res: Response) => {
  try {
    const commodity = typeof req.query.commodity === "string" ? req.query.commodity.trim() : "";
    const rawDistrict = typeof req.query.district === "string" ? req.query.district.trim() : "";
    const rawState = typeof req.query.state === "string" ? req.query.state.trim() : "";
    const district = isUsefulLocationToken(rawDistrict) ? normalizeLocationToken(rawDistrict) : "";
    const state = isUsefulLocationToken(rawState) ? normalizeLocationToken(rawState) : "";

    if (!commodity) {
      return res.status(400).json({ error: "commodity is required" });
    }

    const cacheKey = getCacheKey("details", { commodity, district, state });
    const cached = fromCache<unknown>(cacheKey);
    if (cached) {
      return res.status(200).json(cached);
    }

    const records = await fetchAgmarknetRecordsWithFallback([
      { commodity, district, state },
      { commodity, state },
      { commodity, district },
      { commodity },
    ]);
    if (!records.length) {
      return res.status(404).json({ error: "No AGMARKNET records found for this commodity/location" });
    }

    const valid = records
      .map((record) => ({
        record,
        date: parseDate(record.arrival_date),
        price: parsePrice(record.modal_price),
        arrivals: parsePrice(record.arrivals),
      }))
      .filter((entry) => entry.date !== null && entry.price > 0)
      .sort((a, b) => (a.date as Date).getTime() - (b.date as Date).getTime());

    if (!valid.length) {
      return res.status(404).json({ error: "No usable price points found for analytics" });
    }

    const byDay = new Map<string, { totalPrice: number; count: number; arrivals: number }>();
    for (const entry of valid) {
      const day = (entry.date as Date).toISOString().slice(0, 10);
      const current = byDay.get(day) ?? { totalPrice: 0, count: 0, arrivals: 0 };
      current.totalPrice += entry.price;
      current.count += 1;
      current.arrivals += Math.max(0, entry.arrivals);
      byDay.set(day, current);
    }

    const priceTrend = Array.from(byDay.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-7)
      .map(([date, values]) => ({
        date,
        price: Math.round(values.totalPrice / Math.max(1, values.count)),
        arrivals: Math.round(values.arrivals / Math.max(1, values.count)),
      }));

    const latestDate = valid[valid.length - 1].date as Date;
    const latestDayKey = latestDate.toISOString().slice(0, 10);
    const latestRecords = valid.filter((entry) => (entry.date as Date).toISOString().slice(0, 10) === latestDayKey);

    const mandiMap = new Map<string, { market: string; modalPrice: number; arrivals: number }>();
    for (const entry of latestRecords) {
      const market = normalizeText(entry.record.market) || "Unknown Mandi";
      const existing = mandiMap.get(market);
      if (!existing || entry.price > existing.modalPrice) {
        mandiMap.set(market, {
          market,
          modalPrice: Math.round(entry.price),
          arrivals: Math.round(entry.arrivals),
        });
      }
    }

    const topMandis = Array.from(mandiMap.values()).sort((a, b) => b.modalPrice - a.modalPrice).slice(0, 3);

    const latestPrice = priceTrend[priceTrend.length - 1]?.price ?? valid[valid.length - 1].price;
    const sevenDayAvg = priceTrend.length > 0
      ? priceTrend.reduce((sum, point) => sum + point.price, 0) / priceTrend.length
      : latestPrice;
    const changePct = sevenDayAvg > 0 ? ((latestPrice - sevenDayAvg) / sevenDayAvg) * 100 : 0;

    const latestArrivals = priceTrend[priceTrend.length - 1]?.arrivals ?? 0;
    const avgArrivals = priceTrend.length > 0
      ? priceTrend.reduce((sum, point) => sum + point.arrivals, 0) / priceTrend.length
      : latestArrivals;

    const demandSignal = latestArrivals < avgArrivals * 0.9 ? "HIGH" : latestArrivals > avgArrivals * 1.1 ? "LOW" : "MEDIUM";
    const sellRecommendation = changePct > 3
      ? "Good time to sell based on current trend and mandi prices."
      : changePct < -3
        ? "Hold for a few days unless storage risk is high."
        : "Stable prices. Sell if cash flow is needed, otherwise monitor for 2-3 days.";

    const aiInsights = [
      changePct > 2
        ? "Prices are increasing versus the 7-day average, indicating stronger near-term market support."
        : "Price trend is flat to weak against the 7-day average.",
      demandSignal === "HIGH"
        ? "Lower arrivals suggest supply tightening; demand pressure appears favorable for sellers."
        : "Arrivals are moderate to high, signaling adequate supply in nearby mandis.",
      sellRecommendation,
    ];

    const payload = {
      commodity,
      district,
      state,
      latestPrice: Math.round(latestPrice),
      sevenDayAvg: Math.round(sevenDayAvg),
      changePct: Number(changePct.toFixed(2)),
      demandSignal,
      sellRecommendation,
      aiInsights,
      priceTrend,
      topMandis,
      source: "agmarknet",
    };

    saveCache(cacheKey, payload);
    return res.status(200).json(payload);
  } catch (error) {
    console.error("market/details route error", error);
    return res.status(200).json({
      ...fallbackDetailsPayload(
        typeof req.query.commodity === "string" ? req.query.commodity : "Commodity",
        typeof req.query.district === "string" ? req.query.district : "",
        typeof req.query.state === "string" ? req.query.state : "",
      ),
      warning: "Live commodity analytics unavailable. Showing fallback insight.",
    });
  }
});

marketRouter.post("/market/price-guardian", async (req: Request, res: Response) => {
  try {
    const commodity = typeof req.body?.commodity === "string" ? req.body.commodity.trim() : "";
    const rawDistrict = typeof req.body?.district === "string" ? req.body.district.trim() : "";
    const rawState = typeof req.body?.state === "string" ? req.body.state.trim() : "";
    const district = isUsefulLocationToken(rawDistrict) ? normalizeLocationToken(rawDistrict) : "";
    const state = isUsefulLocationToken(rawState) ? normalizeLocationToken(rawState) : "";
    const bidPrice = parsePrice(req.body?.bidPrice);

    if (!commodity || bidPrice <= 0) {
      return res.status(400).json({ error: "commodity and positive bidPrice are required" });
    }

    const records = await fetchAgmarknetRecordsWithFallback([
      { commodity, district, state },
      { commodity, state },
      { commodity, district },
      { commodity },
    ]);

    const validPrices = records
      .map((record) => ({
        date: parseDate(record.arrival_date),
        price: parsePrice(record.modal_price),
      }))
      .filter((entry) => entry.date !== null && entry.price > 0)
      .sort((a, b) => (b.date as Date).getTime() - (a.date as Date).getTime())
      .slice(0, 20)
      .map((entry) => entry.price);

    if (!validPrices.length) {
      return res.status(404).json({ error: "No live mandi price found for this commodity" });
    }

    const mandiPrice = validPrices.reduce((sum, value) => sum + value, 0) / validPrices.length;
    const fairPrice = mandiPrice * 0.92;
    const isFairDeal = bidPrice >= fairPrice;

    return res.status(200).json({
      commodity,
      district,
      state,
      mandiPrice: Math.round(mandiPrice),
      fairPrice: Math.round(fairPrice),
      bidPrice: Math.round(bidPrice),
      verdict: isFairDeal ? "Fair Deal" : "Bid too low",
      warning: isFairDeal ? null : "Bid is below fair price benchmark based on AGMARKNET mandi prices.",
    });
  } catch (error) {
    console.error("market/price-guardian route error", error);
    return res.status(500).json({ error: "Unable to evaluate bid fairness" });
  }
});

marketRouter.post("/market-alerts", (req: Request, res: Response) => {
  try {
    const commodity = typeof req.body?.commodity === "string" ? req.body.commodity.trim() : "";
    const contact = typeof req.body?.contact === "string" ? req.body.contact.trim() : "";
    const targetPrice = toNumber(req.body?.targetPrice, NaN);

    if (!commodity || !contact || !Number.isFinite(targetPrice)) {
      return res.status(400).json({ error: "commodity, contact, and targetPrice are required" });
    }

    const subscription = addMarketAlertSubscription({ commodity, contact, targetPrice });
    return res.status(201).json(subscription);
  } catch (error) {
    console.error("market-alerts route error", error);
    return res.status(500).json({ error: "Unable to save market alert" });
  }
});

marketRouter.get("/market-alerts", (_req: Request, res: Response) => {
  return res.status(200).json({ subscriptions: listMarketAlertSubscriptions() });
});

export { marketRouter };
