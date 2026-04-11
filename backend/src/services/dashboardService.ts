import { cropAgent } from "../agents/cropAgent";
import { getFinancialAdvice } from "../agents/financeAgent";
import { weatherAgent } from "../agents/weatherAgent";
import { getMarketIntelligence } from "./marketIntelligence";
import { generateResponse } from "./groqService";
import { DashboardData, DashboardLocation, FinancialUserProfile, SoilProfile } from "../utils/types";
import { getSoilProfile } from "./soilService";

type WeatherCurrent = {
  temperature: number;
  humidity: number;
  windSpeed: number;
  rainProbability: number;
  icon: string;
  description: string;
};

type WeatherForecastPoint = {
  label: string;
  temperature: number;
  rainProbability: number;
  humidity: number;
};

type OpenWeatherResponse = {
  weather?: Array<{ description?: string; icon?: string }>;
  main?: { temp?: number; humidity?: number };
  wind?: { speed?: number };
};

type OpenWeatherForecastResponse = {
  list?: Array<{
    dt_txt?: string;
    main?: { temp?: number; humidity?: number };
    pop?: number;
  }>;
};

type CacheEntry<T> = {
  expiresAt: number;
  data: T;
};

const OPENWEATHER_BASE_URL = "https://api.openweathermap.org/data/2.5";
const WEATHER_TTL_MS = 10 * 60 * 1000;
const SOIL_TTL_MS = 24 * 60 * 60 * 1000;
const MANDI_TTL_MS = 4 * 60 * 60 * 1000;

const weatherCache = new Map<string, CacheEntry<{ current: WeatherCurrent; forecast: WeatherForecastPoint[] }>>();
const soilCache = new Map<string, CacheEntry<SoilProfile>>();
const mandiCache = new Map<string, CacheEntry<Awaited<ReturnType<typeof getMarketIntelligence>>>>();

function round(value: number, digits = 1): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function createCacheKey(location: DashboardLocation): string {
  return `${round(location.latitude, 3)}:${round(location.longitude, 3)}:${location.placeName.toLowerCase()}`;
}

function fromCache<T>(cache: Map<string, CacheEntry<T>>, key: string): T | null {
  const cached = cache.get(key);
  if (!cached) {
    return null;
  }

  if (cached.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }

  return cached.data;
}

function saveCache<T>(cache: Map<string, CacheEntry<T>>, key: string, ttlMs: number, data: T) {
  cache.set(key, {
    expiresAt: Date.now() + ttlMs,
    data,
  });
}

async function fetchOpenWeatherCurrent(location: DashboardLocation): Promise<WeatherCurrent> {
  const apiKey = process.env.OPENWEATHER_API_KEY?.trim() || process.env.NEXT_PUBLIC_OPENWEATHER_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OpenWeather API key is missing");
  }

  const params = new URLSearchParams({
    lat: String(location.latitude),
    lon: String(location.longitude),
    appid: apiKey,
    units: "metric",
  });

  const response = await fetch(`${OPENWEATHER_BASE_URL}/weather?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`OpenWeather current failed: HTTP ${response.status}`);
  }

  const payload = (await response.json()) as OpenWeatherResponse;

  return {
    temperature: round(Number(payload.main?.temp ?? 0)),
    humidity: round(Number(payload.main?.humidity ?? 0)),
    windSpeed: round(Number(payload.wind?.speed ?? 0)),
    rainProbability: 0,
    icon: payload.weather?.[0]?.icon ?? "01d",
    description: payload.weather?.[0]?.description ?? "Current weather",
  };
}

async function fetchOpenWeatherForecast(location: DashboardLocation): Promise<WeatherForecastPoint[]> {
  const apiKey = process.env.OPENWEATHER_API_KEY?.trim() || process.env.NEXT_PUBLIC_OPENWEATHER_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OpenWeather API key is missing");
  }

  const params = new URLSearchParams({
    lat: String(location.latitude),
    lon: String(location.longitude),
    appid: apiKey,
    units: "metric",
  });

  const response = await fetch(`${OPENWEATHER_BASE_URL}/forecast?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`OpenWeather forecast failed: HTTP ${response.status}`);
  }

  const payload = (await response.json()) as OpenWeatherForecastResponse;
  const points = (payload.list ?? []).slice(0, 7);

  return points.map((point, index) => ({
    label: point.dt_txt ? point.dt_txt.slice(5, 16) : `P${index + 1}`,
    temperature: round(Number(point.main?.temp ?? 0)),
    rainProbability: round(Number(point.pop ?? 0) * 100),
    humidity: round(Number(point.main?.humidity ?? 0)),
  }));
}

function normalizeSoilHealth(soil: SoilProfile): number {
  const phScore = Math.max(0, 100 - Math.abs(soil.ph - 6.8) * 20);
  const nitrogenScore = Math.min(100, Math.max(0, (soil.nitrogen / 0.35) * 100));
  const carbonScore = Math.min(100, Math.max(0, (soil.organicCarbon / 2.0) * 100));
  return round((phScore + nitrogenScore + carbonScore) / 3, 0);
}

function fallbackInsights(data: {
  weather: WeatherCurrent;
  soil: SoilProfile & { healthScore: number };
  marketSignal: string;
}): string[] {
  const insights: string[] = [];

  if (data.weather.humidity >= 80) {
    insights.push("High humidity increases pest/fungal risk. Inspect leaves and improve airflow.");
  }

  if (data.weather.rainProbability >= 60) {
    insights.push("Rain probability is high. Delay irrigation and protect fertilizer application timing.");
  }

  if (data.soil.healthScore < 55) {
    insights.push("Soil health score is low. Add compost and rebalance nutrients before next sowing window.");
  } else if (data.soil.nitrogen < 0.15) {
    insights.push("Nitrogen appears low. Consider split-dose nitrogen application this week.");
  }

  if (data.marketSignal.includes("HOLD")) {
    insights.push("Market trend suggests holding produce for a short window may improve realization.");
  } else {
    insights.push("Current mandi trend supports selling now if logistics are ready.");
  }

  return insights.slice(0, 3);
}

async function generateInsights(data: {
  location: DashboardLocation;
  weather: WeatherCurrent;
  soil: SoilProfile & { healthScore: number };
  market: Awaited<ReturnType<typeof getMarketIntelligence>>;
}): Promise<string[]> {
  const fallback = fallbackInsights({
    weather: data.weather,
    soil: data.soil,
    marketSignal: data.market.sell_signal,
  });

  try {
    const prompt = [
      "You are an agricultural decision-support analyst.",
      `Location: ${data.location.placeName}`,
      `Weather: ${JSON.stringify(data.weather)}`,
      `Soil: ${JSON.stringify(data.soil)}`,
      `Market: ${JSON.stringify({
        signal: data.market.sell_signal,
        reason: data.market.signal_reason,
        latest_price: data.market.latest_price,
        ninety_day_average: data.market.ninety_day_average,
      })}`,
      "Return exactly 3 concise bullet insights as plain text, each on a new line, actionable and farmer-friendly.",
    ].join("\n");

    const generated = await generateResponse(prompt);
    const lines = generated.message
      .split(/\r?\n/)
      .map((line) => line.replace(/^[-*\d.)\s]+/, "").trim())
      .filter(Boolean);

    if (lines.length === 0) {
      return fallback;
    }

    return lines.slice(0, 3);
  } catch {
    return fallback;
  }
}

async function getWeatherBundle(location: DashboardLocation): Promise<{ current: WeatherCurrent; forecast: WeatherForecastPoint[] }> {
  const key = createCacheKey(location);
  const cached = fromCache(weatherCache, key);
  if (cached) {
    return cached;
  }

  const [current, forecast] = await Promise.all([
    fetchOpenWeatherCurrent(location),
    fetchOpenWeatherForecast(location),
  ]);

  const mergedCurrent = {
    ...current,
    rainProbability: forecast[0]?.rainProbability ?? 0,
  };

  const bundle = { current: mergedCurrent, forecast };
  saveCache(weatherCache, key, WEATHER_TTL_MS, bundle);
  return bundle;
}

async function getSoilBundle(location: DashboardLocation): Promise<SoilProfile> {
  const key = createCacheKey(location);
  const cached = fromCache(soilCache, key);
  if (cached) {
    return cached;
  }

  const soil = await getSoilProfile(location.latitude, location.longitude);
  saveCache(soilCache, key, SOIL_TTL_MS, soil);
  return soil;
}

async function getMandiBundle(location: DashboardLocation): Promise<Awaited<ReturnType<typeof getMarketIntelligence>>> {
  const key = createCacheKey(location);
  const cached = fromCache(mandiCache, key);
  if (cached) {
    return cached;
  }

  const context = {
    message: "market intelligence for dashboard",
    locale: location.placeName,
    latitude: location.latitude,
    longitude: location.longitude,
    timestamp: new Date().toISOString(),
  };

  const market = await getMarketIntelligence(context);
  saveCache(mandiCache, key, MANDI_TTL_MS, market);
  return market;
}

export async function getDashboardData(location: DashboardLocation): Promise<DashboardData> {
  const timestamp = new Date().toISOString();
  const context = {
    message: `Dashboard intelligence request for ${location.placeName}`,
    locale: location.placeName,
    latitude: location.latitude,
    longitude: location.longitude,
    timestamp,
  };

  const financeProfile: FinancialUserProfile = {
    landOwned: false,
    cropType: "",
    location: location.placeName,
    incomeLevel: "medium",
  };

  const [weatherBundle, soilRaw, market, finance] = await Promise.all([
    getWeatherBundle(location),
    getSoilBundle(location),
    getMandiBundle(location),
    getFinancialAdvice(financeProfile),
  ]);

  const weatherAgentResult = await weatherAgent(context);
  const weatherForCrop = {
    temperature: Number(weatherAgentResult.metadata?.temperature ?? weatherBundle.current.temperature),
    rainfall: Number(weatherAgentResult.metadata?.rainfall ?? 0),
    humidity: Number(weatherAgentResult.metadata?.humidity ?? weatherBundle.current.humidity),
    windSpeed: Number(weatherAgentResult.metadata?.windSpeed ?? weatherBundle.current.windSpeed),
    advice: typeof weatherAgentResult.metadata?.advice === "string" ? weatherAgentResult.metadata.advice : "",
  };

  const soil = {
    ...soilRaw,
    healthScore: normalizeSoilHealth(soilRaw),
  };

  const crops = await cropAgent(context, weatherForCrop, soilRaw);
  const insights = await generateInsights({
    location,
    weather: weatherBundle.current,
    soil,
    market,
  });

  return {
    weather: weatherBundle,
    soil,
    market: {
      markets: market.markets.map((item) => ({
        mandi: item.market,
        state: item.state,
        district: item.district,
        commodity: market.commodity,
        modalPrice: item.modal_price,
        minPrice: item.modal_price,
        maxPrice: item.modal_price,
        arrivalDate: timestamp,
        distanceKm: item.distance_km,
        transportCost: item.transport_cost,
        netProfit: item.net_per_quintal,
      })),
      bestMarket: market.best_market?.market ?? market.best_market?.district ?? "-",
      recommendation: market.note,
      signal: market.sell_signal.includes("HOLD") ? "HOLD" : "SELL",
      trend: market.chart.slice(-7).map((point) => ({
        date: point.date,
        price: point.price,
        arrivals: point.arrivals_qtl,
      })),
    },
    crops,
    finance: {
      schemes: finance.schemes.slice(0, 3).map((scheme, index) => ({
        name: scheme.name,
        benefit: scheme.benefit,
        amountINR: Math.max(5000, 12000 - index * 1500),
        eligibility: scheme.eligibility.join("; "),
      })),
      advice: finance.advice,
    },
    insights,
  };
}
