const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama3-70b-8192";
const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_RETRIES = 1;

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
              "You are FarmEase AI. Return only valid JSON with exactly two keys: intent and message.",
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
