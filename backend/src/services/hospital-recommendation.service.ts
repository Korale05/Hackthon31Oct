import { prisma } from "../DB/prisma.js";
import { findRouteAStar, type RouteResult } from "./routing.service.js";
import { getRoadGraph } from "./graph.service.js";

export interface HospitalScoreBreakdown {
    normalizedEta: number;
    etaWeight: number;
    etaScore: number;

    specialtyMismatch: number;
    specialtyWeight: number;
    specialtyScore: number;

    bedAvailabilityPenalty: number;
    bedWeight: number;
    bedScore: number;

    traumaLevelPenalty: number;
    traumaWeight: number;
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
    ineligibleReason?: string | undefined;

    distanceKm: number;
    etaMinutes: number;
    specialtyMatched: boolean;
    scoreBreakdown: HospitalScoreBreakdown;
    isWinner: boolean;
    recommendationReason: string;
    route?: RouteResult | undefined;
}

export interface HospitalRecommendationResult {
    winner: HospitalCandidate;
    rankedList: HospitalCandidate[];
    weightsUsed: {
        eta: number;
        specialty: number;
        beds: number;
        trauma: number;
    };
}

export const HOSPITAL_SCORING_WEIGHTS = {
    standard: {
        eta: 0.50,
        specialty: 0.25,
        beds: 0.15,
        trauma: 0.10,
    },
    criticalSeverity5: {
        eta: 0.70,
        specialty: 0.15,
        beds: 0.10,
        trauma: 0.05,
    },
};

export async function recommendOptimalHospital(params: {
    patientNodeId: string;
    severity: number;
    requiredSpecialty?: string | undefined;
    needsICU?: boolean | undefined;
}): Promise<HospitalRecommendationResult> {
    const { patientNodeId, severity, requiredSpecialty = "general", needsICU = false } = params;

    const hospitals = await prisma.hospital.findMany();
    if (hospitals.length === 0) {
        throw new Error("No hospitals registered in the database");
    }

    const weights = severity >= 5
        ? HOSPITAL_SCORING_WEIGHTS.criticalSeverity5
        : HOSPITAL_SCORING_WEIGHTS.standard;

    const graph = await getRoadGraph();
    const candidates: HospitalCandidate[] = [];

    const normSpecialty = requiredSpecialty.toLowerCase().trim();

    for (const hosp of hospitals) {
        let eligible = true;
        let ineligibleReason: string | undefined = undefined;

        if (!hosp.emergencyOpen) {
            eligible = false;
            ineligibleReason = "Emergency department is currently closed";
        } else if (hosp.availableBeds <= 0) {
            eligible = false;
            ineligibleReason = "Zero available beds in general capacity";
        } else if (needsICU && hosp.icuBeds <= 0) {
            eligible = false;
            ineligibleReason = "Patient requires ICU, but zero ICU beds available";
        }

        let route: RouteResult | undefined = undefined;
        let distanceKm = 0;
        let etaMinutes = 0;

        if (eligible) {
            const foundRoute = await findRouteAStar(patientNodeId, hosp.nodeId, graph);
            if (!foundRoute) {
                eligible = false;
                ineligibleReason = "Hospital unreachable from current patient location due to road blockades";
            } else {
                route = foundRoute;
                distanceKm = foundRoute.distanceKm;
                etaMinutes = foundRoute.etaMinutes;
            }
        }

        const hospSpecs = hosp.specialties.map((s) => s.toLowerCase());
        const specialtyMatched =
            normSpecialty === "general" ||
            hospSpecs.includes(normSpecialty) ||
            (hospSpecs.includes("trauma") && (normSpecialty === "burns" || normSpecialty === "neuro"));

        const normalizedEta = Math.min(1.0, etaMinutes / 30.0);
        const specialtyMismatch = specialtyMatched ? 0.0 : 1.0;
        const bedAvailabilityPenalty = Math.max(0.0, 1.0 - Math.min(1.0, hosp.availableBeds / 50.0));
        const traumaLevelPenalty = Math.min(1.0, Math.max(0.0, (hosp.traumaLevel - 1) / 2.0));

        const etaScore = weights.eta * normalizedEta;
        const specialtyScore = weights.specialty * specialtyMismatch;
        const bedScore = weights.beds * bedAvailabilityPenalty;
        const traumaScore = weights.trauma * traumaLevelPenalty;

        const totalScore = parseFloat((etaScore + specialtyScore + bedScore + traumaScore).toFixed(4));

        const scoreBreakdown: HospitalScoreBreakdown = {
            normalizedEta: parseFloat(normalizedEta.toFixed(3)),
            etaWeight: weights.eta,
            etaScore: parseFloat(etaScore.toFixed(3)),

            specialtyMismatch,
            specialtyWeight: weights.specialty,
            specialtyScore: parseFloat(specialtyScore.toFixed(3)),

            bedAvailabilityPenalty: parseFloat(bedAvailabilityPenalty.toFixed(3)),
            bedWeight: weights.beds,
            bedScore: parseFloat(bedScore.toFixed(3)),

            traumaLevelPenalty: parseFloat(traumaLevelPenalty.toFixed(3)),
            traumaWeight: weights.trauma,
            traumaScore: parseFloat(traumaScore.toFixed(3)),

            totalScore,
        };

        candidates.push({
            hospitalId: hosp.id,
            name: hosp.name,
            nodeId: hosp.nodeId,
            specialties: hosp.specialties,
            totalBeds: hosp.totalBeds,
            availableBeds: hosp.availableBeds,
            icuBeds: hosp.icuBeds,
            emergencyOpen: hosp.emergencyOpen,
            traumaLevel: hosp.traumaLevel,
            eligible,
            ineligibleReason,
            distanceKm,
            etaMinutes,
            specialtyMatched,
            scoreBreakdown,
            isWinner: false,
            recommendationReason: "",
            route,
        });
    }

    const eligibleCandidates = candidates.filter((c) => c.eligible);

    if (eligibleCandidates.length === 0) {
        throw new Error("No eligible hospitals currently available for admission (all either closed, full, or unreachable)");
    }

    eligibleCandidates.sort((a, b) => a.scoreBreakdown.totalScore - b.scoreBreakdown.totalScore);

    const winner = eligibleCandidates[0];
    if (!winner) {
        throw new Error("Failed to pick winning hospital candidate");
    }

    winner.isWinner = true;
    winner.recommendationReason = `Top recommendation: Score ${winner.scoreBreakdown.totalScore.toFixed(2)} (ETA ${winner.etaMinutes} min, ${winner.availableBeds} beds available, ${winner.specialtyMatched ? "specialty matched" : "general emergency"}, Trauma L${winner.traumaLevel}).`;

    candidates.sort((a, b) => {
        if (a.eligible && !b.eligible) return -1;
        if (!a.eligible && b.eligible) return 1;
        return a.scoreBreakdown.totalScore - b.scoreBreakdown.totalScore;
    });

    return {
        winner,
        rankedList: candidates,
        weightsUsed: weights,
    };
}
