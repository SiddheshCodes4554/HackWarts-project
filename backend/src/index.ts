import cors from "cors";
import dotenv from "dotenv";
import express, { Request, Response } from "express";

dotenv.config();

const app = express();
const port = Number(process.env.PORT) || 5000;

app.use(cors());
app.use(express.json());

app.get("/health", (_req: Request, res: Response) => {
  res.status(200).send("OK");
});

app.post("/chat", (req: Request, res: Response) => {
  const userMessage = typeof req.body?.message === "string" ? req.body.message : "";

  res.status(200).json({
    reply: userMessage
      ? `Dummy response: Received your message \"${userMessage}\". Agentic workflow coming soon.`
      : "Dummy response: FarmEase backend is ready. Multi-agent response pipeline coming soon.",
    timestamp: new Date().toISOString(),
  });
});

app.listen(port, () => {
  console.log(`FarmEase backend is running on port ${port}`);
});
