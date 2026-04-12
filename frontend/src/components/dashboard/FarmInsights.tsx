'use client';

import { useEffect, useState } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

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

interface FarmIntelligenceResponse {
  timestamp: string;
  location: {
    district: string;
    latitude: number;
    longitude: number;
  };
  top_crops: CropTrendData[];
  soil_analysis: SoilAnalysis;
  weather_impact: WeatherImpact;
  best_crop_recommendation: AICropRecommendation;
  market_opportunities: Array<{
    crop: string;
    price_trend: string;
    potential_profit: string;
  }>;
  actionable_insights: FarmInsight[];
  summary: string;
}

interface FarmInsightsProps {
  latitude: number;
  longitude: number;
  placeName: string;
}

export default function FarmInsights({ latitude, longitude, placeName }: FarmInsightsProps) {
  const [intelligence, setIntelligence] = useState<FarmIntelligenceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chartsReady, setChartsReady] = useState(false);

  useEffect(() => {
    setChartsReady(true);
  }, []);

  useEffect(() => {
    const fetchIntelligence = async () => {
      try {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams({
          latitude: String(latitude),
          longitude: String(longitude),
          placeName,
        });

        const response = await fetch(`/api/dashboard/farm-intelligence?${params}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch farm intelligence');
        }

        const data = await response.json();
        setIntelligence(data);
      } catch (err) {
        console.error('Error fetching farm intelligence:', err);
        setError('Unable to load farm intelligence');
      } finally {
        setLoading(false);
      }
    };

    fetchIntelligence();
  }, [latitude, longitude, placeName]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="bg-white rounded-lg p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-blue-500 rounded-full animate-pulse" />
            <div>
              <div className="h-4 bg-gray-200 rounded w-48 animate-pulse" />
              <div className="h-3 bg-gray-100 rounded w-64 mt-2 animate-pulse" />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-lg p-4 h-40 animate-pulse" />
          <div className="bg-white rounded-lg p-4 h-40 animate-pulse" />
        </div>
      </div>
    );
  }

  if (error || !intelligence) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        <p className="font-medium">⚠️ {error || 'Farm intelligence unavailable'}</p>
      </div>
    );
  }

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'rising':
        return '📈';
      case 'falling':
        return '📉';
      default:
        return '➡️';
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'rising':
        return 'text-green-600';
      case 'falling':
        return 'text-red-600';
      default:
        return 'text-yellow-600';
    }
  };

  const getSoilScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  // Prepare chart data
  const priceChartData = intelligence.top_crops.map(crop => ({
    name: crop.name.substring(0, 4),
    price: crop.price,
    change: Math.abs(crop.change_percent),
  }));

  const confidenceChartData = [
    { name: 'Confidence', value: intelligence.best_crop_recommendation.confidence },
    { name: 'Remaining', value: 100 - intelligence.best_crop_recommendation.confidence },
  ];

  return (
    <div className="space-y-6">
      {/* AI Summary Card */}
      <div className="bg-gradient-to-br from-green-50 to-blue-50 border border-green-200 rounded-lg p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="text-3xl">🧠</div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-gray-900 mb-2">AI Farm Intelligence</h2>
            <p className="text-gray-700 leading-relaxed">{intelligence.summary}</p>
            <p className="text-xs text-gray-500 mt-3">📍 {intelligence.location.district}</p>
          </div>
        </div>
      </div>

      {/* Top Crops Section */}
      <div className="bg-white rounded-lg p-6 shadow-sm">
        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          🌾 Top Crops in Region
        </h3>
        <div className="grid grid-cols-1 gap-3">
          {intelligence.top_crops.slice(0, 5).map((crop, idx) => (
            <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition">
              <div className="flex-1">
                <p className="font-semibold text-gray-900">{crop.name}</p>
                <p className="text-sm text-gray-600">₹{crop.price}/quintal</p>
              </div>
              <div className={`text-right ${getTrendColor(crop.trend)}`}>
                <p className="text-2xl">{getTrendIcon(crop.trend)}</p>
                <p className="text-sm font-semibold">{crop.change_percent > 0 ? '+' : ''}{crop.change_percent}%</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Price Trends Chart */}
      {chartsReady && priceChartData.length > 0 && (
        <div className="bg-white rounded-lg p-6 shadow-sm">
          <h3 className="text-lg font-bold text-gray-900 mb-4">📈 Market Prices</h3>
          <ResponsiveContainer width="100%" height={250} minWidth={0}>
            <BarChart data={priceChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(value) => `₹${value}`} />
              <Bar dataKey="price" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Soil Health Card */}
      <div className="bg-white rounded-lg p-6 shadow-sm">
        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          🌱 Soil Health Analysis
        </h3>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4">
            <p className="text-gray-700 text-sm font-medium">Soil Score</p>
            <p className={`text-3xl font-bold mt-2 ${getSoilScoreColor(intelligence.soil_analysis.soil_score)}`}>
              {intelligence.soil_analysis.soil_score}/100
            </p>
          </div>
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4">
            <p className="text-gray-700 text-sm font-medium">pH Level</p>
            <p className="text-2xl font-bold text-blue-600 mt-2">{intelligence.soil_analysis.ph}</p>
            <p className="text-xs text-gray-600">{intelligence.soil_analysis.acidity}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-gray-700 text-xs font-medium">Nitrogen</p>
            <p className="text-lg font-bold text-gray-900">{intelligence.soil_analysis.nitrogen}</p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-gray-700 text-xs font-medium">Organic Carbon</p>
            <p className="text-lg font-bold text-gray-900">{intelligence.soil_analysis.organicCarbon}</p>
          </div>
        </div>

        {intelligence.soil_analysis.issues.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
            <p className="text-red-700 text-sm font-medium">⚠️ Issues Found:</p>
            <ul className="text-red-600 text-sm mt-2 space-y-1">
              {intelligence.soil_analysis.issues.map((issue, idx) => (
                <li key={idx}>• {issue}</li>
              ))}
            </ul>
          </div>
        )}

        {intelligence.soil_analysis.recommendations.length > 0 && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <p className="text-green-700 text-sm font-medium">✅ Recommendations:</p>
            <ul className="text-green-600 text-sm mt-2 space-y-1">
              {intelligence.soil_analysis.recommendations.map((rec, idx) => (
                <li key={idx}>• {rec}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* AI Recommendation Card */}
      <div className="bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200 rounded-lg p-6 shadow-sm">
        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          🎯 AI Recommendation
        </h3>
        <div className="mb-4">
          <p className="text-4xl font-bold text-purple-600 mb-2">{intelligence.best_crop_recommendation.crop}</p>
          <p className="text-gray-700 mb-4">{intelligence.best_crop_recommendation.reason}</p>

          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-lg p-3">
              <p className="text-gray-700 text-xs font-medium">Profit Potential</p>
              <p className="text-2xl font-bold text-green-600 mt-1">
                +{intelligence.best_crop_recommendation.profit_potential}%
              </p>
            </div>
            <div className="bg-white rounded-lg p-3">
              <p className="text-gray-700 text-xs font-medium">Confidence</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">
                {intelligence.best_crop_recommendation.confidence}%
              </p>
            </div>
            <div className="bg-white rounded-lg p-3">
              <p className="text-gray-700 text-xs font-medium">Season</p>
              <p className="text-lg font-bold text-gray-900 mt-1">{intelligence.best_crop_recommendation.season}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Market Opportunities */}
      {intelligence.market_opportunities.length > 0 && (
        <div className="bg-white rounded-lg p-6 shadow-sm">
          <h3 className="text-lg font-bold text-gray-900 mb-4">💹 Market Opportunities</h3>
          <div className="grid grid-cols-1 gap-3">
            {intelligence.market_opportunities.map((opp, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                <div>
                  <p className="font-semibold text-gray-900">{opp.crop}</p>
                  <p className="text-sm text-gray-600">{opp.potential_profit}</p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-green-600">{opp.price_trend}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actionable Insights */}
      <div className="space-y-3">
        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          💡 Actionable Insights
        </h3>
        {intelligence.actionable_insights.map((insight, idx) => {
          const priorityColor = {
            high: 'border-red-300 bg-red-50',
            medium: 'border-yellow-300 bg-yellow-50',
            low: 'border-blue-300 bg-blue-50',
          }[insight.priority];

          return (
            <div key={idx} className={`border-l-4 ${priorityColor} rounded-lg p-4`}>
              <p className="font-semibold text-gray-900">{insight.title}</p>
              <p className="text-gray-700 mt-1 text-sm">{insight.description}</p>
            </div>
          );
        })}
      </div>

      {/* Weather Impact */}
      <div className="bg-white rounded-lg p-6 shadow-sm">
        <h3 className="text-lg font-bold text-gray-900 mb-4">🌤️ Weather Impact</h3>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <span className="text-2xl">{intelligence.weather_impact.temperature_optimal ? '✅' : '⚠️'}</span>
            <div>
              <p className="text-xs text-gray-600 font-medium">Temperature</p>
              <p className="text-sm font-semibold text-gray-900">
                {intelligence.weather_impact.temperature_optimal ? 'Optimal' : 'Suboptimal'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <span className="text-2xl">{intelligence.weather_impact.rainfall_adequate ? '✅' : '⚠️'}</span>
            <div>
              <p className="text-xs text-gray-600 font-medium">Rainfall</p>
              <p className="text-sm font-semibold text-gray-900">
                {intelligence.weather_impact.rainfall_adequate ? 'Adequate' : 'Insufficient'}
              </p>
            </div>
          </div>
        </div>

        <div className="p-3 bg-blue-50 rounded-lg mb-3">
          <p className="text-blue-700 text-sm font-medium">Suitability Score: {intelligence.weather_impact.suitability_score}/100</p>
        </div>

        {intelligence.weather_impact.recommendations.length > 0 && (
          <div>
            <p className="text-gray-700 text-sm font-medium mb-2">Recommendations:</p>
            <ul className="space-y-1">
              {intelligence.weather_impact.recommendations.map((rec, idx) => (
                <li key={idx} className="text-gray-600 text-sm">• {rec}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
