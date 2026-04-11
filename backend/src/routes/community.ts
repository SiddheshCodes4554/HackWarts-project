import { Request, Response, Router } from "express";
import { requestGroqJson } from "../services/groqService";

type ModerationStatus = "safe" | "warning" | "blocked";

type CommunityAiPayload = {
  status: ModerationStatus;
  reason: string;
  summary: string;
  translation: string;
  tags: string[];
  aiSuggestion: string;
};

const communityRouter = Router();

function heuristicStatus(content: string): ModerationStatus {
  const text = content.toLowerCase();

  if (/\b(drink pesticide|inject|poison|toxic dose|burn the crop completely)\b/.test(text)) {
    return "blocked";
  }

  if (/\b(excess|double dose|random spray|blind spray|antibiotic for plants)\b/.test(text)) {
    return "warning";
  }

  return "safe";
}

function fallbackCommunityAi(content: string, language: string): CommunityAiPayload {
  const status = heuristicStatus(content);
  const shortSummary = content.length > 170 ? `${content.slice(0, 167)}...` : content;

  const tags: string[] = [];
  const lower = content.toLowerCase();
  if (/\bpest|insect|aphid|worm|leaf curl\b/.test(lower)) tags.push("pest");
  if (/\birrigation|water|drip|moisture\b/.test(lower)) tags.push("irrigation");
  if (/\bsoil|fertilizer|nitrogen|potash|urea\b/.test(lower)) tags.push("soil");
  if (/\bmarket|price|mandi|sell\b/.test(lower)) tags.push("market");

  return {
    status,
    reason:
      status === "blocked"
        ? "This advice can be harmful to farmers or crops and should not be published."
        : status === "warning"
          ? "This advice needs verification before acting on it."
          : "Advice looks generally safe. Validate with local agronomy guidance.",
    summary: shortSummary,
    translation: language.toLowerCase() === "english" ? shortSummary : shortSummary,
    tags,
    aiSuggestion: /pest|insect|aphid|worm/.test(lower)
      ? "Possible pest issue. Suggested action: inspect leaf underside, start neem-based spray, and isolate affected plants."
      : "Check local weather and soil moisture before applying any treatment.",
  };
}

communityRouter.post("/community/moderate", async (req: Request, res: Response) => {
  try {
    const content = typeof req.body?.content === "string" ? req.body.content.trim() : "";
    const language = typeof req.body?.language === "string" ? req.body.language.trim() : "English";

    if (!content) {
      return res.status(400).json({ error: "content is required" });
    }

    const fallback = fallbackCommunityAi(content, language);

    const response = await requestGroqJson<CommunityAiPayload>(
      {
        systemPrompt:
          "You are an agricultural expert and moderator. Return only JSON with keys: status, reason, summary, translation, tags, aiSuggestion. status must be one of safe|warning|blocked.",
        userPrompt: [
          "You are an agricultural expert.",
          "",
          "Check if this advice is safe and correct.",
          "",
          "If harmful or incorrect, flag it.",
          "",
          `Advice: ${content}`,
          `Translate output to language: ${language}`,
          "",
          "Rules:",
          "- summary: max 180 chars",
          "- tags: 1 to 4 lowercase tags such as pest, irrigation, nutrition, market, weather",
          "- aiSuggestion: concise and actionable",
        ].join("\n"),
      },
      fallback,
    );

    const status: ModerationStatus =
      response.status === "blocked" || response.status === "warning" || response.status === "safe"
        ? response.status
        : fallback.status;

    return res.status(200).json({
      ...fallback,
      ...response,
      status,
      tags: Array.isArray(response.tags) ? response.tags.slice(0, 4) : fallback.tags,
    });
  } catch (error) {
    console.error("community/moderate route error", error);
    return res.status(500).json({ error: "Unable to moderate community post" });
  }
});

export { communityRouter };
