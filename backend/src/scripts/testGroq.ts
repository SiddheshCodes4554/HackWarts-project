import dotenv from "dotenv";
import { generateResponse } from "../services/groqService";

dotenv.config();

async function run(): Promise<void> {
  const sampleQuery = "suggest crops for rainy season";
  console.log(`Running Groq sample query: ${sampleQuery}`);

  const result = await generateResponse(sampleQuery);

  console.log("Structured response:");
  console.log(JSON.stringify(result, null, 2));
}

run().catch((error: unknown) => {
  console.error("Sample Groq query failed", error);
  process.exitCode = 1;
});
