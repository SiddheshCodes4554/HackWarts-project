import { NextRequest, NextResponse } from "next/server";

function backendCandidates(): string[] {
  return [
    process.env.BACKEND_API_URL,
    process.env.API_BASE_URL,
    process.env.NEXT_PUBLIC_API_URL,
    process.env.NEXT_PUBLIC_API_BASE_URL,
  ]
    .map((value) => (value ?? "").trim().replace(/\/$/, ""))
    .filter(Boolean);
}

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("userId") ?? "";
  const bases = backendCandidates();

  if (!bases.length) {
    return NextResponse.json({ error: "Live farm service unavailable" }, { status: 503 });
  }

  for (const base of bases) {
    try {
      const response = await fetch(`${base}/farm?userId=${encodeURIComponent(userId)}`, {
        method: "GET",
        cache: "no-store",
        headers: {
          Accept: "application/json",
        },
      });

      const text = await response.text();
      const parsed = text ? JSON.parse(text) : {};

      if (!response.ok) {
        if (response.status === 404) {
          return NextResponse.json({ error: "Farm not found" }, { status: 404 });
        }

        continue;
      }

      return NextResponse.json(parsed, { status: 200 });
    } catch {
      // Try the next backend candidate.
    }
  }

  return NextResponse.json({ error: "Live farm service unavailable" }, { status: 503 });
}

export async function POST(request: NextRequest) {
  const payload = await request.json().catch(() => ({}));
  const bases = backendCandidates();

  if (!bases.length) {
    return NextResponse.json({ error: "Live farm service unavailable" }, { status: 503 });
  }

  for (const base of bases) {
    try {
      const response = await fetch(`${base}/farm`, {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      const text = await response.text();
      const parsed = text ? JSON.parse(text) : {};

      if (!response.ok) {
        continue;
      }

      return NextResponse.json(parsed, { status: 200 });
    } catch {
      // Try the next backend candidate.
    }
  }

  return NextResponse.json({ error: "Live farm service unavailable" }, { status: 503 });
}
