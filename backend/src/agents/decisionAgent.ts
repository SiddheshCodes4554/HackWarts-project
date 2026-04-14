import { UserDocument } from "../models/User";

type DecisionInput = {
  weather: {
    rainfall: number;
    humidity: number;
    temperature: number;
  };
  market: {
    signal: "SELL" | "HOLD";
  };
  soil: {
    nitrogen: number;
  };
};

export type DecisionOutput = {
  alerts: string[];
  recommendations: string[];
  priority: string[];
  summary: string;
};

function addDecision(
  output: DecisionOutput,
  message: string,
  recommendation: string,
  priority: "high" | "medium" | "low",
) {
  output.alerts.push(message);
  output.recommendations.push(recommendation);
  output.priority.push(priority);
}

export function analyze(data: DecisionInput, user: Pick<UserDocument, "primary_crop" | "name">): DecisionOutput {
  const output: DecisionOutput = {
    alerts: [],
    recommendations: [],
    priority: [],
    summary: "",
  };

  if (data.weather.rainfall >= 2) {
    addDecision(output, "Rain expected: Delay irrigation.", "Pause irrigation and review drainage channels.", "high");
  }

  if (data.weather.humidity > 75) {
    addDecision(output, "Humidity is high: Fungal risk detected.", "Use preventive fungicide and improve plant airflow.", "high");
  }

  if (data.market.signal === "HOLD") {
    addDecision(output, "Market prices are rising.", `Hold ${user.primary_crop || "crop"} stock if storage is safe.`, "medium");
  }

  if (data.market.signal === "SELL") {
    addDecision(output, "Market prices are softening.", `Sell ${user.primary_crop || "crop"} now for better realization.`, "medium");
  }

  if (data.soil.nitrogen < 0.15) {
    addDecision(output, "Soil nitrogen is low.", "Apply nitrogen-rich fertilizer in split doses this week.", "high");
  }

  if (output.alerts.length === 0) {
    addDecision(output, "No immediate risks detected.", "Continue current plan and monitor daily conditions.", "low");
  }

  const lines = output.alerts.map((alert) => `- ${alert}`).join("\n");
  output.summary = `AI Farm Brief for ${user.name || "Farmer"}:\n${lines}`;

  return output;
}
