import { prisma } from "../DB/prisma.js";
import { findRouteAStar, type RouteResult } from "./routing.service.js";
import { getRoadGraph } from "./graph.service.js";

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
    route: RouteResult;
}

export interface AmbulanceSelectionResult {
    winner: AmbulanceCandidate;
    rankedList: AmbulanceCandidate[];
}

export async function selectOptimalAmbulance(params: {
    patientNodeId: string;
    severity: number;
    category?: string | undefined;
}): Promise<AmbulanceSelectionResult> {
    const { patientNodeId, severity } = params;

    const availableAmbulances = await prisma.ambulance.findMany({
        where: {
            status: "AVAILABLE",
        },
        include: {
            station: true,
        },
    });

    if (availableAmbulances.length === 0) {
        throw new Error("No ambulances are currently AVAILABLE in the fleet");
    }

    const graph = await getRoadGraph();
    const candidates: AmbulanceCandidate[] = [];

    for (const amb of availableAmbulances) {
        const route = await findRouteAStar(amb.currentNodeId, patientNodeId, graph);

        if (!route) {
            continue;
        }

        let suitabilityPenalty = 0;
        let suitabilityReason = "";

        if (severity >= 4) {
            if (amb.type === "ICU") {
                suitabilityPenalty = 0.0;
                suitabilityReason = `Best match for critical triage (Severity ${severity}): Full ICU onboard capability.`;
            } else if (amb.type === "ADVANCED") {
                suitabilityPenalty = 0.5;
                suitabilityReason = "Advanced life support capability suitable for high-severity emergency.";
            } else {
                suitabilityPenalty = 3.0;
                suitabilityReason = "Basic Life Support: Assigned +3.0 min capability penalty for critical triage.";
            }
        } else {
            if (amb.type === "BASIC") {
                suitabilityPenalty = 0.0;
                suitabilityReason = "Standard BLS unit ideal for moderate urgency.";
            } else if (amb.type === "ADVANCED") {
                suitabilityPenalty = 0.3;
                suitabilityReason = "ALS unit available (small buffer to preserve for critical cases).";
            } else {
                suitabilityPenalty = 0.8;
                suitabilityReason = "ICU unit available (preserved for high-trauma/cardiac emergencies).";
            }
        }

        const effectiveEta = parseFloat((route.etaMinutes + suitabilityPenalty).toFixed(2));
        const currentNode = graph.nodes.get(amb.currentNodeId);

        candidates.push({
            ambulanceId: amb.id,
            code: amb.code,
            type: amb.type,
            stationName: amb.station?.name || "Independent Post",
            currentLocationName: currentNode?.name || amb.currentNodeId,
            distanceKm: route.distanceKm,
            rawEtaMinutes: route.etaMinutes,
            effectiveEtaMinutes: effectiveEta,
            suitabilityPenalty,
            isWinner: false,
            reason: suitabilityReason,
            route,
        });
    }

    if (candidates.length === 0) {
        throw new Error("No available ambulance can reach the patient due to road blockades");
    }

    // Sort ascending by effective ETA
    candidates.sort((a, b) => a.effectiveEtaMinutes - b.effectiveEtaMinutes);

    const winner = candidates[0];
    if (!winner) {
        throw new Error("Failed to pick winning ambulance candidate");
    }

    winner.isWinner = true;
    winner.reason = `Selected ${winner.code} (${winner.type}): Lowest effective ETA of ${winner.effectiveEtaMinutes} min (${winner.distanceKm} km from ${winner.stationName}). ${winner.reason}`;

    return {
        winner,
        rankedList: candidates,
    };
}
