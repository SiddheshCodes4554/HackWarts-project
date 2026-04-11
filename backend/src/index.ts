import cors from "cors";
import dotenv from "dotenv";
import express, { NextFunction, Request, Response } from "express";
import path from "path";
import { analyzeCropRouter } from "./routes/analyzeCrop";
import { chatRouter } from "./routes/chat";
import { financeRouter } from "./routes/finance";
import { marketRouter } from "./routes/market";
import { weatherRouter } from "./routes/weather";

dotenv.config({
  path: path.resolve(__dirname, "..", ".env"),
});

const app = express();
const isProduction = process.env.NODE_ENV === "production";

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

// Required runtime configuration for production deployments.
const GROQ_API_KEY = getRequiredEnv("GROQ_API_KEY");
const SUPABASE_URL = getRequiredEnv("SUPABASE_URL");
const SUPABASE_ANON_KEY = getRequiredEnv("SUPABASE_ANON_KEY");

// Prevent lint/TS unused complaints while still enforcing env validation at boot.
void GROQ_API_KEY;
void SUPABASE_URL;
void SUPABASE_ANON_KEY;

const port = Number.parseInt(process.env.PORT ?? "", 10);
if (!Number.isFinite(port) || port <= 0) {
  throw new Error("PORT must be a valid positive number");
}

const allowedOrigins = (process.env.FRONTEND_URL ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

if (isProduction && allowedOrigins.length === 0) {
  throw new Error("FRONTEND_URL must be set in production for CORS");
}

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow server-to-server tools and health checks with no Origin header.
      if (!origin) {
        callback(null, true);
        return;
      }

      if (!isProduction && allowedOrigins.length === 0) {
        callback(null, true);
        return;
      }

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("CORS policy: origin not allowed"));
    },
    credentials: true,
  }),
);
app.use(express.json());

app.get("/health", (_req: Request, res: Response) => {
  res.status(200).send("OK");
});

app.use(chatRouter);
app.use(analyzeCropRouter);
app.use(financeRouter);
app.use(marketRouter);
app.use(weatherRouter);

app.use((_req: Request, res: Response) => {
  res.status(404).json({
    error: "Route not found",
  });
});

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Unhandled API error", error);

  const status =
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof (error as { status?: unknown }).status === "number"
      ? (error as { status: number }).status
      : 500;

  const message =
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
      ? (error as { message: string }).message
      : "Internal server error";

  res.status(status).json({
    error: status >= 500 ? "Internal server error" : message,
  });
});

app.listen(port, () => {
  console.log(`FarmEase backend is running on port ${port}`);
});
