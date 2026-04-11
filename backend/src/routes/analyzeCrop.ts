import { Request, Response, Router } from "express";
import { generateCropAdvice } from "../agents/cropAgent";
import { analyzeCropImage } from "../agents/imageAnalyzer";
import { weatherAgent } from "../agents/weatherAgent";
import { getSoilProfile } from "../services/soilService";
import { CropAdviceInput, CropAdvisoryResponse, CropLocation, ChatRequestPayload } from "../utils/types";

const analyzeCropRouter = Router();

function toCropLocation(payload: Partial<ChatRequestPayload>): CropLocation {
  const latitude = Number.isFinite(payload.location?.latitude)
    ? (payload.location?.latitude as number)
    : Number.isFinite(payload.latitude)
      ? (payload.latitude as number)
      : 18.5204;
  const longitude = Number.isFinite(payload.location?.longitude)
    ? (payload.location?.longitude as number)
    : Number.isFinite(payload.longitude)
      ? (payload.longitude as number)
      : 73.8567;
  const placeName =
    typeof payload.location?.placeName === "string" && payload.location.placeName.trim()
      ? payload.location.placeName.trim()
      : typeof payload.locale === "string" && payload.locale.trim()
        ? payload.locale.trim()
        : "Nagpur, Maharashtra";

  return {
    lat: latitude,
    lon: longitude,
    placeName,
  };
}

analyzeCropRouter.post("/analyze-crop", async (req: Request, res: Response) => {
  try {
    const payload = req.body as Partial<ChatRequestPayload> & {
      image?: string;
      imageBase64?: string;
      imageData?: string;
      query?: string;
    };
    const query = typeof payload.query === "string" ? payload.query.trim() : "";
    const image =
      typeof payload.image === "string"
        ? payload.image
        : typeof payload.imageBase64 === "string"
          ? payload.imageBase64
          : typeof payload.imageData === "string"
            ? payload.imageData
            : "";
    const location = toCropLocation(payload);

    if (!image && !query) {
      return res.status(400).json({
        error: "image or query is required",
      });
    }

    const [weatherResult, soilProfile] = await Promise.all([
      weatherAgent({
        message: query || "crop image analysis",
        locale: location.placeName,
        latitude: location.lat,
        longitude: location.lon,
        timestamp: new Date().toISOString(),
      }),
      getSoilProfile(location.lat, location.lon),
    ]);

    const imageAnalysis = await analyzeCropImage(image, query, location);

    const advice = await generateCropAdvice({
      location: {
        lat: location.lat,
        lon: location.lon,
        placeName: location.placeName,
      },
      weather: {
        temperature:
          typeof weatherResult.metadata?.temperature === "number" ? weatherResult.metadata.temperature : 30,
        rainfall: typeof weatherResult.metadata?.rainfall === "number" ? weatherResult.metadata.rainfall : 0,
        humidity: typeof weatherResult.metadata?.humidity === "number" ? weatherResult.metadata.humidity : 60,
      },
      soil: soilProfile,
      disease: imageAnalysis.disease_name,
      diseaseConfidence: imageAnalysis.confidence,
      query: query || imageAnalysis.symptoms,
      language: typeof payload.language === "string" && payload.language.trim() ? payload.language.trim() : "English",
    });

    const response: CropAdvisoryResponse = {
      disease: advice.disease,
      confidence: advice.confidence,
      symptoms: imageAnalysis.symptoms || query || advice.root_cause,
      treatment: advice.treatment,
      prevention: advice.prevention,
      source: imageAnalysis.source,
      context: advice.context,
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error("analyze-crop route error", error);
    return res.status(200).json({
      disease: "Unknown condition",
      confidence: 0,
      symptoms: "Could not detect clearly, try again",
      treatment: ["Try uploading a clearer image or add a short description."],
      prevention: ["Ensure the leaf or crop area is visible and well lit."],
      source: "text",
    } satisfies CropAdvisoryResponse);
  }
});

export { analyzeCropRouter };
