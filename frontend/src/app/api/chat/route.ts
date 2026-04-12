import { NextRequest, NextResponse } from "next/server";

type ChatProxyPayload = {
  query?: string;
  message?: string;
  location?: {
    latitude?: number;
    longitude?: number;
    placeName?: string;
  };
  latitude?: number;
  longitude?: number;
  locale?: string;
  crop?: string;
  disease?: string;
  language?: string;
  landOwned?: boolean;
  incomeLevel?: string;
};

type ChatProxyResponse = {
  reply: string;
  final_message: string;
  intent: string;
  weather: Record<string, unknown>;
  crops: Record<string, unknown>;
  market: Record<string, unknown>;
  finance: Record<string, unknown>;
  agentResults: unknown[];
  timestamp: string;
  error?: string;
};

function backendCandidates(): string[] {
  const values = [
    process.env.BACKEND_API_URL,
    process.env.API_BASE_URL,
    process.env.NEXT_PUBLIC_API_URL,
    process.env.NEXT_PUBLIC_API_BASE_URL,
  ]
    .map((value) => (value ?? "").trim().replace(/\/$/, ""))
    .filter(Boolean)
    .filter((value) => !/localhost|127\.0\.0\.1/i.test(value));

  return [...new Set(values)];
}

function localReplyFor(message: string): string {
  const q = message.toLowerCase();

  if (/\b(crop|leaf|pest|disease|blight|fungus|wilt|spray|symptom)\b/.test(q)) {
    return "Quick crop fallback: isolate affected plants, inspect underside of leaves, avoid overwatering, and apply treatment only after confirming the disease pattern.";
  }

  if (/\b(weather|rain|temperature|humidity|storm|heat)\b/.test(q)) {
    return "Quick weather fallback: plan spraying only in dry windows, avoid fertilizer before heavy rain, and protect sensitive crops during high heat or storms.";
  }

  if (/\b(price|market|mandi|sell|buy|rate)\b/.test(q)) {
    return "Quick market fallback: compare nearby mandi modal prices and transport cost before selling; hold inventory briefly if trend is improving.";
  }

  if (/\b(loan|scheme|finance|subsidy|credit|insurance)\b/.test(q)) {
    return "Quick finance fallback: shortlist schemes by eligibility, compare interest and repayment terms, and apply with Aadhaar, bank, and land documents ready.";
  }

  return "Assistant fallback: share crop, weather, market, or finance details and I will provide practical next steps.";
}

function fallbackResponse(message: string): ChatProxyResponse {
  const reply = localReplyFor(message);

  return {
    reply,
    final_message: reply,
    intent: "general_query",
    weather: {},
    crops: {},
    market: {},
    finance: {},
    agentResults: [],
    timestamp: new Date().toISOString(),
    error: "Live backend unavailable",
  };
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as ChatProxyPayload;
  const query = typeof body.query === "string" ? body.query : typeof body.message === "string" ? body.message : "";

  const bases = backendCandidates();
  if (!bases.length) {
    return NextResponse.json(fallbackResponse(query), { status: 200 });
  }

  for (const base of bases) {
    try {
      const response = await fetch(`${base}/chat`, {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(body),
      });

      const text = await response.text();
      const parsed = (JSON.parse(text || "{}") ?? {}) as ChatProxyResponse;

      if (!response.ok) {
        continue;
      }

      if (!parsed.reply && !parsed.final_message) {
        continue;
      }

      return NextResponse.json(parsed, { status: 200 });
    } catch {
      // Try next backend candidate.
    }
  }

  return NextResponse.json(fallbackResponse(query), { status: 200 });
}
