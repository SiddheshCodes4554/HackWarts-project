# FarmEase Architecture

This document captures the implemented architecture of FarmEase as of the current codebase, and provides a reusable source diagram for review, demos, and further design updates.

## 1. System Overview

FarmEase is a two-tier web application:
- Frontend: Next.js app (UI, auth/session-aware user flows, and dashboard proxy route)
- Backend: Express API (agent orchestration, intelligence aggregation, provider integration)

Primary domains currently implemented:
- Authentication and profile setup
- User location persistence
- Weather advisory
- Crop advisory and image analysis
- Market intelligence and alerts
- Financial advice
- Dashboard intelligence aggregation

## 2. High-Level Components

Frontend layer:
- App Router pages and tabbed UX
- Context providers:
  - user context (Supabase-backed profile/session)
  - location context (lat/lon/place state)
- Dashboard page with resilient payload normalization
- Next.js API route:
  - /api/dashboard/data (server-side proxy to backend)

Backend layer:
- Express server in backend/src/index.ts
- Route modules in backend/src/routes:
  - chat, weather, analyze-crop, finance, market, dashboard, user-location
- Domain services in backend/src/services
- Domain agents in backend/src/agents
- Orchestrator in backend/src/orchestrator
- Shared contracts in backend/src/utils/types.ts

Data and external providers:
- Supabase (auth + profile persistence)
- Groq API (LLM tasks)
- OpenWeather API
- SoilGrids API
- Market data provider (Agmarknet-compatible service with fallback behavior)

## 3. Runtime Request Flows

### 3.1 Dashboard flow (deployed-safe)
1. User opens Home tab.
2. Frontend resolves API base.
3. If direct API base is missing/localhost in production browser, frontend calls /api/dashboard/data.
4. Proxy route calls backend /dashboard/data using BACKEND_API_URL.
5. Backend dashboard service aggregates weather, soil, market, crop, finance, and AI insights.
6. Aggregation applies fallback values per source and hard fallback as needed.
7. Frontend normalizes payload and renders all dashboard sections.

### 3.2 Chat flow
1. Frontend sends POST /chat.
2. Backend orchestrator detects intent and dispatches domain agents.
3. Aggregated response returns final message plus structured sections.
4. On route-level failure, backend returns safe fallback response payload.

### 3.3 Location persistence flow
1. Frontend submits POST /user/location.
2. Backend validates coordinates and applies per-user rate limit.
3. Backend patches profile in Supabase via service-role key.
4. Location metadata becomes available for dashboard and advisory features.

## 4. Reliability and Fallback Strategy

Implemented reliability principles:
- Avoid hard failures in user-facing intelligence endpoints.
- Return semantically valid fallback payloads when providers are unavailable.
- Keep endpoint contracts stable for frontend rendering.
- Use proxy pattern in deployed frontend to avoid localhost/CORS misconfig impact.

Notable examples:
- Weather route returns fallback advisory on invalid coordinates or upstream failure.
- Dashboard route and service return 200 with fallback intelligence instead of hard 5xx for partial outages.
- Frontend dashboard uses payload normalization and warning display to keep analytics visible.

## 5. Security and Configuration Boundaries

Frontend env scope:
- NEXT_PUBLIC_* keys for browser-accessible settings.
- BACKEND_API_URL for server-side proxy routing.

Backend env scope:
- GROQ and provider API keys
- SUPABASE_SERVICE_ROLE_KEY for privileged profile patching
- FRONTEND_URL for CORS allowlist

Important boundary:
- Service role key must remain backend-only.

## 6. Deployment Topology

Recommended topology:
- Frontend deployed on Vercel (or equivalent)
- Backend deployed on a Node-capable host
- Supabase managed separately

Production dashboard connectivity:
- Frontend runtime calls /api/dashboard/data
- Proxy route forwards to backend URL from BACKEND_API_URL
- This prevents production browser calls to localhost and reduces CORS surface

## 7. Architecture Diagram Source (Mermaid)

Copy this block into Mermaid Live Editor or Markdown preview that supports Mermaid.

```mermaid
flowchart TB
    subgraph U[User Devices]
      B[Browser]
    end

    subgraph F[Frontend: Next.js]
      PAGES[App Pages and Tabs\nHome/Assistant/Market/Profile\nWeather/Finance/Crop/Onboarding]
      CTX[User and Location Contexts]
      DPROXY[/api/dashboard/data\nServer Route Proxy]
    end

    subgraph BE[Backend: Express API]
      IDX[index.ts]
      R1[/chat]
      R2[/dashboard and /dashboard/data]
      R3[/weather]
      R4[/analyze-crop]
      R5[/market-intelligence and /market-alerts]
      R6[/financial-advice]
      R7[/user/location]

      ORCH[Orchestrator]
      AGENTS[Domain Agents\nweather/crop/market/finance/image]
      SVCS[Services\ndashboard/soil/market/groq/government]
      CACHE[In-memory cache\nweather/soil/mandi TTL]
    end

    subgraph DATA[Data and External Providers]
      SUPA[(Supabase\nAuth + Profiles)]
      GROQ[Groq LLM API]
      OWM[OpenWeather API]
      SOIL[SoilGrids API]
      MKT[Market Data Provider]
    end

    B --> PAGES
    PAGES <--> CTX
    PAGES -->|dashboard fetch| DPROXY
    PAGES -->|feature fetches| IDX
    DPROXY -->|forward request| R2

    IDX --> R1
    IDX --> R2
    IDX --> R3
    IDX --> R4
    IDX --> R5
    IDX --> R6
    IDX --> R7

    R1 --> ORCH
    ORCH --> AGENTS
    AGENTS --> GROQ
    AGENTS --> OWM

    R2 --> SVCS
    SVCS --> CACHE
    SVCS --> OWM
    SVCS --> SOIL
    SVCS --> MKT
    SVCS --> GROQ
    SVCS --> AGENTS

    R3 --> AGENTS
    R4 --> AGENTS
    R5 --> SVCS
    R6 --> AGENTS
    R7 --> SUPA

    CTX --> SUPA
```

## 8. How to Create and Export the Diagram

Option A: Mermaid Live Editor
1. Open https://mermaid.live
2. Paste the Mermaid source block from this file.
3. Adjust layout labels if needed.
4. Export as PNG or SVG for slides/documentation.

Option B: VS Code Markdown Preview
1. Open this file.
2. Use a Mermaid-capable markdown preview extension.
3. Export preview or screenshot for quick sharing.

Option C: Keep architecture versioned in repo
1. Update this document whenever a major module/route is added.
2. In pull requests, include architecture changes for backend routes/services or frontend proxy logic.

## 9. Suggested Diagram Update Rules

When adding a new feature, update:
- Route node in backend section
- Service/agent relationship
- External dependency node (if any)
- Frontend page that consumes it

When changing deployment behavior, update:
- Proxy path and direction
- Env variable requirements
- Any CORS/auth boundary notes
