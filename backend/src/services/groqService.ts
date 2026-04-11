const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";
const GROQ_INTENT_MODEL = process.env.GROQ_INTENT_MODEL ?? "llama3-70b-8192";
const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_RETRIES = 1;

const SUPPORTED_INTENTS = [
  "crop_advice",
  "weather",
  "market_price",
  "financial_help",
  "general_query",
] as const;

type SupportedIntent = (typeof SUPPORTED_INTENTS)[number];

type IntentEntities = {
  crop: string;
  location: string;
  season: string;
  query_type: string;
};

export type IntentDetectionResult = {
  intent: SupportedIntent;
  entities: IntentEntities;
};

export type StructuredGroqResponse = {
  intent: string;
  message: string;
};

type GroqApiResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
    type?: string;
  };
};

function fallbackResponse(message: string, intent = "fallback_advice"): StructuredGroqResponse {
  return {
    intent,
    message,
  };
}

function defaultIntentResult(intent: SupportedIntent = "general_query"): IntentDetectionResult {
  return {
    intent,
    entities: {
      crop: "",
      location: "",
      season: "",
      query_type: "",
    },
  };
}

function timeoutMs(): number {
  const rawTimeout = Number(process.env.GROQ_TIMEOUT_MS);
  if (Number.isFinite(rawTimeout) && rawTimeout > 0) {
    return rawTimeout;
  }

  return DEFAULT_TIMEOUT_MS;
}

function parseModelJson(rawContent: string): StructuredGroqResponse | null {
  const trimmed = rawContent.trim();

  try {
    const parsed = JSON.parse(trimmed) as Partial<StructuredGroqResponse>;
    if (typeof parsed.intent === "string" && typeof parsed.message === "string") {
      return {
        intent: parsed.intent.trim() || "general_support",
        message: parsed.message.trim(),
      };
    }
  } catch {
    // Continue to extraction fallback.
  }

  const fencedMatch = trimmed.match(/\{[\s\S]*\}/);
  if (!fencedMatch) {
    return null;
  }

  try {
    const parsed = JSON.parse(fencedMatch[0]) as Partial<StructuredGroqResponse>;
    if (typeof parsed.intent === "string" && typeof parsed.message === "string") {
      return {
        intent: parsed.intent.trim() || "general_support",
        message: parsed.message.trim(),
      };
    }
  } catch {
    return null;
  }

  return null;
}

function parseIntentJson(rawContent: string): IntentDetectionResult | null {
  const trimmed = rawContent.trim();

  const tryParse = (value: string): IntentDetectionResult | null => {
    try {
      const parsed = JSON.parse(value) as Partial<IntentDetectionResult>;
      const candidateIntent =
        typeof parsed.intent === "string" &&
        (SUPPORTED_INTENTS as readonly string[]).includes(parsed.intent)
          ? (parsed.intent as SupportedIntent)
          : "general_query";

      const entities = (parsed.entities ?? {}) as Record<string, unknown>;

      return {
        intent: candidateIntent,
        entities: {
          crop: typeof entities.crop === "string" ? entities.crop : "",
          location: typeof entities.location === "string" ? entities.location : "",
          season: typeof entities.season === "string" ? entities.season : "",
          query_type: typeof entities.query_type === "string" ? entities.query_type : "",
        },
      };
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

function ruleBasedIntent(query: string): SupportedIntent | null {
  const q = query.toLowerCase();

  if (/\b(price|mandi|rate)\b/.test(q)) {
    return "market_price";
  }

  if (/\b(loan|scheme|subsidy)\b/.test(q)) {
    return "financial_help";
  }

  if (/\b(weather|rain|temperature)\b/.test(q)) {
    return "weather";
  }

  if (/\b(crop|grow|plant)\b/.test(q)) {
    return "crop_advice";
  }

  return null;
}

function extractEntities(query: string): IntentEntities {
  const q = query.toLowerCase();

  const cropMatch = q.match(
    /\b(rice|wheat|maize|corn|cotton|soybean|soyabean|tomato|onion|potato|sugarcane|millet|bajra|jowar|paddy|chilli|banana|mango)\b/,
  );
  const seasonMatch = q.match(/\b(kharif|rabi|zaid|monsoon|summer|winter|rainy)\b/);
  const locationMatch = q.match(/\b(?:in|near|at|around)\s+([a-z][a-z\s-]{1,40})/i);

  let queryType = "";
  if (/\b(buy|purchase)\b/.test(q)) {
    queryType = "buy";
  } else if (/\b(sell|selling|sale)\b/.test(q)) {
    queryType = "sell";
  } else if (/\b(advice|suggest|recommend|help|guide|guidance)\b/.test(q)) {
    queryType = "advice";
  }

  return {
    crop: cropMatch?.[1] ?? "",
    location: locationMatch?.[1]?.trim() ?? "",
    season: seasonMatch?.[1] ?? "",
    query_type: queryType,
  };
}

async function requestIntentFromGroq(query: string, apiKey: string): Promise<IntentDetectionResult> {
  const controller = new AbortController();
  const requestTimeout = setTimeout(() => controller.abort(), timeoutMs());

  try {
    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: GROQ_INTENT_MODEL,
        temperature: 0,
        max_tokens: 220,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You are an AI assistant for Indian farmers.\n\nYour job is to classify the user's query into one of the following intents:\ncrop_advice, weather, market_price, financial_help, general_query\n\nAlso extract entities:\n- crop name (if mentioned)\n- location (if mentioned)\n- season (if mentioned)\n- query_type (buy/sell/advice)\n\nReturn ONLY JSON. No explanation.",
          },
          {
            role: "user",
            content: query,
          },
        ],
      }),
      signal: controller.signal,
    });

    const payload = (await response.json().catch(() => ({}))) as GroqApiResponse;

    if (!response.ok) {
      const apiError = payload.error?.message ?? `HTTP ${response.status}`;
      throw new Error(`Groq intent API error: ${apiError}`);
    }

    const rawContent = payload.choices?.[0]?.message?.content;
    if (!rawContent) {
      throw new Error("Groq intent API returned an empty completion payload.");
    }

    const parsed = parseIntentJson(rawContent);
    if (!parsed) {
      throw new Error("Groq intent response was not valid JSON.");
    }

    return parsed;
  } finally {
    clearTimeout(requestTimeout);
  }
}

async function requestGroq(prompt: string, apiKey: string): Promise<StructuredGroqResponse> {
  const controller = new AbortController();
  const requestTimeout = setTimeout(() => controller.abort(), timeoutMs());

  try {
    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        temperature: 0.2,
        max_tokens: 300,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You are FarmEase AI, an assistant for farmers and the FarmEase app. Answer agriculture questions, crop guidance, weather planning, market/finance support, and app usage questions. Return only valid JSON with exactly two keys: intent and message. Keep the message concise, practical, and actionable.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
      signal: controller.signal,
    });

    const payload = (await response.json().catch(() => ({}))) as GroqApiResponse;

    if (!response.ok) {
      const apiError = payload.error?.message ?? `HTTP ${response.status}`;
      throw new Error(`Groq API error: ${apiError}`);
    }

    const rawContent = payload.choices?.[0]?.message?.content;
    if (!rawContent) {
      throw new Error("Groq API returned an empty completion payload.");
    }

    const parsed = parseModelJson(rawContent);
    if (!parsed) {
      throw new Error("Groq response did not contain valid structured JSON.");
    }

    return parsed;
  } finally {
    clearTimeout(requestTimeout);
  }
}

export async function generateResponse(prompt: string): Promise<StructuredGroqResponse> {
  const cleanedPrompt = prompt.trim();

  if (!cleanedPrompt) {
    return fallbackResponse(
      "Please share more details about your farm query so I can assist effectively.",
      "clarification",
    );
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return fallbackResponse(
      "Groq integration is not configured yet. Add GROQ_API_KEY to the backend environment.",
      "configuration_required",
    );
  }

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      return await requestGroq(cleanedPrompt, apiKey);
    } catch (error) {
      const isLastAttempt = attempt === MAX_RETRIES;
      if (isLastAttempt) {
        console.error("Groq request failed", error);
        return fallbackResponse(
          "I could not fetch a live AI response right now. Please retry in a moment.",
          "service_unavailable",
        );
      }
    }
  }

  return fallbackResponse("Unexpected completion flow reached.", "internal_guardrail");
}

export async function detectIntent(query: string): Promise<IntentDetectionResult> {
  const cleanedQuery = query.trim();
  if (!cleanedQuery) {
    return defaultIntentResult();
  }

  const entities = extractEntities(cleanedQuery);
  const ruleIntent = ruleBasedIntent(cleanedQuery);
  if (ruleIntent) {
    return {
      intent: ruleIntent,
      entities,
    };
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    console.warn("Intent detection fallback: GROQ_API_KEY missing");
    return {
      ...defaultIntentResult(),
      entities,
    };
  }

  try {
    const llmResult = await requestIntentFromGroq(cleanedQuery, apiKey);
    return {
      intent: llmResult.intent,
      entities: {
        crop: llmResult.entities.crop || entities.crop,
        location: llmResult.entities.location || entities.location,
        season: llmResult.entities.season || entities.season,
        query_type: llmResult.entities.query_type || entities.query_type,
      },
    };
  } catch (error) {
    console.error("Intent detection failed", error);
    return {
      ...defaultIntentResult(),
      entities,
    };
  }
}
