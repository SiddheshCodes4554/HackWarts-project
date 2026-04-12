/**
 * NASA POWER API Service
 * Provides daily meteorological and climate data for soil and crop analysis
 * 
 * API: https://power.larc.nasa.gov/api/temporal/daily/point
 * No authentication required
 * 
 * Data includes:
 * - Temperature (daily min/max/mean)
 * - Precipitation (rainfall)
 * - Solar radiation
 * - Relative humidity
 * - Wind speed
 * - Soil moisture
 */

const NASA_API_URL = process.env.NEXT_PUBLIC_NASA_URL ?? "https://power.larc.nasa.gov/api/temporal/daily/point";
const NASA_TIMEOUT_MS = 8000;

export interface NASAClimateData {
  temperature_mean: number;
  temperature_min: number;
  temperature_max: number;
  precipitation: number;
  relative_humidity: number;
  wind_speed: number;
  solar_radiation: number;
  soil_moisture?: number;
  date: string;
}

export interface NASAAnalysis {
  daily_avg_temp: number;
  monthly_rainfall: number;
  avg_humidity: number;
  solar_energy: number;
  wind_data: number;
  moisture_trend: string;
  frost_risk: number;
  drought_risk: number;
  flood_risk: number;
  recommendations: string[];
}

interface NASAAPIResponse {
  properties?: {
    parameter?: Record<string, Record<string, number>>;
  };
}

/**
 * Fetch NASA POWER data for a specific location and date range
 */
async function fetchNASAData(
  latitude: number,
  longitude: number,
  endDate?: string
): Promise<NASAClimateData[] | null> {
  try {
    // Default to last 30 days
    const today = new Date();
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    const startDate = "20260312"; // Format: YYYYMMDD
    const end = endDate || today.toISOString().split("T")[0].replace(/-/g, "");

    const params = new URLSearchParams({
      start: startDate,
      end,
      latitude: String(latitude),
      longitude: String(longitude),
      community: "RE",
      parameters: "T2M,T2M_MIN,T2M_MAX,PRECTOTCORR,RH2M,WS2M,ALLSKY_SFC_SW_DWN,GWETTOP", // Include soil moisture (GWETTOP)
      format: "JSON",
    });

    const url = `${NASA_API_URL}?${params}`;

    const response = await Promise.race([
      fetch(url),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("NASA API timeout")), NASA_TIMEOUT_MS)
      ),
    ]);

    if (!response.ok) {
      console.error(`NASA API error: ${response.status}`);
      return null;
    }

    const data = (await response.json()) as NASAAPIResponse;

    if (!data.properties?.parameter) {
      console.error("Invalid NASA response structure");
      return null;
    }

    const params_data = data.properties.parameter;

    // Parse the data into daily records
    const climateData: NASAClimateData[] = [];

    // Get the keys from one of the parameters to determine available dates
    const dateKeys = Object.keys(params_data.T2M || {});

    for (const dateKey of dateKeys) {
      const date = `${dateKey.substring(0, 4)}-${dateKey.substring(4, 6)}-${dateKey.substring(6, 8)}`;

      climateData.push({
        date,
        temperature_mean: Math.round((params_data.T2M?.[dateKey] ?? 0) * 10) / 10,
        temperature_min: Math.round((params_data.T2M_MIN?.[dateKey] ?? 0) * 10) / 10,
        temperature_max: Math.round((params_data.T2M_MAX?.[dateKey] ?? 0) * 10) / 10,
        precipitation: Math.round((params_data.PRECTOTCORR?.[dateKey] ?? 0) * 100) / 100,
        relative_humidity: Math.round(params_data.RH2M?.[dateKey] ?? 0),
        wind_speed: Math.round((params_data.WS2M?.[dateKey] ?? 0) * 100) / 100,
        solar_radiation: Math.round((params_data.ALLSKY_SFC_SW_DWN?.[dateKey] ?? 0) * 10) / 10,
        soil_moisture: Math.round((params_data.GWETTOP?.[dateKey] ?? 0) * 100) / 100, // 0-1 scale
      });
    }

    return climateData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  } catch (error) {
    console.error("Error fetching NASA data:", error);
    return null;
  }
}

/**
 * Analyze NASA climate data to generate soil and crop recommendations
 */
export async function analyzeNASAData(
  latitude: number,
  longitude: number
): Promise<NASAAnalysis | null> {
  try {
    const climateData = await fetchNASAData(latitude, longitude);

    if (!climateData || climateData.length === 0) {
      return null;
    }

    // Calculate statistics
    const temps = climateData.map(d => d.temperature_mean);
    const rainfall = climateData.map(d => d.precipitation);
    const humidity = climateData.map(d => d.relative_humidity);
    const radiation = climateData.map(d => d.solar_radiation);
    const wind = climateData.map(d => d.wind_speed);
    const moisture = climateData.map(d => d.soil_moisture ?? 0);

    const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

    const avgTemp = Math.round(avg(temps) * 10) / 10;
    const totalRainfall = Math.round(rainfall.reduce((a, b) => a + b, 0) * 100) / 100;
    const avgHumidity = Math.round(avg(humidity));
    const avgRadiation = Math.round(avg(radiation) * 10) / 10;
    const avgWind = Math.round(avg(wind) * 100) / 100;
    const avgMoisture = Math.round(avg(moisture) * 100) / 100;

    // Calculate risks
    const frostDays = climateData.filter(d => d.temperature_min < 0).length;
    const frostRisk = Math.min(100, (frostDays / climateData.length) * 100);

    const dryDays = climateData.filter(d => d.precipitation < 0.1 && d.soil_moisture! < 0.3).length;
    const droughtRisk = Math.min(100, (dryDays / climateData.length) * 100);

    const wetDays = climateData.filter(d => d.precipitation > 10).length;
    const floodRisk = Math.min(100, (wetDays / climateData.length) * 100);

    // Determine moisture trend
    const recentMoisture = moisture.slice(-7);
    const oldMoisture = moisture.slice(0, 7);
    const recentAvg = avg(recentMoisture);
    const oldAvg = avg(oldMoisture);
    const moistureTrend = recentAvg > oldAvg ? "improving" : recentAvg < oldAvg ? "declining" : "stable";

    // Generate recommendations
    const recommendations: string[] = [];

    if (avgTemp < 15) {
      recommendations.push("Temperature is low - grow cold-tolerant crops (wheat, peas)");
    } else if (avgTemp > 28) {
      recommendations.push("Temperature is high - provide shade and irrigation for heat-sensitive crops");
    }

    if (totalRainfall < 100) {
      recommendations.push("Low rainfall - plan irrigation schedules and mulch to retain moisture");
    } else if (totalRainfall > 200) {
      recommendations.push("High rainfall - improve drainage and monitor for fungal diseases");
    }

    if (avgHumidity < 40) {
      recommendations.push("Low humidity - increase watering frequency to prevent crop stress");
    } else if (avgHumidity > 80) {
      recommendations.push("High humidity - ensure good air circulation to prevent diseases");
    }

    if (droughtRisk > 50) {
      recommendations.push("Drought risk detected - choose drought-tolerant varieties and drip irrigation");
    }

    if (frostRisk > 20) {
      recommendations.push("Frost risk present - protect sensitive crops with mulch or covers");
    }

    if (avgRadiation < 10) {
      recommendations.push("Low solar radiation - grow shade-tolerant crops or supplement with lighting");
    } else if (avgRadiation > 20) {
      recommendations.push("High solar radiation - ensure adequate water supply for photosynthesis");
    }

    return {
      daily_avg_temp: avgTemp,
      monthly_rainfall: totalRainfall,
      avg_humidity: avgHumidity,
      solar_energy: avgRadiation,
      wind_data: avgWind,
      moisture_trend: moistureTrend,
      frost_risk: Math.round(frostRisk),
      drought_risk: Math.round(droughtRisk),
      flood_risk: Math.round(floodRisk),
      recommendations: recommendations.slice(0, 5), // Top 5 recommendations
    };
  } catch (error) {
    console.error("Error analyzing NASA data:", error);
    return null;
  }
}

/**
 * Get NASA-based irrigation recommendation
 */
export async function getNASAIrrigationAdvice(
  latitude: number,
  longitude: number
): Promise<{ schedule: string; interval_days: number; depth_mm: number }> {
  try {
    const analysis = await analyzeNASAData(latitude, longitude);

    if (!analysis) {
      // Default fallback
      return {
        schedule: "Every 2-3 days based on rainfall",
        interval_days: 2,
        depth_mm: 25,
      };
    }

    // Calculate interval based on rainfall and evaporation
    let interval = 3;
    let depth = 25;

    if (analysis.monthly_rainfall < 50) {
      interval = 1; // Daily in dry periods
      depth = 30;
    } else if (analysis.monthly_rainfall < 100) {
      interval = 2;
      depth = 28;
    } else if (analysis.monthly_rainfall > 200) {
      interval = 5; // Less frequent in rainy season
      depth = 20;
    }

    // Adjust for temperature
    if (analysis.daily_avg_temp > 30) {
      depth += 5; // More water needed in heat
      interval = Math.max(1, interval - 1);
    }

    // Adjust for humidity
    if (analysis.avg_humidity > 70) {
      depth -= 5; // Less water needed in humid conditions
    }

    const scheduleMap: Record<number, string> = {
      1: "Daily (or every other day)",
      2: "Every 2-3 days",
      3: "Every 3-4 days",
      4: "Every 4-5 days",
      5: "Every 5-7 days (weekly)",
    };

    return {
      schedule: scheduleMap[interval] || "As needed based on soil moisture",
      interval_days: interval,
      depth_mm: Math.round(depth),
    };
  } catch (error) {
    console.error("Error getting irrigation advice:", error);
    return {
      schedule: "Every 2-3 days (default)",
      interval_days: 2,
      depth_mm: 25,
    };
  }
}
