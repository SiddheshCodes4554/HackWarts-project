import { buildCropContext } from "../services/cropContextBuilder";
import { pickGroqApiKey } from "../services/groqKeys";
import {
  AgentContext,
  CropAdviceInput,
  CropDashboardInsight,
  CropAdviceResult,
  CropWeather,
  SoilProfile,
} from "../utils/types";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const CROP_ADVICE_MODEL = "llama3-70b-8192";
const CROP_TIMEOUT_MS = 9000;

type GroqCropResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
};

type DiseaseInferenceResult = {
  disease_name: string;
  confidence: number;
};

type CropAdviceModelResult = {
  disease: string;
  confidence: number;
  root_cause: string;
  treatment: string[];
  prevention: string[];
  crop_recommendation: string[];
};

function sanitizeText(value: unknown, fallback = ""): string {
  if (typeof value !== "string") {
    return fallback;
  }

  return value.trim() || fallback;
}

function parseNumber(value: unknown, fallback = 0): number {
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

function normalizeList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeText(entry)).filter(Boolean).slice(0, 5);
  }

  if (typeof value === "string") {
    return value
      .split(/\n|\r|;|\.|\d+\)/)
      .map((entry) => entry.replace(/^[-*\s]+/, "").trim())
      .filter(Boolean)
      .slice(0, 5);
  }

  return [];
}

function parseJsonObject<T>(raw: string): T | null {
  const trimmed = raw.trim();

  try {
    return JSON.parse(trimmed) as T;
  } catch {
    const fencedMatch = trimmed.match(/\{[\s\S]*\}/);
    if (!fencedMatch) {
      return null;
    }

    try {
      return JSON.parse(fencedMatch[0]) as T;
    } catch {
      return null;
    }
  }
}

function buildCropPrompt(
  input: CropAdviceInput,
  context: ReturnType<typeof buildCropContext>,
  diseaseName: string,
  diseaseConfidence: number,
): string {
  const cropName = input.crop?.trim() || "unspecified crop";
  const language = input.language?.trim() || "English";

  return [
    "You are an expert agronomist specialising in Indian smallholder farming.",
    "",
    `Farmer: ${context.district}, ${context.state}`,
    `Crop: ${cropName}`,
    `Stage: ${context.growth_stage}`,
    `Season: ${context.season}`,
    "",
    `Weather (7d): ${context.weather_summary}`,
    `Soil: ${context.soil_type}`,
    "",
    `Disease model output: ${diseaseName} (confidence: ${diseaseConfidence}%)`,
    "",
    `Respond in ${language}.`,
    "",
    "Format:",
    "1) Disease name",
    "2) Root cause",
    "3) Treatment (3 steps, cheapest first)",
    "4) Prevention",
    "",
    "Use simple language (6th-grade level).",
    "Avoid technical jargon unless explained.",
    "",
    "Return valid JSON with keys: disease, confidence, root_cause, treatment, prevention, crop_recommendation.",
  ].join("\n");
}

async function groqCompletion(prompt: string): Promise<string> {
  const apiKey = pickGroqApiKey();
  if (!apiKey) {
    throw new Error("GROQ_API_KEY is required for crop advisory");
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
        max_tokens: 500,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: "Return only valid JSON.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
      signal: controller.signal,
    });

    const payload = (await response.json().catch(() => ({}))) as GroqCropResponse;
    if (!response.ok) {
      throw new Error(payload.error?.message ?? `Groq crop API error: HTTP ${response.status}`);
    }

    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("Groq crop response was empty");
    }

    return content;
  } finally {
    clearTimeout(timeoutHandle);
  }
}

export async function inferDisease(query: string): Promise<DiseaseInferenceResult> {
  const cleanedQuery = query.trim();
  if (!cleanedQuery) {
    return {
      disease_name: "Leaf spot / blight",
      confidence: 45,
    };
  }

  try {
    const responseText = await groqCompletion([
      "You are an agricultural expert.",
      "",
      `From this farmer query:\n${cleanedQuery}`,
      "",
      "Identify:",
      "- possible crop disease",
      "- confidence %",
      "",
      "Return JSON:",
      '{',
      '  "disease_name": "",',
      '  "confidence": ""',
      '}',
    ].join("\n"));

    const parsed = parseJsonObject<Partial<DiseaseInferenceResult>>(responseText);
    const diseaseName = sanitizeText(parsed?.disease_name, "Unknown condition");
    const confidence = Math.max(0, Math.min(100, parseNumber(parsed?.confidence, 0)));

    return {
      disease_name: diseaseName || "Unknown condition",
      confidence,
    };
  } catch (error) {
    console.error("inferDisease fallback", error);
    return {
      disease_name: "Leaf spot / blight",
      confidence: 45,
    };
  }
}

function deriveWarnings(input: CropAdviceInput, context: ReturnType<typeof buildCropContext>): string[] {
  const warnings: string[] = [];
  const humidity = input.weather.humidity;
  const soilType = context.soil_type.toLowerCase();

  if (soilType.includes("acidic") || input.soil.ph < 6) {
    warnings.push("Soil is acidic. Avoid wheat and apply lime before sowing.");
  }

  if (humidity >= 75) {
    warnings.push("High humidity can increase fungal risk. Keep leaves dry and improve air flow.");
  }

  if (input.soil.nitrogen < 0.05) {
    warnings.push("Low nitrogen detected. Use a small dose of nitrogen fertilizer after soil testing.");
  }

  return warnings;
}

function applyRuleValidation(
  advice: CropAdviceModelResult,
  input: CropAdviceInput,
  context: ReturnType<typeof buildCropContext>,
): CropAdviceModelResult & { warnings: string[] } {
  const warnings = deriveWarnings(input, context);
  const treatment = [...advice.treatment];
  const prevention = [...advice.prevention];
  let cropRecommendation = [...advice.crop_recommendation];

  if (context.soil_type.toLowerCase().includes("acidic") || input.soil.ph < 6) {
    const limeStep = "Apply agricultural lime as per local soil test recommendation.";
    if (!treatment.some((step) => step.toLowerCase().includes("lime"))) {
      treatment.unshift(limeStep);
    }
    cropRecommendation = cropRecommendation.filter((crop) => crop.toLowerCase() !== "wheat");
  }

  if (input.weather.humidity >= 75) {
    const fungalStep = "Watch for fungal spots and spray only if symptoms spread quickly.";
    if (!prevention.some((step) => step.toLowerCase().includes("fungal"))) {
      prevention.push(fungalStep);
    }
  }

  if (input.soil.nitrogen < 0.05) {
    const fertilizerStep = "Add a balanced nitrogen fertilizer in small doses after irrigation.";
    if (!treatment.some((step) => step.toLowerCase().includes("nitrogen"))) {
      treatment.push(fertilizerStep);
    }
  }

  return {
    ...advice,
    treatment: treatment.slice(0, 3),
    prevention: prevention.slice(0, 4),
    crop_recommendation: cropRecommendation.slice(0, 5),
    warnings,
  };
}

function fallbackCropAdvice(
  input: CropAdviceInput,
  context: ReturnType<typeof buildCropContext>,
  diseaseName: string,
  diseaseConfidence: number,
): CropAdviceResult {
  const warnings = deriveWarnings(input, context);

  return {
    disease: diseaseName,
    confidence: diseaseConfidence,
    root_cause: "The crop needs closer field inspection because the symptoms match a common stress pattern.",
    treatment: [
      "Remove the most affected leaves or plants.",
      "Keep the field dry and improve air flow.",
      "Use a local agro-dealer recommendation after checking the soil.",
    ],
    prevention: [
      "Inspect the crop every 2 to 3 days.",
      "Do not overwater the field.",
      "Keep tools and beds clean.",
    ],
    crop_recommendation: input.crop ? [input.crop.trim()] : [],
    context: {
      season: context.season,
      soil_type: context.soil_type,
      weather_summary: context.weather_summary,
    },
    warnings,
    summary:
      warnings.length > 0
        ? `${diseaseName}. ${warnings[0]}`
        : `${diseaseName}. Start with the first treatment step and recheck the crop in 2 days.`,
  };
}

export async function generateCropAdvice(input: CropAdviceInput): Promise<CropAdviceResult> {
  const normalizedInput: CropAdviceInput = {
    ...input,
    crop: sanitizeText(input.crop, ""),
    disease: sanitizeText(input.disease, ""),
    language: sanitizeText(input.language, "English") || "English",
    query: sanitizeText(input.query, ""),
    growthStage: sanitizeText(input.growthStage, ""),
  };

  const context = buildCropContext(normalizedInput);
  const diseaseInference = normalizedInput.disease
    ? {
        disease_name: normalizedInput.disease,
        confidence: normalizedInput.diseaseConfidence ?? 100,
      }
    : await inferDisease(normalizedInput.query || `${normalizedInput.crop ?? ""} crop symptom analysis`).catch(
        () => ({ disease_name: "Unknown condition", confidence: 0 }),
      );

  const prompt = buildCropPrompt(
    normalizedInput,
    context,
    diseaseInference.disease_name,
    diseaseInference.confidence,
  );

  try {
    const responseText = await groqCompletion(prompt);
    const parsed = parseJsonObject<Partial<CropAdviceModelResult>>(responseText);

    if (!parsed) {
      throw new Error("Groq crop response was not valid JSON");
    }

    const advice: CropAdviceModelResult = {
      disease: sanitizeText(parsed.disease, diseaseInference.disease_name),
      confidence: Math.max(
        diseaseInference.confidence,
        Math.min(100, parseNumber(parsed.confidence, diseaseInference.confidence)),
      ),
      root_cause: sanitizeText(parsed.root_cause, "The crop shows stress that needs local field observation."),
      treatment: normalizeList(parsed.treatment).slice(0, 3),
      prevention: normalizeList(parsed.prevention).slice(0, 4),
      crop_recommendation: normalizeList(parsed.crop_recommendation).slice(0, 5),
    };

    if (!advice.treatment.length || !advice.prevention.length) {
      throw new Error("Groq crop response missing treatment or prevention steps");
    }

    const validated = applyRuleValidation(advice, normalizedInput, context);

    return {
      disease: validated.disease,
      confidence: validated.confidence,
      root_cause: validated.root_cause,
      treatment: validated.treatment,
      prevention: validated.prevention,
      crop_recommendation: validated.crop_recommendation,
      context: {
        season: context.season,
        soil_type: context.soil_type,
        weather_summary: context.weather_summary,
      },
      warnings: validated.warnings,
      summary: `${validated.disease}. ${validated.root_cause}`,
    };
  } catch (error) {
    console.error("generateCropAdvice fallback", error);
    return fallbackCropAdvice(normalizedInput, context, diseaseInference.disease_name, diseaseInference.confidence);
  }
}

type CropRecommendationModel = {
  recommendations?: Array<{
    crop?: string;
    season?: string;
    reasoning?: string;
  }>;
  summary?: string;
};

function normalizeCropDashboard(value: CropRecommendationModel): CropDashboardInsight {
  const recommendations = Array.isArray(value.recommendations)
    ? value.recommendations
        .map((entry) => {
          const crop = sanitizeText(entry.crop, "");
          const season = sanitizeText(entry.season, "");
          const reasoning = sanitizeText(entry.reasoning, "");
          if (!crop || !season || !reasoning) {
            return null;
          }

          return { crop, season, reasoning };
        })
        .filter((entry): entry is { crop: string; season: string; reasoning: string } => Boolean(entry))
        .slice(0, 3)
    : [];

  if (!recommendations.length) {
    throw new Error("Crop recommendation model returned no valid recommendations");
  }

  return {
    recommendations,
    summary: sanitizeText(value.summary, `Best for your soil + weather: ${recommendations[0].crop}`),
  };
}

export async function cropAgent(context: AgentContext, weather: CropWeather, soil: SoilProfile): Promise<CropDashboardInsight> {
  const prompt = [
    "You are an expert agronomist for Indian farms.",
    `Location: ${context.locale ?? "India"}`,
    `Weather: ${JSON.stringify(weather)}`,
    `Soil: ${JSON.stringify(soil)}`,
    "Return valid JSON with keys:",
    "- recommendations: array of top 3 items (crop, season, reasoning)",
    "- summary: one line starting with 'Best for your soil + weather'",
  ].join("\n");

  const raw = await groqCompletion(prompt);
  const parsed = parseJsonObject<CropRecommendationModel>(raw);

  if (!parsed) {
    throw new Error("Crop recommendation response is not valid JSON");
  }

  return normalizeCropDashboard(parsed);
}
