export type AgentName = "weather" | "crop" | "market" | "finance";

export type ChatRequestPayload = {
  message: string;
  locale?: string;
};

export type AgentContext = {
  message: string;
  locale?: string;
  timestamp: string;
};

export type AgentResult = {
  agent: AgentName;
  insight: string;
  confidence: number;
  metadata?: Record<string, string | number | boolean>;
};

export type OrchestratedChatResponse = {
  reply: string;
  agentResults: AgentResult[];
  timestamp: string;
};
