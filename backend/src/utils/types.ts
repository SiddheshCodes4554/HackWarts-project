export type AgentName = "weather" | "crop" | "market" | "finance";

export type ChatRequestPayload = {
  message?: string;
  query?: string;
  crop?: string;
  disease?: string;
  language?: string;
  landOwned?: boolean;
  incomeLevel?: string;
  location?: {
    latitude?: number;
    longitude?: number;
    placeName?: string;
  };
  locale?: string;
  latitude?: number;
  longitude?: number;
};

export type AgentContext = {
  message: string;
  locale?: string;
  latitude?: number;
  longitude?: number;
  language?: string;
  cropType?: string;
  landOwned?: boolean;
  incomeLevel?: string;
  timestamp: string;
};

export type GovernmentScheme = {
  name: string;
  benefit: string;
  eligibility: string[];
  documents: string[];
  apply_steps: string[];
  source?: string;
  source_url?: string;
  last_updated?: string;
};

export type FinancialUserProfile = {
  landOwned: boolean;
  cropType: string;
  location: string;
  incomeLevel: string;
};

export type FinancialAdviceResult = {
  schemes: GovernmentScheme[];
  advice: string;
  steps: string[];
  language: string;
  profile: FinancialUserProfile;
  fetched_at: string;
  data_source: string;
  api_live: boolean;
};

export type WeatherAdvisory = {
  temperature: number;
  rainfall: number;
  humidity: number;
  windSpeed: number;
  advice: string;
};

export type SoilProfile = {
  ph: number;
  nitrogen: number;
  organicCarbon: number;
  soilType: string;
  recommendation: string;
  source?: string;
};

export type DashboardLocation = {
  latitude: number;
  longitude: number;
  placeName: string;
};

export type CropRecommendation = {
  crop: string;
  season: string;
  reasoning: string;
};

export type CropDashboardInsight = {
  recommendations: CropRecommendation[];
  summary: string;
};

export type MarketRecord = {
  mandi: string;
  state: string;
  district: string;
  commodity: string;
  modalPrice: number;
  minPrice: number;
  maxPrice: number;
  arrivalDate: string;
  distanceKm: number;
  transportCost: number;
  netProfit: number;
};

export type MarketDashboardInsight = {
  markets: MarketRecord[];
  bestMarket: string;
  recommendation: string;
  signal: "SELL" | "HOLD";
  trend: Array<{
    date: string;
    price: number;
    arrivals: number;
  }>;
};

export type FinanceScheme = {
  name: string;
  benefit: string;
  amountINR: number;
  eligibility: string;
};

export type FinanceDashboardInsight = {
  schemes: FinanceScheme[];
  advice: string;
};

export type DashboardData = {
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
  crops: CropDashboardInsight;
  market: MarketDashboardInsight;
  finance: FinanceDashboardInsight;
  soil: SoilProfile & {
    healthScore: number;
  };
  insights: string[];
};

export type CropLocation = {
  lat: number;
  lon: number;
  placeName: string;
};

export type CropWeather = {
  temperature: number;
  rainfall: number;
  humidity: number;
};

export type CropAdviceInput = {
  location: CropLocation;
  weather: CropWeather;
  soil: SoilProfile;
  crop?: string;
  disease?: string;
  diseaseConfidence?: number;
  language?: string;
  query?: string;
  growthStage?: string;
};

export type CropImageAnalysis = {
  symptoms: string;
  disease_name: string;
  confidence: number;
};

export type CropContextSnapshot = {
  district: string;
  state: string;
  season: string;
  weather_summary: string;
  soil_type: string;
  growth_stage: string;
};

export type CropAdviceResult = {
  disease: string;
  confidence: number;
  root_cause: string;
  treatment: string[];
  prevention: string[];
  crop_recommendation: string[];
  context: {
    season: string;
    soil_type: string;
    weather_summary: string;
  };
  warnings: string[];
  summary: string;
};

export type CropAdvisoryResponse = {
  disease: string;
  confidence: number;
  symptoms: string;
  treatment: string[];
  prevention: string[];
  source: "image" | "text";
  context?: {
    season?: string;
    soil_type?: string;
    weather_summary?: string;
  };
};

export type AgentResult = {
  agent: AgentName;
  insight: string;
  confidence: number;
  metadata?: Record<string, string | number | boolean>;
};

export type OrchestratedChatResponse = {
  weather: Record<string, unknown>;
  crops: Record<string, unknown>;
  market: Record<string, unknown>;
  finance: Record<string, unknown>;
  final_message: string;
  intent: string;
  reply: string;
  agentResults: AgentResult[];
  timestamp: string;
  error?: string;
};
