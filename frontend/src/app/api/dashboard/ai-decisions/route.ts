import { NextRequest, NextResponse } from "next/server";

function looksLocalhost(url: string): boolean {
  return /localhost|127\.0\.0\.1/i.test(url);
}

function candidateBackendUrls(): string[] {
  const candidates = [
    process.env.BACKEND_API_URL,
    process.env.API_BASE_URL,
    process.env.NEXT_PUBLIC_API_URL,
    process.env.NEXT_PUBLIC_API_BASE_URL,
  ]
    .map((value) => (value ?? "").trim().replace(/\/$/, ""))
    .filter(Boolean);

  const filtered = candidates.filter((value) => !looksLocalhost(value));
  return [...new Set(filtered)];
}

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("userId") ?? "";
  const limit = request.nextUrl.searchParams.get("limit") ?? "10";

  if (!userId.trim()) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  const bases = candidateBackendUrls();
  for (const base of bases) {
    const endpoint = `${base}/dashboard/ai-decisions?userId=${encodeURIComponent(userId)}&limit=${encodeURIComponent(limit)}`;
    try {
      const response = await fetch(endpoint, {
        method: "GET",
        cache: "no-store",
        headers: {
          Accept: "application/json",
        },
      });

      const body = await response.text();
      const parsed = JSON.parse(body || "{}");
      if (response.ok) {
        return NextResponse.json(parsed, { status: 200 });
      }
    } catch {
      // Try next backend candidate.
    }
  }

  return NextResponse.json(
    {
      topAlerts: [],
      recommendations: [],
      summary: "AI Farm Brief is temporarily unavailable.",
    },
    { status: 200 },
  );
}
