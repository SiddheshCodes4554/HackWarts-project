import { cropAgent } from "../agents/cropAgent";
import { financeAgent } from "../agents/financeAgent";
import { marketAgent } from "../agents/marketAgent";
import { weatherAgent } from "../agents/weatherAgent";
import { detectIntent, generateResponse } from "../services/groqService";
import {
  AgentResult,
  AgentContext,
  ChatRequestPayload,
  OrchestratedChatResponse,
} from "../utils/types";

type QueryLocation = {
  latitude?: number;
  longitude?: number;
  placeName?: string;
};

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
    timestamp,
  };

  const intentResult = await detectIntent(cleanQuery);

  let weatherResult: AgentResult | undefined;
  let cropResult: AgentResult | undefined;
  let marketResult: AgentResult | undefined;
  let financeResult: AgentResult | undefined;
  let finalMessage = "";

  if (intentResult.intent === "crop_advice") {
    weatherResult = await weatherAgent(context);
    const weatherTemperature =
      typeof weatherResult.metadata?.temperature === "number"
        ? weatherResult.metadata.temperature
        : 30;
    const weatherRainfall =
      typeof weatherResult.metadata?.rainfall === "number" ? weatherResult.metadata.rainfall : 0;

    cropResult = await cropAgent(context, {
      temperature: weatherTemperature,
      rainfall: weatherRainfall,
    });
  } else if (intentResult.intent === "market_price") {
    marketResult = await marketAgent(context);
  } else if (intentResult.intent === "financial_help") {
    financeResult = await financeAgent(context);
  } else if (intentResult.intent === "weather") {
    weatherResult = await weatherAgent(context);
  }

  const weather = toStructuredAgentOutput(weatherResult);
  const crops = toStructuredAgentOutput(cropResult);
  const market = toStructuredAgentOutput(marketResult);
  const finance = toStructuredAgentOutput(financeResult);

  if (intentResult.intent === "general_query") {
    const general = await generateResponse(cleanQuery);
    finalMessage = general.message;
  } else {
    const combined = await generateResponse(
      [
        "You are an agricultural assistant.",
        `User query: ${cleanQuery}`,
        `Detected intent: ${intentResult.intent}`,
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
    intent: intentResult.intent,
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
  });
}
