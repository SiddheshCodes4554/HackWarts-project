import { analyze } from "../agents/decisionAgent";
import { marketAgent } from "../agents/marketAgent";
import { soilAgent } from "../agents/soilAgent";
import { weatherAgent } from "../agents/weatherAgent";
import { Alert } from "../models/Alert";
import { User, UserDocument } from "../models/User";
import { AgentContext } from "../utils/types";

function numberFromMetadata(metadata: Record<string, string | number | boolean> | undefined, key: string, fallback = 0): number {
  const value = metadata?.[key];
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  return fallback;
}

function marketSignal(metadata: Record<string, string | number | boolean> | undefined): "SELL" | "HOLD" {
  const value = metadata?.signal;
  return value === "HOLD" ? "HOLD" : "SELL";
}

function toContext(user: UserDocument): AgentContext {
  return {
    message: user.primary_crop?.trim() || "crop planning",
    locale: [user.location.district, user.location.state].filter(Boolean).join(", ") || "India",
    latitude: user.location.lat,
    longitude: user.location.lon,
    cropType: user.primary_crop,
    timestamp: new Date().toISOString(),
  };
}

export async function runAgentWorkflow(user: Pick<UserDocument, "email" | "name">): Promise<{
  alerts: string[];
  recommendations: string[];
  summary: string;
}> {
  const profile = await User.findOne({ email: user.email });
  if (!profile) {
    throw new Error(`User profile not found for ${user.email}`);
  }

  const context = toContext(profile);

  const [weather, soil, market] = await Promise.all([
    weatherAgent(context, { strict: false }),
    soilAgent(context, { strict: false }),
    marketAgent(context, { strict: false }),
  ]);

  const decision = analyze(
    {
      weather: {
        rainfall: numberFromMetadata(weather.metadata, "rainfall"),
        humidity: numberFromMetadata(weather.metadata, "humidity"),
        temperature: numberFromMetadata(weather.metadata, "temperature"),
      },
      market: {
        signal: marketSignal(market.metadata),
      },
      soil: {
        nitrogen: numberFromMetadata(soil.metadata, "nitrogen"),
      },
    },
    profile,
  );

  const records = [
    ...decision.alerts.map((message, index) => ({
      userId: profile.email,
      message,
      type: "alert" as const,
      createdAt: new Date(),
      priority: decision.priority[index] as "high" | "medium" | "low" | undefined,
    })),
    ...decision.recommendations.map((message, index) => ({
      userId: profile.email,
      message,
      type: "recommendation" as const,
      createdAt: new Date(),
      priority: decision.priority[index] as "high" | "medium" | "low" | undefined,
    })),
    {
      userId: profile.email,
      message: decision.summary,
      type: "summary" as const,
      createdAt: new Date(),
      priority: "low" as const,
    },
  ];

  await Alert.insertMany(records);

  return {
    alerts: decision.alerts,
    recommendations: decision.recommendations,
    summary: decision.summary,
  };
}
