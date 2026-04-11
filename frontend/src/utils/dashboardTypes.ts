export type DashboardLocationInput = {
  latitude: number;
  longitude: number;
  placeName: string;
};

export type DashboardWeather = {
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
};

export type CropRecommendation = {
  crop: string;
  season: string;
  reasoning: string;
};

export type CropInsight = {
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

export type MarketInsight = {
  markets: MarketRecord[];
  bestMarket: string;
  recommendation: string;
  signal: "SELL" | "HOLD";
};

export type FinanceScheme = {
  name: string;
  benefit: string;
  amountINR: number;
  eligibility: string;
};

export type FinanceInsight = {
  schemes: FinanceScheme[];
  advice: string;
};

export type DashboardPayload = {
  weather: DashboardWeather;
  crops: CropInsight;
  market: MarketInsight;
  finance: FinanceInsight;
  soil: SoilProfile;
};
