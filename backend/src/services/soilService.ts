import { SoilProfile } from "../utils/types";

const SOILGRIDS_API_URL = "https://rest.isric.org/soilgrids/v2.0/properties/query";
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const SOIL_MODEL = process.env.GROQ_SOIL_MODEL ?? "llama-3.3-70b-versatile";
const SOIL_TIMEOUT_MS = 9000;

type SoilGridDepth = {
  label?: string;
  values?: {
    mean?: number;
  };
};

type SoilGridLayer = {
  name?: string;
  depths?: SoilGridDepth[];
};

type SoilGridPayload = {
  properties?: {
    layers?: SoilGridLayer[];
  };
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

function roundValue(value: number, digits = 2): number {
  if (!Number.isFinite(value)) {
    throw new Error("Cannot round non-finite soil value");
  }

  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function extractLayerMean(layers: SoilGridLayer[], layerNames: string[]): number {
  const layer = layers.find((entry) =>
    layerNames.some((name) => entry.name?.toLowerCase() === name.toLowerCase()),
  );
  const depth = layer?.depths?.find((entry) => entry.label === "0-5cm") ?? layer?.depths?.[0];
  const meanValue = depth?.values?.mean;

  if (!Number.isFinite(meanValue)) {
    throw new Error(`Missing soil layer data for ${layerNames.join("/")}`);
  }

  return meanValue as number;
}

function inferAcidity(ph: number): string {
  if (ph < 6) {
    return "Acidic";
  }

  if (ph > 7.5) {
    return "Alkaline";
  }

  return "Neutral";
}

function parseRecommendation(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error("Empty recommendation response");
  }

  try {
    const parsed = JSON.parse(trimmed) as Partial<{ recommendation: string }>;
    if (typeof parsed.recommendation === "string" && parsed.recommendation.trim()) {
      return parsed.recommendation.trim();
    }
  } catch {
    const objectMatch = trimmed.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      try {
        const parsed = JSON.parse(objectMatch[0]) as Partial<{ recommendation: string }>;
        if (typeof parsed.recommendation === "string" && parsed.recommendation.trim()) {
          return parsed.recommendation.trim();
        }
      } catch {
        // Ignore and return plain-text response below.
      }
    }
  }

  return trimmed;
}

async function generateSoilRecommendation(soilData: {
  ph: number;
  nitrogen: number;
  organicCarbon: number;
  soilType: string;
}): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY is required for soil recommendation");
  }

  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), SOIL_TIMEOUT_MS);

  try {
    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: SOIL_MODEL,
        temperature: 0.2,
        max_tokens: 300,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You are an agricultural expert. Return valid JSON with one key: recommendation.",
          },
          {
            role: "user",
            content: [
              "Given soil data:",
              JSON.stringify(soilData),
              "Provide:",
              "- soil type",
              "- suitability for crops",
              "- improvement suggestions",
            ].join("\n"),
          },
        ],
      }),
      signal: controller.signal,
    });

    const payload = (await response.json().catch(() => ({}))) as GroqPayload;
    if (!response.ok) {
      throw new Error(payload.error?.message ?? `Groq soil API failed: HTTP ${response.status}`);
    }

    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("Groq soil response is empty");
    }

    return parseRecommendation(content);
  } finally {
    clearTimeout(timeoutHandle);
  }
}

export async function getSoilProfile(latitude: number, longitude: number): Promise<SoilProfile> {
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), SOIL_TIMEOUT_MS);

  try {
    const params = new URLSearchParams();
    params.set("lon", String(longitude));
    params.set("lat", String(latitude));
    ["phh2o", "nitrogen", "organic_carbon"].forEach((property) => {
      params.append("property", property);
    });
    params.set("depth", "0-5cm");

    const response = await fetch(`${SOILGRIDS_API_URL}?${params.toString()}`, {
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`SoilGrids error: HTTP ${response.status}`);
    }

    const payload = (await response.json().catch(() => ({}))) as SoilGridPayload;
    const layers = payload.properties?.layers ?? [];

    const ph = roundValue(extractLayerMean(layers, ["phh2o"]), 2);
    const nitrogen = roundValue(extractLayerMean(layers, ["nitrogen"]), 3);
    const organicCarbon = roundValue(extractLayerMean(layers, ["organic_carbon", "soc"]), 2);
    const soilType = inferAcidity(ph);
    const recommendation = await generateSoilRecommendation({
      ph,
      nitrogen,
      organicCarbon,
      soilType,
    });

    return {
      ph,
      nitrogen,
      organicCarbon,
      soilType,
      recommendation,
      source: "soilgrids",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "soil service unavailable";
    console.warn(`Using fallback soil profile (${message})`);

    return {
      ph: 6.8,
      nitrogen: 0.18,
      organicCarbon: 0.95,
      soilType: "Neutral",
      recommendation:
        "Soil service is temporarily unavailable. Use balanced NPK fertilizer, add compost, and recheck soil in 2-3 weeks.",
      source: "fallback",
    };
  } finally {
    clearTimeout(timeoutHandle);
  }
}
