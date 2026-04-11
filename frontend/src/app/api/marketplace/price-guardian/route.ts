import { NextRequest, NextResponse } from "next/server";

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
    return NextResponse.json({ error: "BACKEND_API_URL is not configured" }, { status: 503 });
  }

  for (const base of bases) {
    try {
      const response = await fetch(`${base}/market/price-guardian`, {
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

  return NextResponse.json({ error: "Unable to evaluate bid fairness" }, { status: 503 });
}
