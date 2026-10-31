# 📚 LifeLine Documentation Suite

Welcome to the comprehensive technical documentation for **LifeLine** — an Emergency Ambulance Dispatch, Dynamic Route Prediction & Hospital Recommendation Platform engineered for **Problem Statement 1** of the **KALPAK-2K26 Campus Cup Hackathon**.

This documentation suite is structured so that judges, software engineers, and domain specialists can quickly understand every layer of the architecture, data models, mathematical algorithms, AI triage logic, and UI components.

---

## 📑 Documentation Index

| Document | Title | Description |
| :--- | :--- | :--- |
| **[01. System Architecture](./01-system-architecture.md)** | High-Level Architecture & End-to-End Workflow | Complete system blueprint, architectural diagrams, monorepo design, and request lifecycle. |
| **[02. Database & Data Models](./02-database-and-models.md)** | PostgreSQL Schema & Solapur Road Graph | Prisma ORM models, relations, field definitions, and Solapur municipal road network topology. |
| **[03. Core Algorithms](./03-core-algorithms.md)** | Routing, Dispatch & Scoring Formulations | Mathematical formulations: A\* pathfinding, heuristic admissibility proof, Dijkstra comparison, capability-weighted dispatch, and hospital scoring. |
| **[04. AI Triage Engine](./04-ai-triage-engine.md)** | LLM Triage & Autonomous Rule Fallback | Google Gemini API integration, prompt design, Zod schema validation, and 3-second offline fallback. |
| **[05. API Reference](./05-api-documentation.md)** | Complete REST API Specification | Endpoint specifications, HTTP methods, request/response JSON schemas, and error handling. |
| **[06. Autonomous Simulation](./06-autonomous-simulation.md)** | Real-Time Kinematics & Chaos Injection | Autonomous background movement loop (1s ticks, 10x speed), waypoint progression, and road disruption. |
| **[07. Frontend Architecture](./07-frontend-components.md)** | React 19 UI & Leaflet Map Engine | UI components, Leaflet custom canvas/divIcons, offline fallback layer, state management, and real-time polling. |
| **[08. Judges Presentation Guide](./08-judges-presentation-guide.md)** | Hackathon Demo Script & Judging Rubric | 2-minute live demonstration script, expected judging questions & answers, and criteria alignment. |

---

## 🚀 Quick Start Summary

### 1. Prerequisites
- **Node.js**: v18 or higher
- **PostgreSQL**: Running locally on port `5433` (configured in `.env`)
- **Package Manager**: `npm`

### 2. Launching the Backend (Port 3000)
```bash
cd backend
npm run seed     # Seeds 26 Solapur nodes, 70 edges, 4 stations, 10 ambulances, 6 hospitals
npm test         # Runs full automated test suite (all 4 test files)
npm run dev      # Launches Express API & Autonomous Simulation Engine
```

### 3. Launching the Frontend (Port 5173)
```bash
cd frontend
npm run dev      # Launches Vite dev server with reverse proxy
```

Access the application in your browser: **`http://localhost:5173`**

