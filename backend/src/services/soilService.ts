import { SoilProfile } from "../utils/types";

const SOILGRIDS_API_URL = "https://rest.isric.org/soilgrids/v2.0/properties/query";
const SOIL_TIMEOUT_MS = 9000;

type SoilGridDepth = {
  label?: string;
  values?: {
    mean?: number;
  };
};

type SoilGridLayer = {
  name?: string;
  depths?: SoilGridDepth[];
};

type SoilGridPayload = {
  properties?: {
    layers?: SoilGridLayer[];
  };
};

function roundValue(value: number | null, digits = 2): number | null {
  if (!Number.isFinite(value ?? Number.NaN)) {
    return null;
  }

  const factor = 10 ** digits;
  return Math.round((value as number) * factor) / factor;
}

function extractLayerMean(layers: SoilGridLayer[], layerName: string): number | null {
  const layer = layers.find((entry) => entry.name?.toLowerCase() === layerName.toLowerCase());
  const depth = layer?.depths?.find((entry) => entry.label === "0-5cm") ?? layer?.depths?.[0];
  const meanValue = depth?.values?.mean;

  return Number.isFinite(meanValue) ? (meanValue as number) : null;
}

function inferTexture(clay: number | null, sand: number | null, silt: number | null): string {
  if (clay !== null && clay >= 40) {
    return "clayey";
  }

  if (sand !== null && sand >= 60) {
    return "sandy";
  }

  if (silt !== null && silt >= 40) {
    return "silty";
  }

  return "loamy";
}

function inferAcidity(ph: number | null): string {
  if (ph === null) {
    return "Unknown";
  }

  if (ph < 6) {
    return "Acidic";
  }

  if (ph > 7.5) {
    return "Alkaline";
  }

  return "Neutral";
}

function emptySoilProfile(): SoilProfile {
  return {
    ph: null,
    nitrogen: null,
    organicCarbon: null,
    soilType: "Unknown soil type",
    source: "soilgrids-unavailable",
  };
}

export async function getSoilProfile(latitude: number, longitude: number): Promise<SoilProfile> {
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), SOIL_TIMEOUT_MS);

  try {
    const params = new URLSearchParams();
    params.set("lon", String(longitude));
    params.set("lat", String(latitude));
    ["phh2o", "nitrogen", "soc", "clay", "sand", "silt"].forEach((property) => {
      params.append("property", property);
    });
    params.set("depth", "0-5cm");

    const response = await fetch(`${SOILGRIDS_API_URL}?${params.toString()}`, {
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`SoilGrids error: HTTP ${response.status}`);
    }

    const payload = (await response.json().catch(() => ({}))) as SoilGridPayload;
    const layers = payload.properties?.layers ?? [];

    const ph = roundValue(extractLayerMean(layers, "phh2o"), 2);
    const nitrogen = roundValue(extractLayerMean(layers, "nitrogen"), 3);
    const organicCarbon = roundValue(extractLayerMean(layers, "soc"), 2);
    const clay = extractLayerMean(layers, "clay");
    const sand = extractLayerMean(layers, "sand");
    const silt = extractLayerMean(layers, "silt");

    const acidity = inferAcidity(ph);
    const texture = inferTexture(clay, sand, silt);
    const soilType = acidity === "Unknown" ? `${texture} soil` : `${acidity} ${texture} soil`;

    return {
      ph,
      nitrogen,
      organicCarbon,
      soilType,
      source: "soilgrids",
    };
  } catch (error) {
    console.error("Soil profile fallback", error);
    return emptySoilProfile();
  } finally {
    clearTimeout(timeoutHandle);
  }
}
