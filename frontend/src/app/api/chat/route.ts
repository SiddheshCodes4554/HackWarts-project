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

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as ChatProxyPayload;
  const query = typeof body.query === "string" ? body.query : typeof body.message === "string" ? body.message : "";

  const bases = backendCandidates();
  if (!bases.length) {
    return NextResponse.json({ error: "Live AI unavailable" }, { status: 503 });
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

  return NextResponse.json({ error: "Live AI unavailable" }, { status: 503 });
}
