# 📡 REST API Reference

LifeLine exposes a high-performance RESTful API adhering to strict contract serialization. All responses are encapsulated in standardized JSON envelopes (`ApiResponse` / `ApiError`).

---

## 1. Response & Error Envelopes

### Success Envelope (`ApiResponse`)
```json
{
  "statusCode": 200,
  "data": { ... },
  "message": "Human-readable operation status",
  "success": true
}
```

### Error Envelope (`ApiError`)
```json
{
  "statusCode": 400,
  "message": "Detailed error summary",
  "success": false,
  "errors": [
    {
      "field": "lat",
      "message": "Latitude must be within the Solapur region (approx 17.65)"
    }
  ]
}
```

---

## 2. Emergency Management Endpoints

### 2.1 Create Emergency Intake & Dispatch
Performs automated triage (Gemini LLM / rule fallback), snaps coordinates to the road network, assigns the optimal ambulance, and generates Stage 1 routing.

- **Method / URL:** `POST /api/emergencies`
- **Headers:** `Content-Type: application/json`

#### Request Body
```json
{
  "callerName": "Vijay Sharma",
  "phone": "+91 98224 56789",
  "description": "Elderly patient complaining of severe acute chest pain and dizziness",
  "lat": 17.6643,
  "lng": 75.9243,
  "symptoms": ["chest pain", "shortness of breath"]
}
```

#### Field Validation Rules (Zod)
- `callerName`: String, minimum 2 characters.
- `phone`: String, minimum 7 characters.
- `description`: String, minimum 5 characters.
- `lat`: Number between `17.0` and `18.5` (Solapur metropolitan coordinates).
- `lng`: Number between `75.0` and `76.5`.
- `symptoms`: Array of strings (optional).

#### Response (`201 Created`)
```json
{
  "statusCode": 201,
  "message": "Emergency registered, triage completed, and ambulance dispatched successfully",
  "success": true,
  "data": {
    "emergency": {
      "id": "cm3a4bc...",
      "callerName": "Vijay Sharma",
      "phone": "+91 98224 56789",
      "category": "CARDIAC",
      "severity": 5,
      "requiredSpecialty": "cardiac",
      "aiReasoning": "Acute cardiac symptom profile detected.",
      "aiSource": "LLM",
      "status": "EN_ROUTE_TO_PATIENT",
      "nearestNodeId": "node_04"
    },
    "dispatchedAmbulance": {
      "ambulanceId": "amb_01",
      "code": "AMB-ICU-01",
      "type": "ICU",
      "distanceKm": 3.42,
      "rawEtaMinutes": 4.1,
      "effectiveEtaMinutes": 4.1
    },
    "routeLeg": {
      "stage": "TO_PATIENT",
      "distanceKm": 3.42,
      "etaMinutes": 4.1,
      "pathNodeIds": ["node_01", "node_03", "node_04"],
      "algorithm": "A_STAR",
      "version": 1
    },
    "rankedAmbulances": [ ... ]
  }
}
```

---

### 2.2 List Active & Historical Emergencies
Retrieves all emergencies sorted by creation date with ambulance and hospital relations.

- **Method / URL:** `GET /api/emergencies`
- **Query Parameters:**
  - `status` (optional): Filter by `EN_ROUTE_TO_PATIENT`, `EN_ROUTE_TO_HOSPITAL`, `COMPLETED`, etc.
  - `limit` (optional): Integer (default: 50).

#### Response (`200 OK`)
```json
{
  "statusCode": 200,
  "data": [
    {
      "id": "cm3a4bc...",
      "callerName": "Vijay Sharma",
      "category": "CARDIAC",
      "severity": 5,
      "status": "EN_ROUTE_TO_PATIENT",
      "ambulance": { "code": "AMB-ICU-01", "type": "ICU" },
      "hospital": null,
      "createdAt": "2026-10-31T07:15:00.000Z"
    }
  ],
  "success": true
}
```

---

### 2.3 Get Emergency Details by ID
Returns the comprehensive operational record including route geometry, waypoint coordinates, and the complete audit timeline (`journeyEvents`).

- **Method / URL:** `GET /api/emergencies/:id`

#### Response (`200 OK`)
```json
{
  "statusCode": 200,
  "data": {
    "id": "cm3a4bc...",
    "status": "EN_ROUTE_TO_PATIENT",
    "routeLegs": [
      {
        "id": "leg_01",
        "stage": "TO_PATIENT",
        "pathNodeIds": ["node_01", "node_03", "node_04"],
        "distanceKm": 3.42,
        "etaMinutes": 4.1,
        "isActive": true,
        "version": 1
      }
    ],
    "journeyEvents": [
      {
        "type": "ASSIGNED",
        "message": "Ambulance AMB-ICU-01 dispatched. ETA: 4.1m",
        "createdAt": "2026-10-31T07:15:01.000Z"
      }
    ]
  },
  "success": true
}
```

---

### 2.4 Confirm Patient Pickup (Stage 2 Transition)
Executed when paramedics secure the patient onboard. Triggers the **Hospital Recommendation Engine**, applies capacity and specialty filters, scores eligible facilities, reserves the destination, and generates Stage 2 routing.

- **Method / URL:** `POST /api/emergencies/:id/confirm-pickup`

#### Response (`200 OK`)
```json
{
  "statusCode": 200,
  "message": "Patient pickup confirmed. Optimal hospital recommended and Stage 2 route generated.",
  "success": true,
  "data": {
    "emergency": {
      "id": "cm3a4bc...",
      "status": "EN_ROUTE_TO_HOSPITAL",
      "hospitalId": "hosp_01"
    },
    "recommendedHospital": {
      "hospitalId": "hosp_01",
      "name": "Ashwini Sahakari Rugnalaya (Super Specialty)",
      "totalScore": 0.165,
      "scoreBreakdown": {
        "etaScore": 0.082,
        "specialtyScore": 0.0,
        "bedScore": 0.051,
        "traumaScore": 0.033
      }
    },
    "stage2RouteLeg": {
      "stage": "TO_HOSPITAL",
      "distanceKm": 4.85,
      "etaMinutes": 5.8,
      "pathNodeIds": ["node_04", "node_07", "node_11", "node_02"],
      "algorithm": "A_STAR"
    }
  }
}
```

---

### 2.5 Complete Emergency Handover
Finalizes clinical transfer at the hospital emergency department, decrements available bed capacity, and restores the ambulance to `AVAILABLE` status.

- **Method / URL:** `POST /api/emergencies/:id/complete`

#### Response (`200 OK`)
```json
{
  "statusCode": 200,
  "message": "Emergency successfully completed. Patient admitted and ambulance returned to AVAILABLE status.",
  "success": true,
  "data": {
    "emergencyId": "cm3a4bc...",
    "status": "COMPLETED",
    "completedAt": "2026-10-31T07:28:45.000Z",
    "ambulance": { "id": "amb_01", "status": "AVAILABLE" },
    "hospital": { "id": "hosp_01", "availableBeds": 41, "icuBeds": 11 }
  }
}
```

---

## 3. Road Network & Map Topology Endpoints

### 3.1 Get Complete Graph Topology
Returns the complete network representation for map rendering (nodes, edges, traffic factors, roadblock states, fleet locations, and hospital metadata).

- **Method / URL:** `GET /api/map/graph`

#### Response (`200 OK`)
```json
{
  "statusCode": 200,
  "data": {
    "nodes": [
      { "id": "node_01", "name": "Solapur Central Railway Station", "lat": 17.6715, "lng": 75.9104 }
    ],
    "edges": [
      {
        "id": "edge_01_fwd",
        "fromNodeId": "node_01",
        "toNodeId": "node_02",
        "distanceKm": 1.45,
        "baseSpeedKmh": 45,
        "trafficFactor": 1.0,
        "isBlocked": false
      }
    ],
    "ambulances": [ ... ],
    "hospitals": [ ... ],
    "stations": [ ... ]
  },
  "success": true
}
```

---

### 3.2 Block / Unblock Road Edge
Toggles road impassability. **Automatically invalidates graph cache and triggers dynamic rerouting for all active ambulances traversing this edge.**

- **Method / URL:** `PATCH /api/map/roads/:edgeId/block`
- **Request Body:**
```json
{
  "isBlocked": true
}
```

#### Response (`200 OK`)
```json
{
  "statusCode": 200,
  "message": "Road edge updated. 1 active emergency rerouted.",
  "success": true,
  "data": {
    "edge": { "id": "edge_01_fwd", "isBlocked": true },
    "reroutes": [
      {
        "emergencyId": "cm3a4bc...",
        "oldEta": 4.1,
        "newEta": 6.3,
        "deltaMinutes": 2.2,
        "reason": "Road edge_01_fwd blocked"
      }
    ]
  }
}
```

---

### 3.3 Set Road Traffic Factor
Adjusts congestion density ($1.0 = \text{normal}$, $2.5 = \text{heavy}$).

- **Method / URL:** `PATCH /api/map/roads/:edgeId/traffic`
- **Request Body:**
```json
{
  "trafficFactor": 2.5
}
```

---

### 3.4 Update Hospital Capacity or Divert Status
Allows hospital administrators or regional dispatchers to update bed numbers or close emergency intake.

- **Method / URL:** `PATCH /api/map/hospitals/:id`
- **Request Body:**
```json
{
  "availableBeds": 0,
  "emergencyOpen": false
}
```

---

## 4. Autonomous Simulation Endpoints

### 4.1 Trigger Manual Simulation Step
Advances all active ambulances along their assigned routes.

- **Method / URL:** `POST /api/simulation/tick`
- **Request Body (Optional):**
```json
{
  "timeCompressionFactor": 10
}
```

---

### 4.2 Reset Simulation to Initial Seed State
Clears all active emergency calls, resets road traffic and blockages to baseline, restores full hospital bed counts, and teleports ambulances back to their home stations.

- **Method / URL:** `POST /api/simulation/reset`
- **Response (`200 OK`):**
```json
{
  "statusCode": 200,
  "message": "Simulation reset successfully to initial Solapur seed topology.",
  "success": true
}
```

