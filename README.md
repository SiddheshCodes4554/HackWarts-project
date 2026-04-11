# FarmEase

FarmEase is a full-stack, AI-assisted farming application built for location-aware weather intelligence, crop advisory, mandi decision support, and finance scheme guidance.

The platform includes:
- Next.js frontend with authenticated user experience
- Express + TypeScript backend with multi-agent orchestration
- Supabase-backed user profile and location persistence
- Resilient dashboard data aggregation with fallbacks for upstream failures

## Current Capabilities

- Auth and profile onboarding with Supabase
- Persistent farm location (manual select + profile sync)
- AI assistant chat powered by orchestrated domain agents
- Dashboard with weather, soil, market, crop, and finance intelligence
- Crop disease advisory via text/image flow
- Market alerts and mandi ranking insights
- Production-safe dashboard proxy route in frontend deployment

## Tech Stack

Frontend:
- Next.js 16 (App Router)
- React 19
- Tailwind CSS
- SWR
- Recharts
- Framer Motion

Backend:
- Node.js
- Express 5
- TypeScript
- Modular routes, services, agents, and orchestrator

Infra and data providers:
- Supabase (auth + profile persistence)
- Groq (LLM responses)
- OpenWeather (weather + forecast)
- SoilGrids (soil properties)
- Agmarknet-compatible market feed (with deterministic fallback)

## Repository Structure

Top-level:
- frontend: Next.js app
- backend: Express API server
- SUPABASE_SETUP_GUIDE.md: Supabase setup walkthrough

Backend structure:
- backend/src/routes: API route handlers
- backend/src/services: external API integration + composition logic
- backend/src/agents: domain agents (weather/crop/market/finance/image)
- backend/src/orchestrator: chat intent routing + response orchestration
- backend/src/utils: shared contracts and helper types

Frontend structure:
- frontend/src/app: pages and app routes
- frontend/src/app/(tabs): authenticated app tabs (home, assistant, market, profile)
- frontend/src/app/api/dashboard/data: deployment-safe dashboard proxy route
- frontend/src/components: reusable UI components
- frontend/src/context: location and user context providers

## Quick Start

1. Install dependencies
- cd frontend
- npm install
- cd ../backend
- npm install

2. Configure environment files
- frontend/.env from frontend/.env.example
- backend/.env from backend/.env.example

3. Run backend
- cd backend
- npm run dev

4. Run frontend in another terminal
- cd frontend
- npm run dev

5. Build checks
- cd backend && npm run build
- cd frontend && npm run build

## Environment Variables

Frontend:
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- NEXT_PUBLIC_API_URL (optional for local and direct API usage)
- NEXT_PUBLIC_API_BASE_URL (legacy optional)
- BACKEND_API_URL (required in deployed frontend for dashboard proxy route)

Backend:
- PORT
- GROQ_API_KEY
- SUPABASE_URL
- SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY (required for server-side profile location updates)
- OPENWEATHER_API_KEY or NEXT_PUBLIC_OPENWEATHER_API_KEY
- Optional market/provider keys as configured in service modules

## API Surface (Current)

Core:
- GET /health
- POST /chat

Dashboard:
- GET /dashboard
- GET /dashboard/data

Advisory and intelligence:
- GET /weather
- POST /analyze-crop
- GET /market-intelligence
- GET /financial-advice
- POST /financial-advice

Market alerts:
- GET /market-alerts
- POST /market-alerts

User location:
- POST /user/location

## Reliability Design Notes

- Dashboard aggregation uses per-source fallback and hard fallback response guards.
- Weather and crop routes return safe, usable responses even during provider outages.
- Frontend dashboard normalizes payload shape to prevent brittle rendering.
- Frontend includes same-origin proxy endpoint for deployed dashboard calls:
  - frontend route: /api/dashboard/data
  - avoids localhost misconfiguration in production browsers

## Deployment Notes

Frontend deployment:
- Set BACKEND_API_URL to your deployed backend base URL.
- Keep NEXT_PUBLIC_API_URL unset or set to deployed API URL (never localhost).

Backend deployment:
- Set FRONTEND_URL (comma-separated) for CORS allowlist.
- Ensure GROQ_API_KEY and required provider keys are configured.

## Documentation

- Supabase setup: SUPABASE_SETUP_GUIDE.md
- Architecture and diagram guide: docs/ARCHITECTURE.md

## Architecture at a Glance

- Client apps call frontend pages.
- Frontend pages fetch backend APIs directly or via frontend proxy route for dashboard.
- Backend routes orchestrate domain services and agents.
- Services pull data from external providers and return normalized payloads.
- Supabase stores profile and location context used across workflows.

For full details and a ready-to-render architecture diagram source, see docs/ARCHITECTURE.md.
