import { AgentContext, AgentResult } from "../utils/types";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const MARKET_MODEL = process.env.GROQ_MARKET_MODEL ?? "llama-3.3-70b-versatile";
const MARKET_TIMEOUT_MS = 7000;

type MarketInput = {
  crop: string;
  location: string;
};

type MarketRecord = {
  market: string;
  price: number;
  distance: number;
  transport_cost: number;
  net_price: number;
};

type MarketOutput = {
  markets: MarketRecord[];
  best_market: string;
  recommendation: string;
};

type LlmMarketResponse = {
  best_market?: string;
  recommendation?: string;
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

const BASE_DATASET = [
  { market: "Pune", price: 2200, distance: 10 },
  { market: "Nashik", price: 2500, distance: 180 },
  { market: "Solapur", price: 2300, distance: 250 },
];

function parseCropFromQuery(query: string): string {
  const match = query
    .toLowerCase()
    .match(/\b(rice|wheat|maize|cotton|soybean|mustard|barley|millets|pulses|groundnut|tomato|onion)\b/);

  return match?.[1] ?? "mixed crops";
}

function withNetPrices(dataset: Array<{ market: string; price: number; distance: number }>): MarketRecord[] {
  return dataset.map((item) => {
    const transportCost = item.distance * 8;
    return {
      ...item,
      transport_cost: transportCost,
      net_price: item.price - transportCost,
    };
  });
}

function bestMarket(markets: MarketRecord[]): MarketRecord {
  return markets.reduce((best, current) => (current.net_price > best.net_price ? current : best));
}

function fallbackRecommendation(input: MarketInput, best: MarketRecord): string {
  return `For ${input.crop} near ${input.location}, ${best.market} gives the highest net return after transport. Sell now if quality is market-ready; otherwise wait briefly for better rates.`;
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
  defaultBestMarket: string,
  defaultRecommendation: string,
): Promise<{ best_market: string; recommendation: string }> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return {
      best_market: defaultBestMarket,
      recommendation: defaultRecommendation,
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
        max_tokens: 220,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You are a market advisor.\n\nGiven:\n{market_data}\n\nSuggest:\n- best market\n- whether to sell now or wait\n\nReturn JSON:\n{\n  best_market: \"\",\n  recommendation: \"\"\n}",
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
          : defaultBestMarket,
      recommendation: parsed.recommendation.trim() || defaultRecommendation,
    };
  } catch (error) {
    console.error("generateMarketRecommendation fallback", error);
    return {
      best_market: defaultBestMarket,
      recommendation: defaultRecommendation,
    };
  } finally {
    clearTimeout(timeoutHandle);
  }
}

export async function getMarketData(input: MarketInput): Promise<MarketOutput> {
  const markets = withNetPrices(BASE_DATASET);
  const topMarket = bestMarket(markets);
  const defaultRecommendation = fallbackRecommendation(input, topMarket);

  const llm = await generateMarketRecommendation(
    input,
    markets,
    topMarket.market,
    defaultRecommendation,
  );

  return {
    markets,
    best_market: llm.best_market,
    recommendation: llm.recommendation,
  };
}

export async function marketAgent(context: AgentContext): Promise<AgentResult> {
  const marketData = await getMarketData({
    crop: parseCropFromQuery(context.message),
    location: context.locale ?? "Maharashtra",
  });

  return {
    agent: "market",
    insight: `Best market: ${marketData.best_market}. ${marketData.recommendation}`,
    confidence: 0.82,
    metadata: {
      locale: context.locale ?? "global",
      source: "mock-market+groq",
      best_market: marketData.best_market,
      markets: marketData.markets.length,
    },
  };
}
