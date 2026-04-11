# FarmEase - Agentic AI for Farmers

FarmEase is a full-stack AI assistant platform designed to support farmers with practical, timely, and localized guidance. This repository contains the initial frontend and backend foundations for the project.

## Problem Statement

Many farmers do not have instant access to reliable agronomy guidance, weather-informed planning, and decision support in a simple conversational format. FarmEase aims to bridge that gap through an intelligent, multi-agent AI system tailored to real on-ground farming needs.

## Planned Features

- Conversational AI chat interface for farming queries
- Multi-agent backend architecture (weather, crops, soil, market intelligence)
- Context-aware recommendations for farmer workflows
- API-first backend for future mobile and partner integrations
- Production-ready TypeScript codebase split into frontend and backend services

## Tech Stack

### Frontend

- Next.js (App Router)
- Tailwind CSS
- TypeScript

### Backend

- Node.js
- Express
- TypeScript

## Project Structure

```text
root/
  frontend/
  backend/
  README.md
```

## Setup Instructions

1. Clone the repository.
2. Install frontend dependencies:
   - `cd frontend`
   - `npm install`
3. Install backend dependencies:
   - `cd ../backend`
   - `npm install`
4. Configure environment variables:
   - `frontend/.env.example` -> copy to `frontend/.env.local`
   - `backend/.env.example` -> copy to `backend/.env`
5. Run backend:
   - `cd backend`
   - `npm run dev`
6. Run frontend (in a new terminal):
   - `cd frontend`
   - `npm run dev`

## Initial API Endpoints

- `GET /health` -> returns `OK`
- `POST /chat` -> returns a dummy chat response

This is the initial commit-ready baseline for FarmEase.
