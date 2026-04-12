import { NextRequest, NextResponse } from "next/server";

function localModeration(body: Record<string, unknown>) {
  const text = String(body.text ?? body.content ?? body.caption ?? "");
  const lower = text.toLowerCase();
  const blocked = /\b(scam|fraud|hate|violence|abuse|kill)\b/.test(lower);
  const warning = !blocked && /\b(buy now|guaranteed profit|100% sure)\b/.test(lower);

  return {
    status: blocked ? "blocked" : warning ? "warning" : "safe",
    summary: text.slice(0, 180) || "No text provided.",
    tags: text
      .split(/\s+/)
      .map((word) => word.replace(/[^a-zA-Z0-9]/g, ""))
      .filter((word) => word.length > 3)
      .slice(0, 6),
    suggestions: blocked
      ? ["Remove unsafe language.", "Rewrite the post before publishing."]
      : ["Keep the post specific and concise.", "Add a crop or market detail if useful."],
    source: "fallback",
  };
}

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
  const body = await request.json().catch(() => ({}));
  const bases = backendCandidates();

  if (!bases.length) {
    return NextResponse.json(localModeration(body), { status: 200 });
  }

  for (const base of bases) {
    try {
      const response = await fetch(`${base}/community/moderate`, {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(body),
      });
      const text = await response.text();
      if (!response.ok) {
        continue;
      }
      return NextResponse.json(JSON.parse(text || "{}"), { status: 200 });
    } catch {
      // Try next backend candidate.
    }
  }

  return NextResponse.json(localModeration(body), { status: 200 });
}
