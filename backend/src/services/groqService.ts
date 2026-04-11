type GroqPromptInput = {
  message: string;
  contextSummary: string;
};

export async function generateGroqResponse(input: GroqPromptInput): Promise<string> {
  const trimmedMessage = input.message.trim();

  if (!trimmedMessage) {
    return "Please share a farming question so I can assist.";
  }

  await Promise.resolve();

  return [
    "FarmEase synthesis (placeholder):",
    `Question: ${trimmedMessage}`,
    `Signals: ${input.contextSummary}`,
    "Production Groq completion will be plugged in here.",
  ].join(" ");
}
