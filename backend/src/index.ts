import cors from "cors";
import dotenv from "dotenv";
import express, { NextFunction, Request, Response } from "express";
import path from "path";
import { analyzeCropRouter } from "./routes/analyzeCrop";
import { chatRouter } from "./routes/chat";
import { communityRouter } from "./routes/community";
import { dashboardRouter } from "./routes/dashboard";
import { financeRouter } from "./routes/finance";
import { marketRouter } from "./routes/market";
import { userLocationRouter } from "./routes/userLocation";
import { weatherRouter } from "./routes/weather";
import { getGroqApiKeys } from "./services/groqKeys";

dotenv.config({
  path: path.resolve(__dirname, "..", ".env"),
});

const app = express();
const isProduction = process.env.NODE_ENV === "production";

function normalizeOrigin(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

function getOptionalEnv(name: string): string {
  return process.env[name]?.trim() ?? "";
}

const groqKeys = getGroqApiKeys();
const SUPABASE_URL = getOptionalEnv("SUPABASE_URL");
const SUPABASE_ANON_KEY = getOptionalEnv("SUPABASE_ANON_KEY");

if (groqKeys.length === 0) {
  console.warn("No Groq API key configured; assistant will run with local fallbacks.");
}

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn("SUPABASE_URL or SUPABASE_ANON_KEY is missing; continuing startup with limited features.");
}

// Prevent lint/TS unused complaints while still running startup diagnostics.
void groqKeys;
void SUPABASE_URL;
void SUPABASE_ANON_KEY;

const port = Number.parseInt(process.env.PORT ?? "", 10);
if (!Number.isFinite(port) || port <= 0) {
  throw new Error("PORT must be a valid positive number");
}

const allowedOrigins = (process.env.FRONTEND_URL ?? "")
  .split(",")
  .map((origin) => normalizeOrigin(origin))
  .filter(Boolean);

if (isProduction && allowedOrigins.length === 0) {
  console.warn("FRONTEND_URL is not set in production; allowing all origins temporarily.");
}

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow server-to-server tools and health checks with no Origin header.
      if (!origin) {
        callback(null, true);
        return;
      }

      if (allowedOrigins.length === 0) {
        callback(null, true);
        return;
      }

      const normalizedOrigin = normalizeOrigin(origin);
      if (allowedOrigins.includes(normalizedOrigin)) {
        callback(null, true);
        return;
      }

      callback(new Error("CORS policy: origin not allowed"));
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: "15mb" }));

app.get("/health", (_req: Request, res: Response) => {
  res.status(200).send("OK");
});

app.use(chatRouter);
app.use(communityRouter);
app.use(dashboardRouter);
app.use(analyzeCropRouter);
app.use(financeRouter);
app.use(marketRouter);
app.use(weatherRouter);
app.use(userLocationRouter);

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
