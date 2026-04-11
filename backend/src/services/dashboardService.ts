import { cropAgent } from "../agents/cropAgent";
import { getFinancialAdvice } from "../agents/financeAgent";
import { getMarketData } from "../agents/marketAgent";
import { weatherAgent } from "../agents/weatherAgent";
import { DashboardData, DashboardLocation } from "../utils/types";
import { getSoilProfile } from "./soilService";

function toWeatherFromMetadata(metadata: Record<string, string | number | boolean> | undefined) {
  const temperature = Number(metadata?.temperature);
  const rainfall = Number(metadata?.rainfall);
  const humidity = Number(metadata?.humidity);
  const windSpeed = Number(metadata?.windSpeed);

  if (![temperature, rainfall, humidity, windSpeed].every(Number.isFinite)) {
    throw new Error("Weather metadata missing or invalid");
  }

  const advice = typeof metadata?.advice === "string" ? metadata.advice : "";
  if (!advice) {
    throw new Error("Weather advice missing from metadata");
  }

  return {
    temperature,
    rainfall,
    humidity,
    windSpeed,
    advice,
  };
}

export async function getDashboardData(location: DashboardLocation): Promise<DashboardData> {
  const timestamp = new Date().toISOString();
  const context = {
    message: `Dashboard intelligence request for ${location.placeName}`,
    locale: location.placeName,
    latitude: location.latitude,
    longitude: location.longitude,
    timestamp,
  };

  const [weatherResult, soilResult, financeResult] = await Promise.allSettled([
    weatherAgent(context),
    getSoilProfile(location.latitude, location.longitude),
    getFinancialAdvice(location.placeName),
  ]);

  if (weatherResult.status === "rejected") {
    throw new Error(`Weather service error: ${String(weatherResult.reason)}`);
  }

  if (soilResult.status === "rejected") {
    throw new Error(`Soil service error: ${String(soilResult.reason)}`);
  }

  if (financeResult.status === "rejected") {
    throw new Error(`Finance service error: ${String(financeResult.reason)}`);
  }

  const weather = toWeatherFromMetadata(weatherResult.value.metadata);
  const soil = soilResult.value;
  const crops = await cropAgent(context, weather, soil);

  const selectedCrop = crops.recommendations[0]?.crop;
  if (!selectedCrop) {
    throw new Error("Crop service did not return any recommendations");
  }

  const market = await getMarketData({
    crop: selectedCrop,
    location: location.placeName,
    latitude: location.latitude,
    longitude: location.longitude,
    temperature: weather.temperature,
    rainfall: weather.rainfall,
  });

  return {
    weather,
    crops,
    market,
    finance: financeResult.value,
    soil,
  };
}
