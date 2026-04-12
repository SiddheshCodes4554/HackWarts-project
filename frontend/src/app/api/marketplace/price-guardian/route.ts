import { NextRequest, NextResponse } from "next/server";

function localPriceGuardian(body: Record<string, unknown>) {
  const offeredPrice = Number(body.offeredPrice ?? body.price ?? 0);
  const marketPrice = Number(body.marketPrice ?? body.referencePrice ?? 0);
  const ratio = marketPrice > 0 ? offeredPrice / marketPrice : 1;
  const verdict = ratio >= 0.95 ? "fair" : ratio >= 0.85 ? "slightly_low" : "low";

  return {
    verdict,
    confidence: Math.max(0.55, Math.min(0.95, 1 - Math.abs(1 - ratio))),
    explanation:
      marketPrice > 0
        ? `Fallback fairness check against reference price ${marketPrice}.`
        : "Fallback fairness check used because live backend is unavailable.",
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
    return NextResponse.json(localPriceGuardian(body), { status: 200 });
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

  return NextResponse.json(localPriceGuardian(body), { status: 200 });
}
