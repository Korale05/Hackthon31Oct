# 🏆 Hackathon Presentation & Judging Guide

**Event:** KALPAK-2K26 Campus Cup Hackathon  
**Problem Statement 1:** "LifeLine" – Emergency Ambulance Dispatch, Dynamic Route Prediction & Hospital Recommendation System  
**Deployment Region:** Solapur Metropolitan Municipal Corporation, Maharashtra, India  

---

## 1. Executive Summary & Value Proposition

During medical emergencies, every 60-second delay increases trauma mortality by up to 10% (the clinical **"Golden Hour"**). Traditional dispatch systems rely on static phone trees, manual dispatcher intuition, and uncoordinated hospital selection, frequently sending critical patients to overcrowded or ill-equipped facilities.

**LifeLine solves this through a resilient, four-pillar architecture:**
1. **AI Decision-Support Triage:** Translates natural language caller distress calls into structured clinical triage with a mandatory **3-second offline rule fallback**.
2. **Capability-Weighted Vehicle Allocation:** Evaluates the entire municipal fleet using A\* routing with clinical suitability adjustments (+3m BLS penalty for critical cases).
3. **Dynamic Self-Healing Rerouting:** Automatically detects road closures and traffic surges, computing instant detours from live vehicle GPS coordinates.
4. **Post-Pickup Multi-Factor Hospital Recommendation:** Dynamically matches patients to available facilities based on real-time bed capacity, trauma certification, and specialty matching.

---

## 2. 2-Minute High-Impact Live Demonstration Script

| Time | Stage | Action on Screen | Key Talking Point for Judges |
| :---: | :--- | :--- | :--- |
| **0:00 – 0:30** | **Emergency Intake & AI Triage** | Select preset *"Critical Cardiac Emergency (Saat Rasta)"* and click **Dispatch**. | *"Our AI triage engine leverages Google Gemini to parse natural language descriptions into a 5-point severity scale and specialty requirements in under 800ms. If network connectivity drops in a disaster, our zero-latency 3-second rule fallback takes over instantly with zero downtime."* |
| **0:30 – 1:00** | **Capability Dispatch & Autonomous Motion** | Expand the **Ambulance Ranking Table**; point out the dispatched vehicle and its blue route on the map. | *"Notice why AMB-ICU-01 was selected. Even though a basic ambulance was slightly closer physically, our algorithm applied a +3.0-minute capability penalty because cardiac emergencies require advanced cardiac life support equipment. The ambulance is now autonomously moving at 10x simulated speed."* |
| **1:00 – 1:30** | **Chaos Injection & Dynamic Rerouting** | In the **Simulation Panel**, click **Block Road** on the corridor currently ahead of the ambulance. | *"Watch the map: the road turns dashed red. The backend detects that an active vehicle's trajectory is severed, invalidates the graph cache, snaps the ambulance's live GPS to the road network, and computes an instant detour. The audit timeline logs the exact ETA shift."* |
| **1:30 – 2:00** | **Pickup & Hospital Recommendation** | Ambulance reaches patient (`AT_PATIENT`). Click **Confirm Patient Pickup**. | *"We deliberately separate hospital selection until pickup is confirmed. The system filters for open emergency departments, available beds, and cardiac specialties, scoring hospitals with our Golden Hour formula ($w_{\text{eta}} = 0.70$). The patient is transported along the green route, admitted, and the ambulance returns to available status."* |

---

## 3. Defense of Design Decisions & Technical Q&A Cheat Sheet

### Q1: "Why not simply use Google Maps Directions API?"
> **Answer:** *"Google Maps is designed for consumer navigation, not municipal emergency management. It lacks: (1) private road and disaster block overrides, (2) capability-weighted fleet assignment, (3) real-time hospital bed integration, (4) custom priority heuristics, and (5) offline resilience in disconnected disaster scenarios. LifeLine gives city authorities total sovereignty over their transit network."*

### Q2: "Can you prove that your A* algorithm always finds the optimal path?"
> **Answer:** *"Yes. A\* is mathematically guaranteed to be globally optimal if and only if its heuristic function $h(n)$ is admissible (never overestimates the true cost). We define $h(n) = \frac{\text{haversine}(n, \text{goal})}{v_{\text{max}}} \times 60$, where $v_{\text{max}}$ is the theoretical maximum speed limit of the road network ($60\text{ km/h}$). Because great-circle distance is the geometric lower bound and no vehicle can exceed $v_{\text{max}}$, $h(n) \le h^*(n)$ for all nodes. This gives us 100% optimality while exploring ~50% fewer nodes than Dijkstra."*

### Q3: "What prevents the LLM from hallucinating wrong medical advice?"
> **Answer:** *"First, LifeLine explicitly treats AI output as decision support for dispatch, never a clinical diagnosis. Second, we use strict JSON-mode schema validation via Zod with bounded integer clamping. Third, the LLM only suggests vehicle requirements; all pathfinding, fleet assignment, and hospital scoring algorithms are 100% deterministic and mathematical."*

### Q4: "Why do you wait until patient pickup to recommend the destination hospital?"
> **Answer:** *"Pre-assigning a hospital at the 911 intake stage is a major clinical anti-pattern. The caller's initial phone description is frequently inaccurate (e.g., severe indigestion mistaken for a myocardial infarction). Reserving a specialty hospital bed 20 minutes in advance locks up critical ICU capacity and risks transporting the patient to the wrong facility if their condition stabilizes or deteriorates on scene."*

### Q5: "How does the system prevent race conditions during concurrent emergency calls?"
> **Answer:** *"We use atomic database reservation. When an ambulance is selected, the database executes an atomic `UPDATE` condition (`WHERE id = :id AND status = 'AVAILABLE'`). If two concurrent requests attempt to claim the same unit, only one succeeds; the second request automatically triggers a fleet re-evaluation and claims the next-best available unit."*

---

## 4. Evaluation Rubric Alignment

| Rubric Dimension | LifeLine Implementation |
| :--- | :--- |
| **Problem Understanding** | Solves end-to-end municipal triage, ambulance dispatch, dynamic rerouting, and hospital bed coordination. |
| **Algorithmic Rigor** | A\* with admissible Haversine heuristic, Dijkstra benchmarking, multi-factor penalty scoring, and dynamic edge invalidation. |
| **Architecture & Code Quality** | Clean monorepo, strict TypeScript builds (`tsc -b`), Prisma 7 ORM, modular services, and automated unit test coverage. |
| **Innovation & Resilience** | Google Gemini LLM with 3-second offline fallback rule engine, live chaos injection, and 10x autonomous kinematics simulation. |
| **User Experience** | High-contrast emergency operations console, interactive Leaflet map, real-time KPI metrics, and complete audit trail. |

