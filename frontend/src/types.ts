export interface RoadNode {
    id: string;
    name: string;
    lat: number;
    lng: number;
}

export interface RoadEdge {
    id: string;
    fromNodeId: string;
    toNodeId: string;
    distanceKm: number;
    baseSpeedKmh: number;
    trafficFactor: number;
    isBlocked: boolean;
}

export interface AmbulanceStation {
    id: string;
    name: string;
    lat: number;
    lng: number;
    nodeId: string;
}

export interface Ambulance {
    id: string;
    code: string;
    type: "BASIC" | "ADVANCED" | "ICU" | string;
    status: "AVAILABLE" | "ASSIGNED" | "EN_ROUTE_TO_PATIENT" | "AT_PATIENT" | "TRANSPORTING" | "COMPLETED" | "OFFLINE" | string;
    currentNodeId: string;
    lat: number;
    lng: number;
    stationId: string;
    station?: AmbulanceStation;
}

export interface Hospital {
    id: string;
    name: string;
    lat: number;
    lng: number;
    nodeId: string;
    specialties: string[];
    totalBeds: number;
    availableBeds: number;
    icuBeds: number;
    emergencyOpen: boolean;
    traumaLevel: number;
}

export interface RouteLeg {
    id: string;
    emergencyId: string;
    stage: "TO_PATIENT" | "TO_HOSPITAL" | string;
    pathNodeIds: string[];
    distanceKm: number;
    etaMinutes: number;
    algorithm: "A_STAR" | "DIJKSTRA" | string;
    version: number;
    isActive: boolean;
    reason?: string | null;
}

export interface JourneyEvent {
    id: string;
    emergencyId: string;
    type: string;
    message: string;
    createdAt: string;
}

export interface Emergency {
    id: string;
    callerName: string;
    phone: string;
    description: string;
    lat: number;
    lng: number;
    nearestNodeId: string;
    category: string;
    severity: number;
    requiredSpecialty: string;
    aiReasoning: string;
    aiSource: "LLM" | "RULES" | string;
    status:
        | "PENDING"
        | "AMBULANCE_ASSIGNED"
        | "EN_ROUTE_TO_PATIENT"
        | "AT_PATIENT"
        | "PICKUP_CONFIRMED"
        | "EN_ROUTE_TO_HOSPITAL"
        | "COMPLETED"
        | "CANCELLED"
        | string;
    ambulanceId?: string | null;
    hospitalId?: string | null;
    createdAt: string;
    pickupAt?: string | null;
    completedAt?: string | null;
    ambulance?: Ambulance | null;
    hospital?: Hospital | null;
    routeLegs?: RouteLeg[];
    journeyEvents?: JourneyEvent[];
}

export interface AmbulanceCandidate {
    ambulanceId: string;
    code: string;
    type: string;
    stationName: string;
    currentLocationName: string;
    distanceKm: number;
    rawEtaMinutes: number;
    effectiveEtaMinutes: number;
    suitabilityPenalty: number;
    isWinner: boolean;
    reason: string;
}

export interface HospitalScoreBreakdown {
    normalizedEta: number;
    etaScore: number;
    specialtyMismatch: number;
    specialtyScore: number;
    bedAvailabilityPenalty: number;
    bedScore: number;
    traumaLevelPenalty: number;
    traumaScore: number;
    totalScore: number;
}

export interface HospitalCandidate {
    hospitalId: string;
    name: string;
    nodeId: string;
    specialties: string[];
    totalBeds: number;
    availableBeds: number;
    icuBeds: number;
    emergencyOpen: boolean;
    traumaLevel: number;
    eligible: boolean;
    ineligibleReason?: string;
    distanceKm: number;
    etaMinutes: number;
    specialtyMatched: boolean;
    scoreBreakdown: HospitalScoreBreakdown;
    isWinner: boolean;
    recommendationReason: string;
}

export interface MapGraphData {
    nodes: RoadNode[];
    edges: RoadEdge[];
    stations: AmbulanceStation[];
    hospitals: Hospital[];
    ambulances: Ambulance[];
}

