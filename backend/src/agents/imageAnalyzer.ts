import { inferDisease } from "./cropAgent";
import { CropImageAnalysis, CropLocation } from "../utils/types";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const IMAGE_MODEL = process.env.GROQ_IMAGE_MODEL ?? "meta-llama/llama-4-scout-17b-16e-instruct";
const IMAGE_TIMEOUT_MS = 10000;

type GroqImageResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
};

type VisionAnalysis = {
  symptoms: string;
  disease_name: string;
  confidence: number;
};

const DISEASE_HINTS: Array<{ keywords: string[]; disease: string; confidence: number }> = [
  {
    keywords: ["yellow spot", "yellow spots", "brown spot", "brown spots", "leaf spot", "blotch"],
    disease: "Leaf spot / blight",
    confidence: 68,
  },
  {
    keywords: ["curl", "curled", "twist", "leaf curl", "upward curl"],
    disease: "Leaf curl disease",
    confidence: 65,
  },
  {
    keywords: ["wilt", "wilting", "droop", "dried"],
    disease: "Wilt disease",
    confidence: 64,
  },
  {
    keywords: ["white powder", "powdery", "dust", "fungal"],
    disease: "Powdery mildew",
    confidence: 70,
  },
  {
    keywords: ["mosaic", "mottled", "patchy", "vein clearing"],
    disease: "Mosaic virus",
    confidence: 66,
  },
];

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

function normalizeConfidence(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.min(100, Math.round(value)));
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value.replace(/[^0-9.-]/g, ""));
    if (Number.isFinite(parsed)) {
      return Math.max(0, Math.min(100, Math.round(parsed)));
    }
  }

  return 0;
}

function normalizeDiseaseName(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  const cleaned = value.replace(/[^a-zA-Z0-9\s\-/]/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) {
    return "";
  }

  if (/unknown|unclear|not sure|cannot determine/i.test(cleaned)) {
    return "";
  }

  return cleaned;
}

function inferFromSymptoms(symptoms: string, query: string): VisionAnalysis | null {
  const source = `${symptoms} ${query}`.toLowerCase();

  for (const hint of DISEASE_HINTS) {
    if (hint.keywords.some((keyword) => source.includes(keyword))) {
      return {
        symptoms: symptoms || query || "Visible crop stress detected.",
        disease_name: hint.disease,
        confidence: hint.confidence,
      };
    }
  }

  return null;
}

function toDataUrl(image: string): string {
  const trimmed = image.trim();
  if (trimmed.startsWith("data:image/")) {
    return trimmed;
  }

  return `data:image/jpeg;base64,${trimmed}`;
}

function buildVisionPrompt(query: string, location?: CropLocation): string {
  return [
    "You are an agricultural expert.",
    "",
    "Analyze this crop image and describe:",
    "- visible symptoms",
    "- possible disease",
    "- confidence level",
    "",
    "If the image is blurry, infer the most likely disease from the visible symptoms instead of returning unknown.",
    "Never return unknown condition unless the image is completely unreadable.",
    "",
    "Return JSON:",
    '{',
    '  "symptoms": "",',
    '  "disease_name": "",',
    '  "confidence": ""',
    '}',
    "",
    location?.placeName ? `Location: ${location.placeName}` : "",
    query ? `Farmer query: ${query}` : "",
    "Use short, clear symptom phrases.",
  ]
    .filter(Boolean)
    .join("\n");
}

async function requestVisionAnalysis(image: string, query: string, location?: CropLocation): Promise<VisionAnalysis> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY is required for crop image analysis");
  }

  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), IMAGE_TIMEOUT_MS);

  try {
    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: IMAGE_MODEL,
        temperature: 0.2,
        max_completion_tokens: 300,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "Return only valid JSON. Use the image to identify symptoms and probable disease. If needed, infer the most likely disease from the visible symptoms.",
          },
          {
            role: "user",
            content: [
              { type: "text", text: buildVisionPrompt(query, location) },
              { type: "image_url", image_url: { url: toDataUrl(image) } },
            ],
          },
        ],
      }),
      signal: controller.signal,
    });

    const payload = (await response.json().catch(() => ({}))) as GroqImageResponse;
    if (!response.ok) {
      throw new Error(payload.error?.message ?? `Groq vision API error: HTTP ${response.status}`);
    }

    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("Groq vision response was empty");
    }

    const parsed = parseJsonObject<Partial<VisionAnalysis>>(content);
    if (!parsed) {
      throw new Error("Groq vision response was not valid JSON");
    }

    const symptoms = typeof parsed.symptoms === "string" ? parsed.symptoms.trim() : "";
    const diseaseName = normalizeDiseaseName(parsed.disease_name);
    const confidence = normalizeConfidence(parsed.confidence);

    const keywordFallback = inferFromSymptoms(symptoms, query);
    if (!diseaseName && keywordFallback) {
      return keywordFallback;
    }

    return {
      symptoms: symptoms || query || "Visible crop symptoms detected from image.",
      disease_name: diseaseName,
      confidence: confidence > 0 ? confidence : keywordFallback?.confidence ?? 0,
    };
  } finally {
    clearTimeout(timeoutHandle);
  }
}

export async function analyzeCropImage(
  image?: string,
  query?: string,
  location?: CropLocation,
): Promise<CropImageAnalysis & { source: "image" | "text" }> {
  const cleanQuery = query?.trim() ?? "";
  const cleanImage = image?.trim() ?? "";

  if (!cleanImage) {
    const fallback = inferFromSymptoms(cleanQuery, cleanQuery) ?? (await inferDisease(cleanQuery));
    return {
      symptoms: cleanQuery,
      disease_name: fallback.disease_name,
      confidence: fallback.confidence,
      source: "text",
    };
  }

  try {
    const vision = await requestVisionAnalysis(cleanImage, cleanQuery, location);
    const fallback = inferFromSymptoms(vision.symptoms, cleanQuery);

    return {
      symptoms: vision.symptoms || cleanQuery || "Visible crop symptoms detected from image.",
      disease_name: vision.disease_name || fallback?.disease_name || "Leaf spot / blight",
      confidence: vision.confidence || fallback?.confidence || 55,
      source: "image",
    };
  } catch (error) {
    console.error("analyzeCropImage fallback", error);
    const fallback = inferFromSymptoms(cleanQuery, cleanQuery) ?? (await inferDisease(cleanQuery));
    return {
      symptoms: cleanQuery || "Visible crop symptoms detected from image.",
      disease_name: fallback.disease_name || "Leaf spot / blight",
      confidence: fallback.confidence || 55,
      source: "text",
    };
  }
}
