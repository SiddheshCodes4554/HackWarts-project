import {
  DEFAULT_GOVERNMENT_SCHEMES_API_URL,
  GOVERNMENT_SCHEMES,
} from "../data/governmentSchemes";
import { GovernmentScheme } from "../utils/types";

const SCHEME_API_TIMEOUT_MS = 12000;
let schemeFallbackWarned = false;

type RequestVariant = {
  label: string;
  url: string;
  method: "GET" | "POST";
  headers: Record<string, string>;
  body?: string;
};

type LiveSchemeCatalog = {
  schemes: GovernmentScheme[];
  fetched_at: string;
  data_source: string;
  api_live: boolean;
};

type ApiRecord = {
  scheme_name?: string;
  name?: string;
  title?: string;
  benefit?: string;
  benefits?: string;
  details?: string;
  eligibility?: string;
  documents?: string;
  apply_steps?: string;
  url?: string;
  link?: string;
  last_updated?: string;
  updated_at?: string;
};

function toText(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() || fallback : fallback;
}

function splitList(value: string): string[] {
  return value
    .split(/\n|\r|;|\.|\|/) 
    .map((item) => item.replace(/^[-*\s]+/, "").trim())
    .filter(Boolean)
    .slice(0, 6);
}

function schemeKey(name: string): string {
  const normalized = name.toLowerCase();

  if (normalized.includes("pm-kisan") || normalized.includes("pm kisan")) {
    return "PM-KISAN";
  }

  if (normalized.includes("kisan credit") || normalized.includes("kcc")) {
    return "Kisan Credit Card (KCC)";
  }

  if (normalized.includes("pmfby") || normalized.includes("crop insurance") || normalized.includes("fasal bima")) {
    return "PMFBY (Crop Insurance)";
  }

  if (normalized.includes("soil health")) {
    return "Soil Health Card";
  }

  if (normalized.includes("nabard")) {
    return "NABARD Micro Loan";
  }

  return "";
}

function parseApiPayload(payload: unknown): ApiRecord[] {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  const source = payload as {
    records?: ApiRecord[];
    result?: { records?: ApiRecord[] };
    data?: ApiRecord[];
    schemes?: ApiRecord[];
  };

  return source.records ?? source.result?.records ?? source.data ?? source.schemes ?? [];
}

function mergeLiveRecord(base: GovernmentScheme, record: ApiRecord | undefined): GovernmentScheme {
  if (!record) {
    return base;
  }

  const benefit = toText(record.benefit) || toText(record.benefits) || toText(record.details) || base.benefit;
  const eligibility = splitList(toText(record.eligibility));
  const documents = splitList(toText(record.documents));
  const steps = splitList(toText(record.apply_steps));

  return {
    ...base,
    benefit,
    eligibility: eligibility.length > 0 ? eligibility : base.eligibility,
    documents: documents.length > 0 ? documents : base.documents,
    apply_steps: steps.length > 0 ? steps : base.apply_steps,
    source: "government-api",
    source_url: toText(record.url) || toText(record.link) || base.source_url,
    last_updated: toText(record.last_updated) || toText(record.updated_at) || new Date().toISOString(),
  };
}

async function fetchFromGovernmentApi(): Promise<LiveSchemeCatalog> {
  const apiUrl = process.env.GOVERNMENT_SCHEMES_API_URL ?? DEFAULT_GOVERNMENT_SCHEMES_API_URL;
  const apiKey = process.env.GOVERNMENT_SCHEMES_API_KEY ?? "";

  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), SCHEME_API_TIMEOUT_MS);

  try {
    const baseHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
      Accept: "application/json",
    };

    const query = new URLSearchParams();
    query.set("q", "farmer scheme india");
    query.set("limit", "100");
    query.set("_ts", Date.now().toString());

    const getUrl = `${apiUrl}?${query.toString()}`;
    const getUrlWithQueryKey = apiKey
      ? `${getUrl}&api-key=${encodeURIComponent(apiKey)}`
      : getUrl;

    const variants: RequestVariant[] = [
      {
        label: "GET x-api-key + bearer",
        url: getUrl,
        method: "GET",
        headers: apiKey
          ? { ...baseHeaders, "x-api-key": apiKey, Authorization: `Bearer ${apiKey}` }
          : baseHeaders,
      },
      {
        label: "GET x-api-key",
        url: getUrl,
        method: "GET",
        headers: apiKey ? { ...baseHeaders, "x-api-key": apiKey } : baseHeaders,
      },
      {
        label: "GET bearer",
        url: getUrl,
        method: "GET",
        headers: apiKey ? { ...baseHeaders, Authorization: `Bearer ${apiKey}` } : baseHeaders,
      },
      {
        label: "GET query api-key",
        url: getUrlWithQueryKey,
        method: "GET",
        headers: baseHeaders,
      },
      {
        label: "POST x-api-key",
        url: apiUrl,
        method: "POST",
        headers: apiKey ? { ...baseHeaders, "x-api-key": apiKey } : baseHeaders,
        body: JSON.stringify({ q: "farmer scheme india", limit: 100 }),
      },
    ];

    let payload: unknown = {};
    let lastError: Error | null = null;

    for (const variant of variants) {
      try {
        const response = await fetch(variant.url, {
          method: variant.method,
          headers: variant.headers,
          body: variant.body,
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Government schemes API failed: HTTP ${response.status} via ${variant.label}`);
        }

        payload = await response.json().catch(() => ({}));
        lastError = null;
        break;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error("Unknown government API error");
      }
    }

    if (lastError) {
      throw lastError;
    }

    const records = parseApiPayload(payload);

    const liveMap = new Map<string, ApiRecord>();
    for (const record of records) {
      const name = toText(record.scheme_name) || toText(record.name) || toText(record.title);
      const key = schemeKey(name);
      if (key && !liveMap.has(key)) {
        liveMap.set(key, record);
      }
    }

    const schemes = GOVERNMENT_SCHEMES.map((base) => mergeLiveRecord(base, liveMap.get(base.name)));

    return {
      schemes,
      fetched_at: new Date().toISOString(),
      data_source: apiUrl,
      api_live: true,
    };
  } finally {
    clearTimeout(timeoutHandle);
  }
}

export async function fetchGovernmentSchemesCatalog(): Promise<LiveSchemeCatalog> {
  try {
    return await fetchFromGovernmentApi();
  } catch (error) {
    if (!schemeFallbackWarned) {
      const message = error instanceof Error ? error.message : "catalog unavailable";
      if (message.includes("HTTP 403")) {
        console.info("Government schemes API key rejected (HTTP 403); using baseline schemes catalog.");
      } else {
        console.warn(`Using fallback government schemes catalog (${message})`);
      }
      schemeFallbackWarned = true;
    }
    return {
      schemes: GOVERNMENT_SCHEMES,
      fetched_at: new Date().toISOString(),
      data_source: "baseline",
      api_live: false,
    };
  }
}
