export type AgentName = "weather" | "crop" | "market" | "finance";

export type ChatRequestPayload = {
  message?: string;
  query?: string;
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
  timestamp: string;
};

export type WeatherAdvisory = {
  temperature: number;
  rainfall: number;
  advice: string;
};

export type AgentResult = {
  agent: AgentName;
  insight: string;
  confidence: number;
  metadata?: Record<string, string | number | boolean>;
};

export type OrchestratedChatResponse = {
  intent: string;
  reply: string;
  agentResults: AgentResult[];
  timestamp: string;
};
