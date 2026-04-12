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

export async function GET(request: NextRequest) {
  const district = request.nextUrl.searchParams.get("district") ?? "";
  const state = request.nextUrl.searchParams.get("state") ?? "";

  const FALLBACK_TRENDS = [
    { name: "Tomato", direction: "up", score: 92 },
    { name: "Onion", direction: "up", score: 88 },
    { name: "Wheat", direction: "steady", score: 81 },
    { name: "Rice", direction: "steady", score: 79 },
    { name: "Cotton", direction: "down", score: 67 },
  ];

  const fallback = () =>
    NextResponse.json(
      {
        trends: FALLBACK_TRENDS,
        source: "fallback",
        warning: "Live backend unavailable. Showing fallback market trends.",
      },
      { status: 200 },
    );

  const bases = backendCandidates();
  if (!bases.length) {
    return fallback();
  }

  const query = new URLSearchParams({ district, state });

  for (const base of bases) {
    try {
      const response = await fetch(`${base}/market/trending?${query.toString()}`, {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      const body = await response.text();
      if (!response.ok) {
        continue;
      }
      return NextResponse.json(JSON.parse(body || "{}"), { status: 200 });
    } catch {
      // Try next backend candidate.
    }
  }

  return fallback();
}
