import { generateCropAdvice } from "../agents/cropAgent";
import { financeAgent } from "../agents/financeAgent";
import { marketAgent } from "../agents/marketAgent";
import { weatherAgent } from "../agents/weatherAgent";
import { detectIntent, generateResponse } from "../services/groqService";
import { getSoilProfile } from "../services/soilService";
import {
  CropAdviceResult,
  AgentResult,
  AgentContext,
  ChatRequestPayload,
  OrchestratedChatResponse,
} from "../utils/types";

type QueryLocation = {
  latitude?: number;
  longitude?: number;
  placeName?: string;
  crop?: string;
  disease?: string;
  language?: string;
  landOwned?: boolean;
  incomeLevel?: string;
};

const DISEASE_QUERY_HINTS = [
  "disease",
  "diseased",
  "symptom",
  "symptoms",
  "infection",
  "infected",
  "pest",
  "fungus",
  "fungal",
  "blight",
  "leaf spot",
  "rust",
  "wilt",
  "yellowing",
  "spots",
  "diagnose",
  "diagnosis",
  "treatment",
  "prevention",
  "spray",
  "medicine",
  "remedy",
];

function isDiseaseDiagnosticQuery(query: string, explicitDisease?: string): boolean {
  if (typeof explicitDisease === "string" && explicitDisease.trim().length > 0) {
    return true;
  }

  const normalizedQuery = query.toLowerCase();
  return DISEASE_QUERY_HINTS.some((hint) => normalizedQuery.includes(hint));
}

function numericMetadata(metadata: Record<string, string | number | boolean> | undefined, key: string): number {
  const value = metadata?.[key];
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  throw new Error(`Missing numeric metadata key: ${key}`);
}

function toStructuredAgentOutput(result?: AgentResult): Record<string, unknown> {
  if (!result) {
    return {};
  }

  return {
    insight: result.insight,
    confidence: result.confidence,
    ...(result.metadata ?? {}),
  };
}

export async function handleQuery(
  query: string,
  location?: QueryLocation,
): Promise<OrchestratedChatResponse> {
  const cleanQuery = query.trim();
  const timestamp = new Date().toISOString();

  const context: AgentContext = {
    message: cleanQuery,
    locale: location?.placeName,
    latitude: location?.latitude,
    longitude: location?.longitude,
    language: location?.language,
    cropType: location?.crop,
    landOwned: location?.landOwned,
    incomeLevel: location?.incomeLevel,
    timestamp,
  };

  const intentResult = await detectIntent(cleanQuery);
  const effectiveIntent =
    intentResult.intent === "crop_advice" && !isDiseaseDiagnosticQuery(cleanQuery, location?.disease)
      ? "general_query"
      : intentResult.intent;

  let weatherResult: AgentResult | undefined;
  let cropResult: AgentResult | undefined;
  let cropAdvice: CropAdviceResult | undefined;
  let marketResult: AgentResult | undefined;
  let financeResult: AgentResult | undefined;
  let finalMessage = "";

  if (effectiveIntent === "crop_advice") {
    const [weatherData, soilData] = await Promise.all([
      weatherAgent(context),
      getSoilProfile(
        Number.isFinite(location?.latitude) ? (location?.latitude as number) : 18.5204,
        Number.isFinite(location?.longitude) ? (location?.longitude as number) : 73.8567,
      ),
    ]);

    weatherResult = weatherData;
    const selectedCrop = (location?.crop ?? intentResult.entities.crop)?.trim() || undefined;

    cropAdvice = await generateCropAdvice({
      location: {
        lat: Number.isFinite(location?.latitude) ? (location?.latitude as number) : 18.5204,
        lon: Number.isFinite(location?.longitude) ? (location?.longitude as number) : 73.8567,
        placeName: location?.placeName ?? context.locale ?? "Nagpur, Maharashtra",
      },
      weather: {
        temperature: numericMetadata(weatherData.metadata, "temperature"),
        rainfall: numericMetadata(weatherData.metadata, "rainfall"),
        humidity: numericMetadata(weatherData.metadata, "humidity"),
      },
      soil: soilData,
      crop: selectedCrop,
      disease: location?.disease ?? undefined,
      language: location?.language ?? "English",
      query: cleanQuery,
    });

    cropResult = {
      agent: "crop",
      insight: `${cropAdvice.disease}. ${cropAdvice.root_cause}`,
      confidence: Math.max(0, Math.min(1, cropAdvice.confidence / 100)),
      metadata: {
        disease: cropAdvice.disease,
        confidence: cropAdvice.confidence,
        root_cause: cropAdvice.root_cause,
        treatment: cropAdvice.treatment.join(" | "),
        prevention: cropAdvice.prevention.join(" | "),
        crop_recommendation: cropAdvice.crop_recommendation.join(" | "),
        warnings: cropAdvice.warnings.join(" | "),
        context: JSON.stringify(cropAdvice.context),
      },
    };
  } else if (effectiveIntent === "market_price") {
    marketResult = await marketAgent(context);
  } else if (effectiveIntent === "financial_help") {
    financeResult = await financeAgent(context);
  } else if (effectiveIntent === "weather") {
    weatherResult = await weatherAgent(context);
  }

  const weather = toStructuredAgentOutput(weatherResult);
  const crops = cropAdvice ?? toStructuredAgentOutput(cropResult);
  const resolvedCropAdvice = cropAdvice;
  const market = toStructuredAgentOutput(marketResult);
  const finance = toStructuredAgentOutput(financeResult);

  if (effectiveIntent === "general_query") {
    const general = await generateResponse(cleanQuery);
    finalMessage = general.message;
  } else if (effectiveIntent === "crop_advice") {
    finalMessage = resolvedCropAdvice?.summary ?? "Crop advice is unavailable right now.";
  } else if (effectiveIntent === "financial_help") {
    finalMessage = financeResult?.insight ?? "Financial guidance is unavailable right now.";
  } else {
    const combined = await generateResponse(
      [
        "You are an agricultural assistant.",
        `User query: ${cleanQuery}`,
        `Detected intent: ${effectiveIntent}`,
        `Detected entities: ${JSON.stringify(intentResult.entities)}`,
        `Combine: ${JSON.stringify({ weather, crops, market, finance })}`,
        "Give:",
        "- clear recommendation",
        "- simple language",
        "- actionable steps",
      ].join("\n"),
    );

    finalMessage = combined.message;
  }

  const agentResults = [weatherResult, cropResult, marketResult, financeResult].filter(
    (result): result is AgentResult => Boolean(result),
  );

  return {
    weather,
    crops,
    market,
    finance,
    final_message: finalMessage,
    reply: finalMessage,
    intent: effectiveIntent,
    agentResults,
    timestamp,
  };
}

export async function orchestrateChat(
  payload: ChatRequestPayload,
): Promise<OrchestratedChatResponse> {
  const userMessage = (payload.message ?? payload.query ?? "").trim();

  return handleQuery(userMessage, {
    latitude: payload.latitude,
    longitude: payload.longitude,
    placeName: payload.locale,
    crop: payload.crop,
    disease: payload.disease,
    language: payload.language,
    landOwned: payload.landOwned,
    incomeLevel: payload.incomeLevel,
  });
}
