import cors from "cors";
import dotenv from "dotenv";
import express, { NextFunction, Request, Response } from "express";
import path from "path";
import { chatRouter } from "./routes/chat";

dotenv.config({
  path: path.resolve(__dirname, "..", ".env"),
});

const app = express();
const port = Number(process.env.PORT) || 5000;

app.use(cors());
app.use(express.json());

app.get("/health", (_req: Request, res: Response) => {
  res.status(200).send("OK");
});

app.use(chatRouter);

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Unhandled API error", error);

  res.status(500).json({
    error: "Internal server error",
  });
});

app.listen(port, () => {
  console.log(`FarmEase backend is running on port ${port}`);
});
