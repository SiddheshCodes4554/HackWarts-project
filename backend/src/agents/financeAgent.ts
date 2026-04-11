import { AgentContext, AgentResult } from "../utils/types";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const FINANCE_MODEL = process.env.GROQ_FINANCE_MODEL ?? "llama-3.3-70b-versatile";
const FINANCE_TIMEOUT_MS = 6000;

type Scheme = {
  name: string;
  benefit: string;
};

type FinancialAdvice = {
  schemes: Scheme[];
  advice: string;
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

const SCHEMES: Scheme[] = [
  {
    name: "PM-KISAN",
    benefit: "₹6000 per year",
  },
  {
    name: "Kisan Credit Card",
    benefit: "Low interest loan",
  },
  {
    name: "PMFBY",
    benefit: "Crop insurance",
  },
];

function fallbackAdvice(): FinancialAdvice {
  return {
    schemes: SCHEMES,
    advice:
      "PM-KISAN gives direct yearly support, Kisan Credit Card helps with low-interest working capital, and PMFBY protects crops against major losses.",
  };
}

function parseLlmAdvice(raw: string): string | null {
  const trimmed = raw.trim();

  try {
    const parsed = JSON.parse(trimmed) as Partial<{ advice: string }>;
    if (typeof parsed.advice === "string" && parsed.advice.trim()) {
      return parsed.advice.trim();
    }
  } catch {
    // Fallback to plain text path below.
  }

  if (trimmed) {
    return trimmed;
  }

  return null;
}

export async function getFinancialAdvice(): Promise<FinancialAdvice> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return fallbackAdvice();
  }

  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), FINANCE_TIMEOUT_MS);

  try {
    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: FINANCE_MODEL,
        temperature: 0.2,
        max_tokens: 220,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: "Explain these schemes simply for farmers.",
          },
          {
            role: "user",
            content: JSON.stringify({ schemes: SCHEMES }),
          },
        ],
      }),
      signal: controller.signal,
    });

    const payload = (await response.json().catch(() => ({}))) as GroqPayload;
    if (!response.ok) {
      throw new Error(payload.error?.message ?? `Groq finance API failed: HTTP ${response.status}`);
    }

    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("Groq finance response is empty");
    }

    const advice = parseLlmAdvice(content);
    if (!advice) {
      throw new Error("Groq finance response parsing failed");
    }

    return {
      schemes: SCHEMES,
      advice,
    };
  } catch (error) {
    console.error("getFinancialAdvice fallback", error);
    return fallbackAdvice();
  } finally {
    clearTimeout(timeoutHandle);
  }
}

export async function financeAgent(context: AgentContext): Promise<AgentResult> {
  const financialAdvice = await getFinancialAdvice();
  const schemeNames = financialAdvice.schemes.map((scheme) => scheme.name).join(", ");

  return {
    agent: "finance",
    insight: `${financialAdvice.advice} Key schemes: ${schemeNames}.`,
    confidence: 0.8,
    metadata: {
      locale: context.locale ?? "global",
      source: "schemes+groq",
      schemes: financialAdvice.schemes.length,
    },
  };
}
