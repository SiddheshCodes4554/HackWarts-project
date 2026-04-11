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

  const bases = backendCandidates();
  if (!bases.length) {
    return NextResponse.json({ error: "BACKEND_API_URL is not configured" }, { status: 503 });
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

  return NextResponse.json({ error: "Unable to fetch trending analytics from backend" }, { status: 503 });
}
