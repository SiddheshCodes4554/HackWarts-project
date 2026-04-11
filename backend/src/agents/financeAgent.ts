import { AgentContext, AgentResult, FinanceDashboardInsight, FinanceScheme } from "../utils/types";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const FINANCE_MODEL = process.env.GROQ_FINANCE_MODEL ?? "llama-3.3-70b-versatile";
const FINANCE_TIMEOUT_MS = 7000;

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

type FinanceModelResponse = {
  schemes?: Array<{
    name?: string;
    benefit?: string;
    amountINR?: number | string;
    eligibility?: string;
  }>;
  advice?: string;
};

function sanitizeText(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function parseAmount(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.round(value));
  }

  if (typeof value === "string") {
    const numeric = Number.parseFloat(value.replace(/[^0-9.]/g, ""));
    if (Number.isFinite(numeric)) {
      return Math.max(0, Math.round(numeric));
    }
  }

  return 0;
}

function parseFinanceJson(raw: string): FinanceModelResponse | null {
  const trimmed = raw.trim();

  try {
    return JSON.parse(trimmed) as FinanceModelResponse;
  } catch {
    const objectMatch = trimmed.match(/\{[\s\S]*\}/);
    if (!objectMatch) {
      return null;
    }

    try {
      return JSON.parse(objectMatch[0]) as FinanceModelResponse;
    } catch {
      return null;
    }
  }
}

function normalizeSchemes(value: unknown): FinanceScheme[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((scheme) => {
      const entry = scheme as {
        name?: unknown;
        benefit?: unknown;
        amountINR?: unknown;
        eligibility?: unknown;
      };

      const name = sanitizeText(entry.name);
      const benefit = sanitizeText(entry.benefit);
      const eligibility = sanitizeText(entry.eligibility);
      const amountINR = parseAmount(entry.amountINR);

      if (!name || !benefit) {
        return null;
      }

      return {
        name,
        benefit,
        amountINR,
        eligibility: eligibility || "Check local eligibility with nearest agriculture office.",
      };
    })
    .filter((scheme): scheme is FinanceScheme => Boolean(scheme))
    .slice(0, 3);
}

export async function getFinancialAdvice(location?: string): Promise<FinanceDashboardInsight> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY is required for finance insights");
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
        max_tokens: 360,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You are an Indian agricultural finance advisor. Return valid JSON with keys schemes and advice.",
          },
          {
            role: "user",
            content: [
              `Location: ${location ?? "India"}`,
              "Provide top 3 currently relevant farmer schemes with monetary benefits.",
              "Each scheme must include: name, benefit, amountINR, eligibility.",
              "Also include one concise advice line.",
            ].join("\n"),
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

    const parsed = parseFinanceJson(content);
    if (!parsed) {
      throw new Error("Finance response is not valid JSON");
    }

    const schemes = normalizeSchemes(parsed.schemes);
    const advice = sanitizeText(parsed.advice);

    if (!schemes.length || !advice) {
      throw new Error("Finance response missing schemes or advice");
    }

    return {
      schemes,
      advice,
    };
  } finally {
    clearTimeout(timeoutHandle);
  }
}

export async function financeAgent(context: AgentContext): Promise<AgentResult> {
  const financialAdvice = await getFinancialAdvice(context.locale);
  const schemeNames = financialAdvice.schemes.map((scheme) => scheme.name).join(", ");

  return {
    agent: "finance",
    insight: `${financialAdvice.advice} Key schemes: ${schemeNames}.`,
    confidence: 0.82,
    metadata: {
      locale: context.locale ?? "global",
      source: "groq-finance",
      schemes: financialAdvice.schemes.length,
    },
  };
}
