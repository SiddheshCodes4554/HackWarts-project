import { NextRequest, NextResponse } from "next/server";

const FALLBACK_COMMODITIES = [
  { name: "Tomato", category: "Vegetables" },
  { name: "Onion", category: "Vegetables" },
  { name: "Wheat", category: "Grains" },
  { name: "Rice", category: "Grains" },
  { name: "Soybean", category: "Grains" },
  { name: "Cotton", category: "Grains" },
  { name: "Potato", category: "Vegetables" },
  { name: "Maize", category: "Grains" },
  { name: "Banana", category: "Fruits" },
  { name: "Mango", category: "Fruits" },
];

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
  const q = request.nextUrl.searchParams.get("q") ?? "";

  const fallback = () => {
    const search = q.trim().toLowerCase();
    const commodities = FALLBACK_COMMODITIES.filter((item) => !search || item.name.toLowerCase().includes(search));
    return NextResponse.json(
      {
        commodities,
        source: "fallback",
        warning: "Live backend unavailable. Showing fallback commodity list.",
      },
      { status: 200 },
    );
  };

  const bases = backendCandidates();
  if (!bases.length) {
    return fallback();
  }

  const query = new URLSearchParams({ district, state, q });

  for (const base of bases) {
    try {
      const response = await fetch(`${base}/commodities/list?${query.toString()}`, {
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
