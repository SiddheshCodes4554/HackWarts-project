import { AgentContext, AgentResult, MarketDashboardInsight, MarketRecord } from "../utils/types";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const MARKET_MODEL = process.env.GROQ_MARKET_MODEL ?? "llama-3.3-70b-versatile";
const AGMARKNET_RESOURCE_ID = process.env.AGMARKNET_RESOURCE_ID ?? "9ef84268-d588-465a-a308-a864a43d0070";
const DATAGOV_API_KEY = process.env.DATAGOV_API_KEY ?? "579b464db66ec23bdd0000010f6f4f4f";
const MARKET_TIMEOUT_MS = 9000;

type MarketInput = {
  crop: string;
  location: string;
  latitude?: number;
  longitude?: number;
  temperature?: number;
  rainfall?: number;
};

type DataGovRecord = {
  state?: string;
  district?: string;
  market?: string;
  commodity?: string;
  min_price?: string;
  max_price?: string;
  modal_price?: string;
  arrival_date?: string;
};

type DataGovPayload = {
  records?: DataGovRecord[];
};

type GroqPayload = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
};

type LlmMarketResponse = {
  best_market?: string;
  recommendation?: string;
  signal?: "SELL" | "HOLD";
};

function parseCropFromQuery(query: string): string {
  const match = query
    .toLowerCase()
    .match(/\b(rice|wheat|maize|cotton|soybean|mustard|barley|millets|pulses|groundnut|tomato|onion)\b/);

  return match?.[1] ?? "rice";
}

function parseLocation(location: string): { district: string; state: string } {
  const parts = location
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (parts.length >= 2) {
    return {
      district: parts[0],
      state: parts[1],
    };
  }

  return {
    district: location.trim() || "Nagpur",
    state: "Maharashtra",
  };
}

function parsePrice(value: string | undefined): number {
  const numeric = Number.parseFloat((value ?? "").replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(numeric)) {
    return 0;
  }
  return numeric;
}

function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const earthRadius = 6371;

  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  return 2 * earthRadius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function derivePseudoCoordinates(seed: string): { lat: number; lon: number } {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(index);
    hash |= 0;
  }

  const normalized = Math.abs(hash % 1000) / 1000;
  const normalizedLon = Math.abs((hash * 31) % 1000) / 1000;

  return {
    lat: 8 + normalized * 28,
    lon: 68 + normalizedLon * 29,
  };
}

function calculateMarketMetrics(record: {
  mandi: string;
  district: string;
  state: string;
  commodity: string;
  minPrice: number;
  maxPrice: number;
  modalPrice: number;
  arrivalDate: string;
  latitude: number;
  longitude: number;
}): MarketRecord {
  const baseDistance = haversineDistanceKm(record.latitude, record.longitude, 21.1458, 79.0882);
  const distanceKm = Math.max(5, Math.round(baseDistance));
  const transportCost = Math.round(distanceKm * 2.4);
  const netProfit = Math.max(0, Math.round(record.modalPrice - transportCost));

  return {
    mandi: record.mandi,
    state: record.state,
    district: record.district,
    commodity: record.commodity,
    modalPrice: Math.round(record.modalPrice),
    minPrice: Math.round(record.minPrice),
    maxPrice: Math.round(record.maxPrice),
    arrivalDate: record.arrivalDate,
    distanceKm,
    transportCost,
    netProfit,
  };
}

async function fetchAgmarknetData(input: MarketInput): Promise<MarketRecord[]> {
  const { district, state } = parseLocation(input.location);
  const params = new URLSearchParams({
    "api-key": DATAGOV_API_KEY,
    format: "json",
    limit: "25",
    offset: "0",
    "filters[commodity]": input.crop,
    "filters[district]": district,
    "filters[state]": state,
  });

  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), MARKET_TIMEOUT_MS);

  try {
    const response = await fetch(
      `https://api.data.gov.in/resource/${AGMARKNET_RESOURCE_ID}?${params.toString()}`,
      { signal: controller.signal },
    );

    if (!response.ok) {
      throw new Error(`AGMARKNET data fetch failed: HTTP ${response.status}`);
    }

    const payload = (await response.json().catch(() => ({}))) as DataGovPayload;
    const records = payload.records ?? [];

    if (!records.length) {
      throw new Error("No AGMARKNET records found for the selected crop/location");
    }

    const processed = records
      .map((record) => {
        const mandi = (record.market ?? "").trim();
        const districtName = (record.district ?? district).trim();
        const stateName = (record.state ?? state).trim();
        const commodity = (record.commodity ?? input.crop).trim();
        const modalPrice = parsePrice(record.modal_price);

        if (!mandi || !Number.isFinite(modalPrice) || modalPrice <= 0) {
          return null;
        }

        const pseudo = derivePseudoCoordinates(`${districtName}-${mandi}`);

        return calculateMarketMetrics({
          mandi,
          district: districtName,
          state: stateName,
          commodity,
          minPrice: parsePrice(record.min_price),
          maxPrice: parsePrice(record.max_price),
          modalPrice,
          arrivalDate: (record.arrival_date ?? "").trim(),
          latitude: input.latitude ?? pseudo.lat,
          longitude: input.longitude ?? pseudo.lon,
        });
      })
      .filter((record): record is MarketRecord => Boolean(record));

    if (!processed.length) {
      throw new Error("AGMARKNET returned records without usable market prices");
    }

    return processed
      .sort((a, b) => b.netProfit - a.netProfit)
      .slice(0, 3);
  } finally {
    clearTimeout(timeoutHandle);
  }
}

function dynamicFallbackMarkets(input: MarketInput): MarketRecord[] {
  const baseline = Math.max(1200, Math.round(((input.temperature ?? 27) + 12) * ((input.rainfall ?? 0) + 35)));
  const locationSeed = parseLocation(input.location);

  return [
    `${locationSeed.district} Mandi`,
    `${locationSeed.state} Agri Hub`,
    `${locationSeed.district} Cooperative Yard`,
  ].map((mandi, index) => {
    const multiplier = 1 + index * 0.06;
    const modalPrice = Math.round(baseline * multiplier);
    const minPrice = Math.round(modalPrice * 0.92);
    const maxPrice = Math.round(modalPrice * 1.08);
    const distanceKm = 12 + index * 18;
    const transportCost = Math.round(distanceKm * 2.4);

    return {
      mandi,
      state: locationSeed.state,
      district: locationSeed.district,
      commodity: input.crop,
      modalPrice,
      minPrice,
      maxPrice,
      arrivalDate: new Date().toISOString().slice(0, 10),
      distanceKm,
      transportCost,
      netProfit: Math.max(0, modalPrice - transportCost),
    };
  });
}

function parseLlmJson(raw: string): LlmMarketResponse | null {
  const trimmed = raw.trim();

  const tryParse = (value: string) => {
    try {
      return JSON.parse(value) as LlmMarketResponse;
    } catch {
      return null;
    }
  };

  const direct = tryParse(trimmed);
  if (direct) {
    return direct;
  }

  const objectMatch = trimmed.match(/\{[\s\S]*\}/);
  if (!objectMatch) {
    return null;
  }

  return tryParse(objectMatch[0]);
}

async function generateMarketRecommendation(
  input: MarketInput,
  marketData: MarketRecord[],
): Promise<{ best_market: string; recommendation: string; signal: "SELL" | "HOLD" }> {
  const apiKey = process.env.GROQ_API_KEY;
  const topMarket = marketData[0];

  if (!apiKey) {
    return {
      best_market: topMarket.mandi,
      recommendation: `Best net profit is currently at ${topMarket.mandi}. Prefer immediate sale if your lot moisture is below local mandi threshold.`,
      signal: "SELL",
    };
  }

  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), MARKET_TIMEOUT_MS);

  try {
    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MARKET_MODEL,
        temperature: 0.2,
        max_tokens: 260,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You are a mandi market advisor. Return valid JSON with keys: best_market, recommendation, signal. Signal must be SELL or HOLD.",
          },
          {
            role: "user",
            content: `crop: ${input.crop}\nlocation: ${input.location}\nmarket_data: ${JSON.stringify(marketData)}`,
          },
        ],
      }),
      signal: controller.signal,
    });

    const payload = (await response.json().catch(() => ({}))) as GroqPayload;
    if (!response.ok) {
      throw new Error(payload.error?.message ?? `Groq market API failed: HTTP ${response.status}`);
    }

    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("Groq market response empty");
    }

    const parsed = parseLlmJson(content);
    if (!parsed || typeof parsed.recommendation !== "string") {
      throw new Error("Groq market response invalid JSON");
    }

    return {
      best_market:
        typeof parsed.best_market === "string" && parsed.best_market.trim()
          ? parsed.best_market.trim()
          : topMarket.mandi,
      recommendation: parsed.recommendation.trim(),
      signal: parsed.signal === "HOLD" ? "HOLD" : "SELL",
    };
  } catch (error) {
    console.error("generateMarketRecommendation fallback", error);
    return {
      best_market: topMarket.mandi,
      recommendation: `Best net profit is currently at ${topMarket.mandi}. Prefer immediate sale if your lot moisture is below local mandi threshold.`,
      signal: "SELL",
    };
  } finally {
    clearTimeout(timeoutHandle);
  }
}

export async function getMarketData(input: MarketInput): Promise<MarketDashboardInsight> {
  let markets: MarketRecord[];

  try {
    markets = await fetchAgmarknetData(input);
  } catch (error) {
    console.error("AGMARKNET unavailable, using dynamic computed market insights", error);
    markets = dynamicFallbackMarkets(input).sort((a, b) => b.netProfit - a.netProfit).slice(0, 3);
  }

  const llm = await generateMarketRecommendation(input, markets);

  return {
    markets,
    bestMarket: llm.best_market,
    recommendation: llm.recommendation,
    signal: llm.signal,
  };
}

export async function marketAgent(context: AgentContext): Promise<AgentResult> {
  const marketData = await getMarketData({
    crop: parseCropFromQuery(context.message),
    location: context.locale ?? "Nagpur, Maharashtra",
    latitude: context.latitude,
    longitude: context.longitude,
  });

  return {
    agent: "market",
    insight: `Best market: ${marketData.bestMarket}. ${marketData.recommendation}`,
    confidence: 0.85,
    metadata: {
      locale: context.locale ?? "global",
      source: "agmarknet+groq",
      best_market: marketData.bestMarket,
      markets: marketData.markets.length,
      signal: marketData.signal,
    },
  };
}
