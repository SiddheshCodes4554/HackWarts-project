import { CropAdviceInput, CropContextSnapshot } from "../utils/types";

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function extractDistrictState(placeName: string): { district: string; state: string } {
  const cleaned = placeName.trim().replace(/\s+/g, " ");
  const parts = cleaned.split(",").map((part) => part.trim()).filter(Boolean);

  if (parts.length >= 2) {
    return {
      district: titleCase(parts[0]),
      state: titleCase(parts[1]),
    };
  }

  if (parts.length === 1) {
    return {
      district: titleCase(parts[0]),
      state: "India",
    };
  }

  return {
    district: "Unknown District",
    state: "India",
  };
}

function determineSeason(temperature: number, rainfall: number): string {
  if (rainfall > 60) {
    return "Kharif (Rainy)";
  }

  if (temperature < 20) {
    return "Rabi (Winter)";
  }

  return "Zaid (Summer)";
}

function describeWeather(weather: CropAdviceInput["weather"]): string {
  const temperatureBand =
    weather.temperature >= 35
      ? "high temperature"
      : weather.temperature >= 28
        ? "warm temperature"
        : weather.temperature >= 20
          ? "moderate temperature"
          : "cool temperature";
  const rainfallBand =
    weather.rainfall > 60
      ? "heavy rainfall"
      : weather.rainfall > 20
        ? "moderate rainfall"
        : "low rainfall";
  const humidityBand =
    weather.humidity >= 75 ? "high humidity" : weather.humidity >= 50 ? "moderate humidity" : "low humidity";

  return `Last 7 days: ${temperatureBand}, ${rainfallBand}, ${humidityBand}`;
}

function inferGrowthStage(crop?: string, query?: string): string {
  const sourceText = `${crop ?? ""} ${query ?? ""}`.toLowerCase();
  const stages = ["seedling", "vegetative", "flowering", "fruiting", "maturity", "harvest"];

  for (const stage of stages) {
    if (sourceText.includes(stage)) {
      return titleCase(stage);
    }
  }

  return "Unspecified";
}

export function buildCropContext(input: CropAdviceInput): CropContextSnapshot {
  const { district, state } = extractDistrictState(input.location.placeName);

  return {
    district,
    state,
    season: determineSeason(input.weather.temperature, input.weather.rainfall),
    weather_summary: describeWeather(input.weather),
    soil_type: input.soil.soilType || "Unknown soil type",
    growth_stage: inferGrowthStage(input.crop, input.query),
  };
}
