import { getMarketIntelligence } from './marketIntelligence';
import { getSoilProfile } from './soilService';
import { generateResponse } from './groqService';
import { analyzeNASAData, getNASAIrrigationAdvice, NASAAnalysis } from './nasaDataService';
import { DashboardLocation } from '../utils/types';

const INTELLIGENCE_TIMEOUT_MS = 20_000;

interface FarmerLocation {
  latitude: number;
  longitude: number;
  district: string;
}

interface CropTrendData {
  name: string;
  price: number;
  change_percent: number;
  trend: 'rising' | 'falling' | 'stable';
  frequency: number;
}

interface SoilAnalysis {
  soil_score: number;
  ph: number;
  nitrogen: number;
  organicCarbon: number;
  acidity: string;
  issues: string[];
  recommendations: string[];
}

interface WeatherImpact {
  temperature_optimal: boolean;
  rainfall_adequate: boolean;
  suitability_score: number;
  risk_alerts: string[];
  recommendations: string[];
}

interface AICropRecommendation {
  crop: string;
  reason: string;
  profit_potential: number;
  season: string;
  confidence: number;
}

interface FarmInsight {
  title: string;
  description: string;
  icon: string;
  priority: 'high' | 'medium' | 'low';
}

interface HistoricalMonthlyPoint {
  crop: string;
  month: string;
  avg_price: number;
  growth_rate: number;
}

interface HistoricalYearlyPoint {
  crop: string;
  year: string;
  avg_price: number;
  growth_rate: number;
}

export interface FarmIntelligence {
  timestamp: string;
  location: {
    district: string;
    latitude: number;
    longitude: number;
  };
  top_crops: CropTrendData[];
  soil_analysis: SoilAnalysis;
  weather_impact: WeatherImpact;
  nasa_climate_analysis?: {
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
  };
  irrigation_advice?: {
    schedule: string;
    interval_days: number;
    depth_mm: number;
  };
  historical_trends: {
    monthly: HistoricalMonthlyPoint[];
    yearly: HistoricalYearlyPoint[];
  };
  best_crop_recommendation: AICropRecommendation;
  market_opportunities: Array<{
    crop: string;
    price_trend: string;
    potential_profit: string;
  }>;
  actionable_insights: FarmInsight[];
  summary: string;
}

/**
 * Extract district from location
 */
function extractDistrict(placeName: string): string {
  // Extract district from place name (format: "City, District, State" or "City, State")
  const parts = placeName.split(',').map(p => p.trim());
  
  if (parts.length >= 2) {
    return parts[1]; // Return district/second part
  }
  
  return parts[0] || 'Unknown District';
}

function monthLabel(dateValue: string): string {
  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) {
    return dateValue.slice(0, 7);
  }

  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}`;
}

function yearLabel(dateValue: string): string {
  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) {
    return dateValue.slice(0, 4);
  }

  return String(parsed.getFullYear());
}

function groupMonthlyTrend(crop: string, chart: Array<{ date: string; price: number }>): HistoricalMonthlyPoint[] {
  const groups = new Map<string, number[]>();

  for (const point of chart) {
    const key = monthLabel(point.date);
    const bucket = groups.get(key) ?? [];
    bucket.push(point.price);
    groups.set(key, bucket);
  }

  const sorted = Array.from(groups.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, prices]) => {
      const avg = prices.reduce((sum, value) => sum + value, 0) / prices.length;
      return {
        crop,
        month,
        avg_price: Math.round(avg),
        growth_rate: 0,
      };
    });

  for (let index = 1; index < sorted.length; index += 1) {
    const previous = sorted[index - 1].avg_price;
    const current = sorted[index].avg_price;
    sorted[index].growth_rate = previous > 0 ? Number((((current - previous) / previous) * 100).toFixed(2)) : 0;
  }

  return sorted;
}

function deriveYearlyTrend(crop: string, monthly: HistoricalMonthlyPoint[]): HistoricalYearlyPoint[] {
  const yearlyMap = new Map<string, number[]>();

  for (const point of monthly) {
    const year = point.month.slice(0, 4);
    const bucket = yearlyMap.get(year) ?? [];
    bucket.push(point.avg_price);
    yearlyMap.set(year, bucket);
  }

  let yearly = Array.from(yearlyMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([year, prices]) => ({
      crop,
      year,
      avg_price: Math.round(prices.reduce((sum, value) => sum + value, 0) / prices.length),
      growth_rate: 0,
    }));

  // If live history has only recent months, back-fill last 4 years using momentum from monthly growth.
  if (yearly.length < 4 && monthly.length > 0) {
    const lastYear = Number(yearly[yearly.length - 1]?.year ?? new Date().getFullYear());
    const lastPrice = yearly[yearly.length - 1]?.avg_price ?? monthly[monthly.length - 1].avg_price;
    const avgMonthlyGrowth = monthly.slice(1).reduce((sum, point) => sum + point.growth_rate, 0) / Math.max(1, monthly.length - 1);
    const annualGrowth = Math.max(-20, Math.min(40, avgMonthlyGrowth * 6));

    const synthetic: HistoricalYearlyPoint[] = [];
    for (let year = lastYear - 3; year < lastYear; year += 1) {
      const yearsDiff = lastYear - year;
      const price = Math.round(lastPrice / Math.pow(1 + annualGrowth / 100, yearsDiff));
      synthetic.push({
        crop,
        year: String(year),
        avg_price: Math.max(1, price),
        growth_rate: annualGrowth,
      });
    }

    yearly = [...synthetic, ...yearly].sort((a, b) => a.year.localeCompare(b.year));
  }

  for (let index = 1; index < yearly.length; index += 1) {
    const previous = yearly[index - 1].avg_price;
    const current = yearly[index].avg_price;
    yearly[index].growth_rate = previous > 0 ? Number((((current - previous) / previous) * 100).toFixed(2)) : 0;
  }

  return yearly;
}

async function buildHistoricalTrendData(
  crops: CropTrendData[],
  district: string,
  latitude: number,
  longitude: number,
): Promise<{ monthly: HistoricalMonthlyPoint[]; yearly: HistoricalYearlyPoint[] }> {
  const targetCrops = crops.slice(0, 3);
  const monthly: HistoricalMonthlyPoint[] = [];
  const yearly: HistoricalYearlyPoint[] = [];

  for (const crop of targetCrops) {
    try {
      const market = await getMarketIntelligence({
        message: `Show market trend for ${crop.name} in ${district}`,
        latitude,
        longitude,
        timestamp: new Date().toISOString(),
      });

      const chart = market.chart.map((point) => ({
        date: point.date,
        price: point.price,
      }));

      const monthlySeries = groupMonthlyTrend(crop.name, chart);
      const yearlySeries = deriveYearlyTrend(crop.name, monthlySeries);

      monthly.push(...monthlySeries);
      yearly.push(...yearlySeries);
    } catch (error) {
      console.warn(`Unable to build historical trend for ${crop.name}`, error);
    }
  }

  return { monthly, yearly };
}

/**
 * Get top crops traded in a district from market data
 */
async function getTopCropsInRegion(district: string): Promise<CropTrendData[]> {
  try {
    // Market data for common crops across India
    // In production, this would fetch from real-time AGMARKNET data
    const cropsMarketData: Record<string, { price: number; change_percent: number; frequency: number }> = {
      'Wheat': { price: 2400, change_percent: 2.5, frequency: 30 },
      'Rice': { price: 2800, change_percent: 3.2, frequency: 28 },
      'Tomato': { price: 1200, change_percent: 5.8, frequency: 25 },
      'Onion': { price: 1500, change_percent: -2.3, frequency: 24 },
      'Potato': { price: 900, change_percent: 1.2, frequency: 22 },
      'Cotton': { price: 5200, change_percent: 4.1, frequency: 20 },
      'Sugarcane': { price: 280, change_percent: 0.8, frequency: 18 },
      'Soybean': { price: 3800, change_percent: 6.5, frequency: 16 },
      'Maize': { price: 1800, change_percent: 2.1, frequency: 19 },
      'Chickpea': { price: 4200, change_percent: 3.4, frequency: 14 },
    };

    const cropData: CropTrendData[] = Object.entries(cropsMarketData)
      .map(([name, data]) => {
        const trend: 'rising' | 'falling' | 'stable' = 
          data.change_percent > 2 ? 'rising' : 
          data.change_percent < -2 ? 'falling' : 
          'stable';
        return {
          name,
          price: data.price,
          change_percent: data.change_percent,
          trend,
          frequency: data.frequency,
        };
      })
      .sort((a, b) => {
        // Prioritize rising trends and high frequency
        if (a.trend === 'rising' && b.trend !== 'rising') return -1;
        if (a.trend !== 'rising' && b.trend === 'rising') return 1;
        return b.frequency - a.frequency;
      })
      .slice(0, 5); // Return top 5

    return cropData;
  } catch (error) {
    console.error('Error fetching top crops:', error);
    return [
      { name: 'Wheat', price: 2400, change_percent: 2.5, trend: 'rising', frequency: 30 },
      { name: 'Rice', price: 2800, change_percent: 3.2, trend: 'rising', frequency: 28 },
    ];
  }
}

/**
 * Analyze soil data and provide recommendations
 */
async function analyzeSoil(location: DashboardLocation): Promise<SoilAnalysis> {
  try {
    const soilProfile = await Promise.race([
      getSoilProfile(location.latitude, location.longitude),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Soil timeout')), 8000)
      )
    ]);

    const issues: string[] = [];
    const recommendations: string[] = [];

    if (typeof soilProfile === 'object' && soilProfile !== null) {
      const soil = soilProfile as any;
      const ph = soil.ph || 6.8;
      const nitrogen = soil.nitrogen || 0.18;
      const carbon = soil.organicCarbon || 0.95;

      // Analyze pH
      if (ph < 6) {
        issues.push('Soil is acidic - may limit nutrient availability');
        recommendations.push('Apply lime to raise pH to 6.5-7.5');
      } else if (ph > 7.5) {
        issues.push('Soil is alkaline - micronutrient deficiency risk');
        recommendations.push('Apply sulfur or acidifying fertilizer');
      }

      // Analyze nitrogen
      if (nitrogen < 0.15) {
        issues.push('Nitrogen levels are low - may reduce crop yield');
        recommendations.push('Apply nitrogen fertilizer or grow legumes');
      } else if (nitrogen > 0.3) {
        recommendations.push('Nitrogen levels are good - maintain with balanced fertilization');
      }

      // Analyze organic carbon
      if (carbon < 0.8) {
        issues.push('Organic matter is low - soil structure at risk');
        recommendations.push('Add compost or farm manure to improve soil health');
      } else {
        recommendations.push('Good organic content - maintain with crop rotation');
      }

      // Calculate soil score
      let score = 100;
      if (ph < 6 || ph > 7.5) score -= 15;
      if (nitrogen < 0.15) score -= 20;
      if (carbon < 0.8) score -= 15;
      if (issues.length > 0) score -= 10;
      
      score = Math.max(0, Math.min(100, score));

      return {
        soil_score: Math.round(score),
        ph: Math.round(ph * 10) / 10,
        nitrogen: Math.round(nitrogen * 100) / 100,
        organicCarbon: Math.round(carbon * 100) / 100,
        acidity: ph < 6.5 ? 'Acidic' : ph > 7.5 ? 'Alkaline' : 'Neutral',
        issues,
        recommendations,
      };
    }

    return {
      soil_score: 70,
      ph: 6.8,
      nitrogen: 0.18,
      organicCarbon: 0.95,
      acidity: 'Neutral',
      issues: [],
      recommendations: ['Maintain current soil management practices'],
    };
  } catch (error) {
    console.error('Error analyzing soil:', error);
    return {
      soil_score: 70,
      ph: 6.8,
      nitrogen: 0.18,
      organicCarbon: 0.95,
      acidity: 'Neutral',
      issues: [],
      recommendations: ['Soil analysis temporarily unavailable'],
    };
  }
}

/**
 * Generate weather impact analysis (simplified based on general patterns)
 */
function generateWeatherImpact(topCrops: CropTrendData[]): WeatherImpact {
  // Simplified weather impact - in real system would integrate with weather API
  const recommendations: string[] = [];
  const riskAlerts: string[] = [];

  recommendations.push('Monitor monsoon timing for irrigation planning');
  
  if (topCrops.some(c => c.trend === 'rising')) {
    recommendations.push('Plan planting schedule around favorable price trends');
  }

  return {
    temperature_optimal: true,
    rainfall_adequate: true,
    suitability_score: 78,
    risk_alerts: riskAlerts.length > 0 ? riskAlerts : ['No immediate weather risks'],
    recommendations,
  };
}

/**
 * Get AI-powered crop recommendation using LLM
 */
async function getAICropRecommendation(
  topCrops: CropTrendData[],
  soilAnalysis: SoilAnalysis,
  district: string
): Promise<AICropRecommendation> {
  try {
    const cropsInfo = topCrops
      .slice(0, 3)
      .map(c => `${c.name} (Price: ₹${c.price}/quintal, Trend: ${c.trend}, Change: ${c.change_percent}%)`)
      .join(', ');

    const prompt = `You are an agricultural expert AI. Based on the following data, recommend the SINGLE BEST CROP for a farmer in ${district} to grow this season.

Market Data (Top Crops):
${cropsInfo}

Soil Analysis:
- Soil Score: ${soilAnalysis.soil_score}/100
- pH: ${soilAnalysis.ph} (${soilAnalysis.acidity})
- Nitrogen: ${soilAnalysis.nitrogen}
- Organic Carbon: ${soilAnalysis.organicCarbon}
- Issues: ${soilAnalysis.issues.length > 0 ? soilAnalysis.issues.join(', ') : 'None'}

Provide ONLY a JSON response with this exact format (no markdown, no explanation before or after):
{
  "crop": "CropName",
  "reason": "Brief reason (max 50 words)",
  "profit_potential": 15,
  "season": "current_season",
  "confidence": 85
}`;

    const response = await Promise.race([
      generateResponse(prompt),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('LLM timeout')), 8000)
      )
    ]);

    if (response && typeof response === 'string') {
      try {
        // Extract JSON from response
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const rec = JSON.parse(jsonMatch[0]);
          return {
            crop: rec.crop || topCrops[0]?.name || 'Wheat',
            reason: rec.reason || 'Based on market trends and soil conditions',
            profit_potential: rec.profit_potential || 12,
            season: rec.season || 'Current',
            confidence: rec.confidence || 75,
          };
        }
      } catch {
        // Fall through to default
      }
    }

    // Default recommendation
    return {
      crop: topCrops[0]?.name || 'Wheat',
      reason: `Recommended based on rising market trend and suitable soil conditions for ${topCrops[0]?.name || 'this crop'} in ${district}`,
      profit_potential: topCrops[0]?.change_percent || 10,
      season: 'Current',
      confidence: 72,
    };
  } catch (error) {
    console.error('Error getting AI recommendation:', error);
    return {
      crop: topCrops[0]?.name || 'Wheat',
      reason: 'Recommendation based on regional market trends',
      profit_potential: 10,
      season: 'Current',
      confidence: 65,
    };
  }
}

/**
 * Generate actionable insights
 */
function generateInsights(
  topCrops: CropTrendData[],
  soilAnalysis: SoilAnalysis,
  recommendation: AICropRecommendation,
  weatherImpact: WeatherImpact,
  nasaAnalysis?: NASAAnalysis | null
): FarmInsight[] {
  const insights: FarmInsight[] = [];

  // Market opportunity insight
  const risingCrop = topCrops.find(c => c.trend === 'rising');
  if (risingCrop && risingCrop.change_percent > 5) {
    insights.push({
      title: '📈 Market Opportunity',
      description: `${risingCrop.name} prices are rising ${risingCrop.change_percent}% - strong demand period`,
      icon: 'trending_up',
      priority: 'high',
    });
  }

  // Soil optimization insight
  if (soilAnalysis.issues.length > 0) {
    insights.push({
      title: '🌱 Soil Improvement',
      description: soilAnalysis.recommendations[0] || 'Optimize soil for better crop yield',
      icon: 'layers',
      priority: 'medium',
    });
  } else {
    insights.push({
      title: '✅ Healthy Soil',
      description: 'Your soil is in good condition - maintain with regular compost application',
      icon: 'verified',
      priority: 'low',
    });
  }

  // Crop recommendation insight
  insights.push({
    title: '🎯 AI Recommendation',
    description: `${recommendation.crop} shows ${recommendation.profit_potential}% profit potential based on market and soil analysis`,
    icon: 'lightbulb',
    priority: 'high',
  });

  // Diversification insight
  if (topCrops.length >= 2) {
    const secondCrop = topCrops[1];
    insights.push({
      title: '🔄 Diversification',
      description: `Consider diversifying with ${secondCrop.name} to spread risk and maximize returns`,
      icon: 'shuffle',
      priority: 'medium',
    });
  }

  // Weather insight
  insights.push({
    title: '🌤️ Weather Readiness',
    description: weatherImpact.recommendations[0] || 'Monitor weather forecasts for planting decisions',
    icon: 'cloud',
    priority: 'medium',
  });

  // NASA Climate Based Insights
  if (nasaAnalysis) {
    if (nasaAnalysis.drought_risk > 50) {
      insights.push({
        title: '💧 Drought Warning',
        description: `Drought risk is ${nasaAnalysis.drought_risk}%. ${nasaAnalysis.recommendations.find(r => r.includes('drought')) || 'Implement water conservation strategies.'}`,
        icon: 'water_drop',
        priority: 'high',
      });
    }

    if (nasaAnalysis.frost_risk > 30) {
      insights.push({
        title: '❄️ Frost Alert',
        description: `Frost risk detected (${nasaAnalysis.frost_risk}%). Protect sensitive crops in early mornings.`,
        icon: 'snowflake',
        priority: 'high',
      });
    }

    if (nasaAnalysis.monthly_rainfall < 50) {
      insights.push({
        title: '🌵 Low Rainfall',
        description: `Monthly rainfall is ${nasaAnalysis.monthly_rainfall}mm. Plan supplementary irrigation.`,
        icon: 'cloud_off',
        priority: 'high',
      });
    }

    if (nasaAnalysis.solar_energy > 18) {
      insights.push({
        title: '☀️ High Solar Radiation',
        description: `Strong solar radiation (${nasaAnalysis.solar_energy}). Ensure adequate water and mulch application.`,
        icon: 'sun',
        priority: 'medium',
      });
    }
  }

  return insights;
}

/**
 * Main function to generate comprehensive farm intelligence
 */
export async function generateFarmInsights(location: DashboardLocation, userProfile?: any): Promise<FarmIntelligence> {
  try {
    const startTime = Date.now();
    const district = extractDistrict(location.placeName);

    // Fetch data in parallel where possible (including NASA data)
    const [topCrops, soilAnalysis, weatherImpact, nasaAnalysis, irrigationAdvice] = await Promise.all([
      getTopCropsInRegion(district),
      analyzeSoil(location),
      Promise.resolve(generateWeatherImpact([])),
      analyzeNASAData(location.latitude, location.longitude),
      getNASAIrrigationAdvice(location.latitude, location.longitude),
    ]);

    const historicalTrends = await buildHistoricalTrendData(
      topCrops,
      district,
      location.latitude,
      location.longitude,
    );

    // Get AI recommendation
    const recommendation = await getAICropRecommendation(
      topCrops.length > 0 ? topCrops : [
        { name: 'Wheat', price: 2500, change_percent: 2, trend: 'stable', frequency: 30 },
        { name: 'Rice', price: 2800, change_percent: 3, trend: 'rising', frequency: 28 }
      ],
      soilAnalysis,
      district
    );

    // Weather impact with actual crops
    const actualWeatherImpact = generateWeatherImpact(topCrops);

    // Generate insights
    const actionableInsights = generateInsights(
      topCrops,
      soilAnalysis,
      recommendation,
      actualWeatherImpact,
      nasaAnalysis
    );

    // Generate summary with NASA data
    const summaryAddition = nasaAnalysis && nasaAnalysis.frost_risk > 30 
      ? ' Protect cropos from frost risk.' 
      : nasaAnalysis && nasaAnalysis.drought_risk > 50 
      ? ' Plan irrigation carefully due to drought risk.'
      : '';

    const summary = `Based on soil analysis (${soilAnalysis.soil_score}/100) and market trends in ${district}, growing ${recommendation.crop} can increase profit by ${recommendation.profit_potential}% this season. ${soilAnalysis.recommendations[0] || 'Monitor soil health regularly.'}${summaryAddition}`;

    const intelligence: FarmIntelligence = {
      timestamp: new Date().toISOString(),
      location: {
        district,
        latitude: location.latitude,
        longitude: location.longitude,
      },
      top_crops: topCrops,
      soil_analysis: soilAnalysis,
      weather_impact: actualWeatherImpact,
      nasa_climate_analysis: nasaAnalysis || undefined,
      irrigation_advice: irrigationAdvice,
      historical_trends: historicalTrends,
      best_crop_recommendation: recommendation,
      market_opportunities: topCrops
        .filter(c => c.trend === 'rising')
        .map(c => ({
          crop: c.name,
          price_trend: `↑ ${c.change_percent}%`,
          potential_profit: `₹${c.price} per quintal`,
        })),
      actionable_insights: actionableInsights,
      summary,
    };

    console.log(`Farm intelligence generated in ${Date.now() - startTime}ms`);
    return intelligence;
  } catch (error) {
    console.error('Error generating farm intelligence:', error);
    // Return default structure on error
    return {
      timestamp: new Date().toISOString(),
      location: {
        district: extractDistrict(location.placeName),
        latitude: location.latitude,
        longitude: location.longitude,
      },
      top_crops: [],
      soil_analysis: {
        soil_score: 70,
        ph: 6.8,
        nitrogen: 0.18,
        organicCarbon: 0.95,
        acidity: 'Neutral',
        issues: [],
        recommendations: ['Soil analysis temporarily unavailable'],
      },
      weather_impact: {
        temperature_optimal: true,
        rainfall_adequate: true,
        suitability_score: 70,
        risk_alerts: ['No immediate weather risks'],
        recommendations: ['Monitor weather forecasts for planting decisions'],
      },
      historical_trends: {
        monthly: [],
        yearly: [],
      },
      best_crop_recommendation: {
        crop: 'Wheat',
        reason: 'Recommendation temporarily unavailable.',
        profit_potential: 0,
        season: 'Current',
        confidence: 50,
      },
      market_opportunities: [],
      actionable_insights: [
        {
          title: '🧠 Intelligence warming up',
          description: 'Historical analytics are syncing. Please retry shortly.',
          icon: 'seedling',
          priority: 'medium',
        },
      ],
      summary: 'Farm intelligence is temporarily unavailable. Showing safe fallback.',
    };
  }
}
