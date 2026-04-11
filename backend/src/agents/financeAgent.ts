import { getEligibleSchemes } from "../services/eligibilityEngine";
import { AgentContext, AgentResult, FinancialAdviceResult, FinancialUserProfile, GovernmentScheme } from "../utils/types";

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

type AdvisoryCompletion = {
  advice: string;
  steps: string[];
};

let financeFallbackWarned = false;

function normalizeText(value: unknown, fallback = ""): string {
  if (typeof value !== "string") {
    return fallback;
  }

  const cleaned = value.trim();
  return cleaned || fallback;
}

function normalizeLanguage(language: string): "English" | "Hindi" {
  const normalized = normalizeText(language, "English").toLowerCase();
  if (normalized.startsWith("hi") || normalized.includes("hindi")) {
    return "Hindi";
  }

  return "English";
}

function extractCropType(message: string, cropType?: string): string {
  const explicit = normalizeText(cropType, "");
  if (explicit) {
    return explicit;
  }

  const match = message.toLowerCase().match(
    /\b(rice|wheat|maize|corn|cotton|soybean|soyabean|tomato|onion|potato|sugarcane|millet|bajra|jowar|paddy|chilli|banana|mango)\b/,
  );

  return match?.[1] ?? "";
}

function inferLandOwnership(message: string, explicit?: boolean): boolean {
  if (typeof explicit === "boolean") {
    return explicit;
  }

  const normalized = message.toLowerCase();
  if (/\b(tenant|lease|leased|sharecropper)\b/.test(normalized)) {
    return false;
  }

  return /\b(own|owned|my land|land)\b/.test(normalized);
}

function inferIncomeLevel(message: string, explicit?: string): string {
  const normalizedExplicit = normalizeText(explicit, "");
  if (normalizedExplicit) {
    return normalizedExplicit;
  }

  const normalized = message.toLowerCase();
  if (/\b(low|bpl|poor|small income|limited income|less income)\b/.test(normalized)) {
    return "low";
  }

  if (/\b(high|better income|stable income)\b/.test(normalized)) {
    return "high";
  }

  return "medium";
}

function buildUserProfile(context: AgentContext): FinancialUserProfile {
  const message = context.message ?? "";
  const location = normalizeText(context.locale, "India");

  return {
    landOwned: inferLandOwnership(message, context.landOwned),
    cropType: extractCropType(message, context.cropType),
    location,
    incomeLevel: inferIncomeLevel(message, context.incomeLevel),
  };
}

function schemeSummary(scheme: GovernmentScheme): string {
  return `${scheme.name} - ${scheme.benefit}`;
}

function buildInsight(advice: FinancialAdviceResult): string {
  const topSchemes = advice.schemes.slice(0, 3).map(schemeSummary).join(". ");
  return `${advice.advice} ${topSchemes ? `Top schemes: ${topSchemes}.` : ""}`.trim();
}

function buildFallbackAdvice(schemes: GovernmentScheme[], language: "English" | "Hindi"): AdvisoryCompletion {
  const topSchemeNames = schemes.slice(0, 3).map((scheme) => scheme.name).join(", ");

  if (language === "Hindi") {
    return {
      advice:
        `Aapke liye yeh yojnaen upyogi ho sakti hain: ${topSchemeNames}. Har yojna ke liye sahi kagaz taiyar rakhein aur pados ke bank ya kisan karyalaya se turant madad lein.`,
      steps: [
        "Apni eligibility check karein.",
        "Aadhaar, bank details aur land records taiyar rakhein.",
        "Nearest bank ya agriculture office mein apply karein.",
        "Application status 2-3 din mein follow up karein.",
      ],
    };
  }

  return {
    advice:
      `These schemes can help: ${topSchemeNames}. Keep your Aadhaar, bank details, and land papers ready, then apply at the nearest bank or agriculture office.`,
    steps: [
      "Check which schemes match your profile.",
      "Keep Aadhaar, bank details, and land records ready.",
      "Apply on the official website or at the nearest office.",
      "Follow up on the status within a few days.",
    ],
  };
}

function parseCompletion(raw: string): AdvisoryCompletion | null {
  const trimmed = raw.trim();

  const normalizeSteps = (value: unknown): string[] => {
    if (Array.isArray(value)) {
      return value.map((step) => normalizeText(step)).filter(Boolean).slice(0, 6);
    }

    if (typeof value === "string") {
      return value
        .split(/\n|\r|;|\||\d+\.|\d+\)/)
        .map((step) => step.replace(/^[-*\s]+/, "").trim())
        .filter(Boolean)
        .slice(0, 6);
    }

    return [];
  };

  const normalizeParsed = (parsed: Partial<AdvisoryCompletion>): AdvisoryCompletion | null => {
    if (typeof parsed.advice !== "string") {
      return null;
    }

    const advice = parsed.advice.trim();
    if (!advice) {
      return null;
    }

    const steps = normalizeSteps((parsed as { steps?: unknown }).steps);
    return { advice, steps };
  };

  try {
    const parsed = JSON.parse(trimmed) as Partial<AdvisoryCompletion>;
    const normalized = normalizeParsed(parsed);
    if (normalized) {
      return normalized;
    }
  } catch {
    // Continue to extraction fallback.
  }

  const fencedMatch = trimmed.match(/\{[\s\S]*\}/);
  if (!fencedMatch) {
    return null;
  }

  try {
    const parsed = JSON.parse(fencedMatch[0]) as Partial<AdvisoryCompletion>;
    const normalized = normalizeParsed(parsed);
    if (normalized) {
      return normalized;
    }
  } catch {
    // Continue to text fallback below.
  }

  const lines = trimmed
    .split(/\n|\r/)
    .map((line) => line.replace(/^[-*\s\d.)]+/, "").trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return null;
  }

  return {
    advice: lines[0],
    steps: lines.slice(1, 7),
  };
}

async function groqCompletion(prompt: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY is required for finance advice");
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
        max_tokens: 350,
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

    const payload = (await response.json().catch(() => ({}))) as GroqPayload;
    if (!response.ok) {
      throw new Error(payload.error?.message ?? `Groq finance API failed: HTTP ${response.status}`);
    }

    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("Groq finance response is empty");
    }

    return content;
  } finally {
    clearTimeout(timeoutHandle);
  }
}

function buildPrompt(
  schemes: GovernmentScheme[],
  profile: FinancialUserProfile,
  language: "English" | "Hindi",
): string {
  return [
    "You are a financial advisor for Indian farmers.",
    "",
    `Farmer profile: ${JSON.stringify(profile)}`,
    `Schemes: ${JSON.stringify(schemes)}`,
    "",
    "Explain the following schemes:",
    "Provide:",
    "- Why farmer should use them",
    "- Simple benefits",
    "- Clear steps to apply",
    "",
    "Use very simple language (6th-grade level).",
    `Respond in ${language}.`,
    "Return JSON with keys advice and steps.",
  ].join("\n");
}

export async function getFinancialAdvice(
  userProfile: FinancialUserProfile,
  language = "English",
): Promise<FinancialAdviceResult> {
  const selectedLanguage = normalizeLanguage(language);
  const eligible = await getEligibleSchemes(userProfile);
  const schemes = eligible.schemes;
  const fallback = buildFallbackAdvice(schemes, selectedLanguage);

  try {
    const responseText = await groqCompletion(buildPrompt(schemes, userProfile, selectedLanguage));
    const parsed = parseCompletion(responseText);

    if (!parsed) {
      throw new Error("Groq finance response parsing failed");
    }

    return {
      schemes,
      advice: parsed.advice,
      steps: parsed.steps.length > 0 ? parsed.steps : fallback.steps,
      language: selectedLanguage,
      profile: userProfile,
      fetched_at: eligible.fetched_at,
      data_source: eligible.data_source,
      api_live: eligible.api_live,
    };
  } catch (error) {
    if (!financeFallbackWarned) {
      const message = error instanceof Error ? error.message : "finance model unavailable";
      console.warn(`Using fallback financial advice (${message})`);
      financeFallbackWarned = true;
    }
    return {
      schemes,
      advice: fallback.advice,
      steps: fallback.steps,
      language: selectedLanguage,
      profile: userProfile,
      fetched_at: eligible.fetched_at,
      data_source: eligible.data_source,
      api_live: eligible.api_live,
    };
  }
}

export async function financeAgent(context: AgentContext): Promise<AgentResult> {
  const userProfile = buildUserProfile(context);
  const financialAdvice = await getFinancialAdvice(userProfile, context.language ?? "English");
  const topSchemes = financialAdvice.schemes.slice(0, 3);
  const schemeNames = topSchemes.map((scheme) => scheme.name).join(", ");

  return {
    agent: "finance",
    insight: buildInsight(financialAdvice),
    confidence: financialAdvice.schemes.length > 0 ? 0.86 : 0.72,
    metadata: {
      locale: context.locale ?? "global",
      source: "government-schemes+groq",
      language: financialAdvice.language,
      scheme_count: financialAdvice.schemes.length,
      scheme_names: schemeNames,
      advice: financialAdvice.advice,
      steps: financialAdvice.steps.join(" | "),
      profile: JSON.stringify(financialAdvice.profile),
      fetched_at: financialAdvice.fetched_at,
      data_source: financialAdvice.data_source,
      api_live: financialAdvice.api_live,
      top_scheme_1: topSchemes[0] ? `${topSchemes[0].name} - ${topSchemes[0].benefit}` : "",
      top_scheme_2: topSchemes[1] ? `${topSchemes[1].name} - ${topSchemes[1].benefit}` : "",
      top_scheme_3: topSchemes[2] ? `${topSchemes[2].name} - ${topSchemes[2].benefit}` : "",
    },
  };
}
