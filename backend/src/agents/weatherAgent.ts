import { AgentContext, AgentResult, WeatherAdvisory } from "../utils/types";

const OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast";
const WEATHER_TIMEOUT_MS = 8000;

type OpenMeteoCurrent = {
  temperature_2m?: number;
  precipitation?: number;
  relative_humidity_2m?: number;
};

type OpenMeteoResponse = {
  current?: OpenMeteoCurrent;
};

function roundToOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

function buildAdvice(temperature: number, rainfall: number, humidity: number): string {
  if (rainfall >= 5) {
    return "Heavy rain expected. Pause irrigation and improve field drainage to avoid root stress.";
  }

  if (temperature >= 35 && humidity < 45) {
    return "High heat with dry air. Irrigate early morning and add mulch to reduce moisture loss.";
  }

  if (humidity >= 85 && rainfall > 0) {
    return "Humid and wet conditions. Monitor for fungal disease and increase airflow around crops.";
  }

  if (temperature <= 15) {
    return "Cool weather conditions. Reduce irrigation frequency and protect sensitive young plants.";
  }

  return "Weather is moderate. Continue planned irrigation and monitor crop moisture during the day.";
}

function fallbackWeatherAdvisory(): WeatherAdvisory {
  return {
    temperature: 28,
    rainfall: 0,
    advice:
      "Live weather feed is temporarily unavailable. Use local field conditions before making irrigation decisions.",
  };
}

export async function getWeatherAdvisory(
  latitude: number,
  longitude: number,
): Promise<WeatherAdvisory> {
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), WEATHER_TIMEOUT_MS);

  try {
    const params = new URLSearchParams({
      latitude: String(latitude),
      longitude: String(longitude),
      current: "temperature_2m,precipitation,relative_humidity_2m",
      timezone: "auto",
    });

    const response = await fetch(`${OPEN_METEO_URL}?${params.toString()}`, {
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Open-Meteo error: HTTP ${response.status}`);
    }

    const payload = (await response.json()) as OpenMeteoResponse;
    const current = payload.current;

    if (!current) {
      throw new Error("Open-Meteo response missing current weather data.");
    }

    const temperature = Number(current.temperature_2m ?? 28);
    const rainfall = Number(current.precipitation ?? 0);
    const humidity = Number(current.relative_humidity_2m ?? 60);

    return {
      temperature: roundToOneDecimal(temperature),
      rainfall: roundToOneDecimal(rainfall),
      advice: buildAdvice(temperature, rainfall, humidity),
    };
  } catch (error) {
    console.error("Weather advisory fallback", error);
    return fallbackWeatherAdvisory();
  } finally {
    clearTimeout(timeoutHandle);
  }
}

export async function weatherAgent(context: AgentContext): Promise<AgentResult> {
  const latitude = Number.isFinite(context.latitude) ? (context.latitude as number) : 18.5204;
  const longitude = Number.isFinite(context.longitude) ? (context.longitude as number) : 73.8567;
  const advisory = await getWeatherAdvisory(latitude, longitude);

  return {
    agent: "weather",
    insight: `Temperature ${advisory.temperature}°C, rainfall ${advisory.rainfall} mm. ${advisory.advice}`,
    confidence: 0.86,
    metadata: {
      locale: context.locale ?? "global",
      source: "open-meteo",
      temperature: advisory.temperature,
      rainfall: advisory.rainfall,
      latitude: roundToOneDecimal(latitude),
      longitude: roundToOneDecimal(longitude),
    },
  };
}
