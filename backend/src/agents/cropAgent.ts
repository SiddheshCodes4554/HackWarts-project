import { AgentContext, AgentResult } from "../utils/types";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const CROP_ADVICE_MODEL = process.env.GROQ_CROP_MODEL ?? "llama-3.3-70b-versatile";
const CROP_TIMEOUT_MS = 7000;

type SeasonType = "rainy" | "winter" | "summer";

type CropAdviceInput = {
  location: { lat: number; lon: number; placeName: string };
  weather: { temperature: number; rainfall: number };
  season?: string;
};

type CropAdviceOutput = {
  crops: string[];
  reasoning: string;
  season: string;
};

type GroqCropPayload = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
};

const RULE_CROP_MAP: Record<SeasonType, string[]> = {
  rainy: ["rice", "maize", "cotton"],
  winter: ["wheat", "mustard", "barley"],
  summer: ["millets", "pulses", "groundnut"],
};

function determineSeason(temperature: number, rainfall: number): SeasonType {
  if (rainfall > 50) {
    return "rainy";
  }

  if (temperature < 20) {
    return "winter";
  }

  return "summer";
}

function parseSeasonFromText(value?: string): SeasonType | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.toLowerCase();
  if (normalized.includes("rain") || normalized.includes("monsoon") || normalized.includes("kharif")) {
    return "rainy";
  }

  if (normalized.includes("winter") || normalized.includes("rabi")) {
    return "winter";
  }

  if (normalized.includes("summer") || normalized.includes("zaid")) {
    return "summer";
  }

  return undefined;
}

function parseCropAdviceJson(raw: string): Partial<CropAdviceOutput> | null {
  const trimmed = raw.trim();

  const parseObj = (jsonValue: string) => {
    try {
      return JSON.parse(jsonValue) as Partial<CropAdviceOutput>;
    } catch {
      return null;
    }
  };

  const direct = parseObj(trimmed);
  if (direct) {
    return direct;
  }

  const objectMatch = trimmed.match(/\{[\s\S]*\}/);
  if (!objectMatch) {
    return null;
  }

  return parseObj(objectMatch[0]);
}

function fallbackCropAdvice(input: CropAdviceInput, season: SeasonType): CropAdviceOutput {
  const crops = RULE_CROP_MAP[season];
  return {
    crops,
    reasoning: `Based on ${input.location.placeName} weather (${input.weather.temperature}°C, ${input.weather.rainfall} mm rainfall), ${season} crops are recommended for stable field performance.`,
    season,
  };
}

export async function getCropAdvice(input: CropAdviceInput): Promise<CropAdviceOutput> {
  const inferredSeason =
    parseSeasonFromText(input.season) ?? determineSeason(input.weather.temperature, input.weather.rainfall);
  const fallback = fallbackCropAdvice(input, inferredSeason);

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return fallback;
  }

  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), CROP_TIMEOUT_MS);

  try {
    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: CROP_ADVICE_MODEL,
        temperature: 0.2,
        max_tokens: 220,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You are an agricultural expert.\n\nBased on:\nWeather: {weather}\nSeason: {season}\nLocation: {placeName}\n\nSuggest best crops for farmer.\n\nReturn JSON:\n{\n  crops: [],\n  reasoning: \"\"\n}",
          },
          {
            role: "user",
            content: `Weather: ${JSON.stringify(input.weather)}\nSeason: ${inferredSeason}\nLocation: ${input.location.placeName}`,
          },
        ],
      }),
      signal: controller.signal,
    });

    const payload = (await response.json().catch(() => ({}))) as GroqCropPayload;
    if (!response.ok) {
      throw new Error(payload.error?.message ?? `Groq crop API error: HTTP ${response.status}`);
    }

    const modelContent = payload.choices?.[0]?.message?.content;
    if (!modelContent) {
      throw new Error("Groq crop response was empty");
    }

    const parsed = parseCropAdviceJson(modelContent);
    if (!parsed || !Array.isArray(parsed.crops) || typeof parsed.reasoning !== "string") {
      throw new Error("Groq crop response JSON invalid");
    }

    const sanitizedCrops = parsed.crops
      .map((crop) => String(crop).trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 5);

    if (sanitizedCrops.length === 0) {
      return fallback;
    }

    return {
      crops: sanitizedCrops,
      reasoning: parsed.reasoning.trim() || fallback.reasoning,
      season: inferredSeason,
    };
  } catch (error) {
    console.error("getCropAdvice fallback", error);
    return fallback;
  } finally {
    clearTimeout(timeoutHandle);
  }
}

export async function cropAgent(
  context: AgentContext,
  weather: { temperature: number; rainfall: number } = { temperature: 30, rainfall: 0 },
): Promise<AgentResult> {
  const cropAdvice = await getCropAdvice({
    location: {
      lat: context.latitude ?? 21.1458,
      lon: context.longitude ?? 79.0882,
      placeName: context.locale ?? "Nagpur, Maharashtra",
    },
    weather,
    season: context.message,
  });

  return {
    agent: "crop",
    insight: `Recommended crops: ${cropAdvice.crops.join(", ")}. ${cropAdvice.reasoning}`,
    confidence: 0.84,
    metadata: {
      locale: context.locale ?? "global",
      source: "groq+rules",
      season: cropAdvice.season,
    },
  };
}
