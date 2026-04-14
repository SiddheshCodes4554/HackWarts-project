import { AgentContext, AgentResult } from "../utils/types";
import { getSoilProfile } from "../services/soilService";

export async function soilAgent(
  context: AgentContext,
  _options: { strict?: boolean } = {},
): Promise<AgentResult> {
  const latitude = Number.isFinite(context.latitude) ? (context.latitude as number) : 18.5204;
  const longitude = Number.isFinite(context.longitude) ? (context.longitude as number) : 73.8567;
  const soil = await getSoilProfile(latitude, longitude);

  return {
    agent: "crop",
    insight: `Soil pH ${soil.ph}, nitrogen ${soil.nitrogen}, organic carbon ${soil.organicCarbon}. ${soil.recommendation}`,
    confidence: 0.82,
    metadata: {
      source: soil.source ?? "soilgrids",
      ph: soil.ph,
      nitrogen: soil.nitrogen,
      organic_carbon: soil.organicCarbon,
      soil_type: soil.soilType,
      latitude,
      longitude,
    },
  };
}
