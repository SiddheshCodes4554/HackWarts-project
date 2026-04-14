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

export async function POST(request: NextRequest) {
  const payload = await request.json().catch(() => ({}));

  const userId = typeof payload?.userId === "string" ? payload.userId.trim() : "";
  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  const bases = candidateBackendUrls();
  for (const base of bases) {
    const endpoint = `${base}/dashboard/run-analysis`;
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
        cache: "no-store",
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

  return NextResponse.json({ error: "Unable to run analysis" }, { status: 503 });
}
