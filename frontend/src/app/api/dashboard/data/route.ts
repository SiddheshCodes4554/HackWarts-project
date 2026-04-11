import { NextRequest, NextResponse } from "next/server";

type DashboardPayload = {
  weather: {
    current: {
      temperature: number;
      humidity: number;
      windSpeed: number;
      rainProbability: number;
      icon: string;
      description: string;
    };
    forecast: Array<{
      label: string;
      temperature: number;
      rainProbability: number;
      humidity: number;
    }>;
  };
  soil: {
    ph: number;
    nitrogen: number;
    organicCarbon: number;
    soilType: string;
    recommendation: string;
    healthScore: number;
  };
  market: {
    markets: Array<{
      mandi: string;
      modalPrice: number;
      netProfit: number;
      distanceKm: number;
      district: string;
      state: string;
    }>;
    bestMarket: string;
    recommendation: string;
    signal: "SELL" | "HOLD";
    trend: Array<{
      date: string;
      price: number;
      arrivals: number;
    }>;
  };
  crops: {
    recommendations: Array<{
      crop: string;
      season: string;
      reasoning: string;
    }>;
    summary: string;
  };
  finance: {
    schemes: Array<{
      name: string;
      benefit: string;
      amountINR: number;
      eligibility: string;
    }>;
    advice: string;
  };
  insights: string[];
  warning?: string;
};

function fallbackDashboardPayload(reason: string): DashboardPayload {
  return {
    weather: {
      current: {
        temperature: 29,
        humidity: 58,
        windSpeed: 4,
        rainProbability: 22,
        icon: "01d",
        description: "Fallback weather",
      },
      forecast: [],
    },
    soil: {
      ph: 6.8,
      nitrogen: 0.18,
      organicCarbon: 0.95,
      soilType: "Balanced",
      recommendation: "Maintain balanced nutrients and moisture.",
      healthScore: 72,
    },
    market: {
      markets: [],
      bestMarket: "--",
      recommendation: "Market recommendation will appear shortly.",
      signal: "SELL",
      trend: [],
    },
    crops: {
      recommendations: [],
      summary: "Crop intelligence is warming up.",
    },
    finance: {
      schemes: [],
      advice: "Finance intelligence is warming up.",
    },
    insights: [
      "Dashboard is running in safe mode while live services connect.",
    ],
    warning: reason,
  };
}

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

  // Remove obvious local-only targets for deployed runtime.
  const filtered = candidates.filter((value) => !looksLocalhost(value));
  return [...new Set(filtered)];
}

export async function GET(request: NextRequest) {
  const latitude = request.nextUrl.searchParams.get("latitude");
  const longitude = request.nextUrl.searchParams.get("longitude");
  const placeName = request.nextUrl.searchParams.get("placeName") ?? "";

  const bases = candidateBackendUrls();
  if (bases.length === 0) {
    return NextResponse.json(
      fallbackDashboardPayload(
        "Backend URL is not configured for deployment. Set BACKEND_API_URL in frontend deployment env.",
      ),
      { status: 200 },
    );
  }

  const query = new URLSearchParams();
  if (latitude) {
    query.set("latitude", latitude);
  }
  if (longitude) {
    query.set("longitude", longitude);
  }
  if (placeName) {
    query.set("placeName", placeName);
  }

  for (const base of bases) {
    const endpoint = `${base}/dashboard/data?${query.toString()}`;
    try {
      const response = await fetch(endpoint, {
        method: "GET",
        cache: "no-store",
        headers: {
          Accept: "application/json",
        },
      });

      const body = await response.text();
      if (response.ok) {
        const payload = JSON.parse(body || "{}") as DashboardPayload;
        return NextResponse.json(payload, { status: 200 });
      }
    } catch {
      // Try next candidate.
    }
  }

  return NextResponse.json(
    fallbackDashboardPayload(
      "Live backend could not be reached from deployment. Verify BACKEND_API_URL and backend health endpoint.",
    ),
    { status: 200 },
  );
}
