# 🖥️ Frontend Architecture & User Interface

LifeLine features an emergency operations dashboard built with **React 19**, **TypeScript**, **Vite**, and **Leaflet**. It is designed for emergency dispatchers, field coordinators, and technical hackathon judges.

---

## 1. Technology Stack & Design System

- **Framework:** React 19 + TypeScript
- **Bundler & Tooling:** Vite (Fast HMR & reverse proxy)
- **Map Engine:** Leaflet (`leaflet` + CSS) with custom hardware-accelerated canvas overlays
- **Styling:** Modern dark-mode palette (`#0f172a` Slate-900 background) optimized for mission-critical command centers:
  - 🔴 **Emergency Red:** `#ef4444` (Severity 5, Blocked Roads, Alarms)
  - 🔵 **Stage 1 Primary Blue:** `#2563eb` (Ambulance to Patient leg)
  - 🟢 **Stage 2 Emerald Green:** `#10b981` (Ambulance to Hospital leg)
  - 🟠 **Traffic Orange:** `#f97316` (Congestion, Diverts)
  - 🟡 **Triage Amber:** `#f59e0b` (Rule-based Fallback, Moderate Severity)

---

## 2. Directory Structure & Component Hierarchy

```
frontend/src/
├── api.ts                       # Axios client & REST endpoint connectors
├── App.tsx                      # Root state orchestrator & polling loop
├── index.css                    # Tailwind / custom CSS & Leaflet marker animations
├── types.ts                     # TypeScript data interfaces matching Prisma models
└── components/
    ├── Header.tsx               # Top command bar, KPIs, and demo reset
    ├── MapView.tsx              # Interactive Solapur Leaflet map engine
    ├── DispatchConsole.tsx      # Emergency intake form, ranking cards & actions
    ├── SimulationPanel.tsx      # Chaos engineering panel (roadblocks & traffic)
    ├── HistoryView.tsx          # Full audit log & algorithmic comparison table
    └── HowItWorksModal.tsx      # In-app architecture & judging reference dialog
```

---

## 3. Detailed Component Breakdown

### 3.1 `MapView.tsx` (Interactive Map Engine)
The geographic visualization engine renders the 26-node Solapur municipal road network.

#### Key Visual Layers:
1. **Base Map Layer:** OpenStreetMap tile layer with smooth error fallback.
2. **Road Network Polylines:**
   - **Normal Roads:** Slate-grey (`#64748b`), 3px stroke.
   - **Heavy Traffic ($T \ge 2.0$):** Orange (`#f97316`), 4px stroke.
   - **Blocked Corridors:** Red (`#ef4444`), 5px dashed stroke (`dashArray: "6, 8"`).
3. **Active Route Legs:**
   - **Stage 1 (To Patient):** Glowing Royal Blue (`#2563eb`), 6px stroke with a 10px translucent shadow underlay.
   - **Stage 2 (To Hospital):** Glowing Emerald Green (`#10b981`), 6px stroke.
4. **Custom Leaflet DivIcons:**
   - 🚑 **Ambulances:** Rendered with live heading orientation and status badges (`AVAILABLE`, `EN_ROUTE`, `AT_PATIENT`).
   - 🏥 **Hospitals:** Rendered with bed availability counters and cross badges.
   - 📍 **Incident Pin:** Pulsing target marker positioned at the caller's coordinates.
   - 🏢 **Ambulance Stations:** Base depots.

#### Interactive Map Events:
- **Click anywhere on the map:** Pins an emergency location, snaps it to the nearest road junction, and auto-fills coordinates in the intake form.
- **Click any road edge:** Opens an edge inspector modal to instantly toggle roadblocks or inject traffic congestion.

---

### 3.2 `DispatchConsole.tsx` (Intake & Decision Support)
The core workflow console for 911/112 call intake and dispatch supervision.

#### Features:
1. **Quick-Load Hackathon Presets:**
   - *Preset 1: Critical Cardiac at Saat Rasta (Sev 5, ICU)*
   - *Preset 2: Multi-Vehicle Collision on Pune Highway (Sev 4, Trauma)*
   - *Preset 3: Acute Pediatric Distress at Degaon (Sev 4, Pediatric)*
   - *Preset 4: Second-Degree Thermal Burns at MIDC (Sev 4, Burns)*
2. **AI Triage Inspection Card:**
   - Displays parsed clinical category, assigned severity scale (1–5), required specialty, and ICU necessity.
   - Displays explicit **AI Source Badge**: `AI Triage (Gemini 2.5-Flash)` or `Rule-based Triage (Offline Fallback)`.
3. **Ambulance Ranking Table:**
   - Highlights the winning vehicle.
   - Renders the full candidate comparison list with distance, raw ETA, suitability penalties, and reason strings for auditability.
4. **Hospital Recommendation Breakdown:**
   - Visible upon patient pickup.
   - Renders radar score breakdown: Normalized ETA score, Specialty match penalty, Bed availability penalty, and Trauma level penalty.
5. **Action Flow Buttons:**
   - `Confirm Patient Pickup` (activates when ambulance arrives at scene).
   - `Complete Patient Handover` (activates when ambulance arrives at hospital gate).

---

### 3.3 `SimulationPanel.tsx` (Chaos Engineering & Controls)
Provides judges and evaluators with real-time knobs to test the system's dynamic self-healing capabilities:

- **Road Disruption Controls:** One-click toggles to block major arterial roads (e.g., *Saat Rasta ↔ Solapur Station*, *Old Pune Naka ↔ Civil Hospital*).
- **Traffic Congestion Sliders:** Adjust traffic multiplier $1.0\times \to 5.0\times$.
- **Manual Physics Step:** "Step 1 Tick" button to advance the simulation manually.
- **Hospital Overload Simulator:** Decrement available beds to zero to demonstrate automatic rerouting to alternate facilities.

---

### 3.4 `HistoryView.tsx` (Audit & Algorithm Benchmarking)
A forensic audit viewer for hospital administrators and municipal oversight:

- **Algorithmic Showdown:** Displays side-by-side metrics comparing **A\*** vs. **Dijkstra** for every journey (nodes explored, computation time, distance, ETA).
- **Timeline Ledger:** Chronological record of all `JourneyEvents` (dispatch time, roadblocks encountered, detours calculated, pickup time, and final handover timestamp).

---

## 4. Real-Time Synchronization & Polling Strategy

To maintain sub-second situational awareness across distributed clients without introducing WebSocket firewall blockers:
- `App.tsx` runs an autonomous `setInterval` polling every **2000 milliseconds**.
- Queries `/api/map/graph` and `/api/emergencies` concurrently using `Promise.allSettled`.
- **Optimistic UI Updates:** Dispatching an ambulance or toggling a roadblock updates local component state immediately, followed by automated server reconciliation on the next polling tick.

