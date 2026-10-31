import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { prisma } from "../DB/prisma.js";
import { ApiResponse } from "../utils/apiResponce.js";
import { ApiError } from "../utils/apiError.js";
import { triageEmergency } from "../services/triage.service.js";
import { findNearestNode } from "../services/graph.service.js";
import { selectOptimalAmbulance } from "../services/ambulance-selection.service.js";
import { recommendOptimalHospital } from "../services/hospital-recommendation.service.js";

const CreateEmergencySchema = z.object({
    callerName: z.string().min(2, "Caller name is required"),
    phone: z.string().min(7, "Valid phone number is required"),
    description: z.string().min(5, "Emergency description must be at least 5 characters"),
    lat: z.number().min(17.0).max(18.5, "Latitude must be within the Solapur region (approx 17.65)"),
    lng: z.number().min(75.0).max(76.5, "Longitude must be within the Solapur region (approx 75.90)"),
    symptoms: z.array(z.string()).optional(),
});

export async function createEmergency(req: Request, res: Response, next: NextFunction) {
    try {
        const parsed = CreateEmergencySchema.parse(req.body);

        // 1. Run AI Triage (with mandatory 3s fallback to rule engine)
        const triage = await triageEmergency({
            description: parsed.description,
            symptoms: parsed.symptoms,
        });

        // 2. Snap caller location to nearest RoadNode
        const nearestNode = await findNearestNode(parsed.lat, parsed.lng);

        // 3. Auto-assign the optimal available ambulance with race-condition prevention
        let selection = await selectOptimalAmbulance({
            patientNodeId: nearestNode.id,
            severity: triage.severity,
            category: triage.category,
        });

        let winner = selection.winner;

        // Atomic reservation: update status only if currently AVAILABLE
        let updateResult = await prisma.ambulance.updateMany({
            where: {
                id: winner.ambulanceId,
                status: "AVAILABLE",
            },
            data: { status: "EN_ROUTE_TO_PATIENT" },
        });

        // If the winner was claimed by a concurrent request, re-select
        if (updateResult.count === 0) {
            selection = await selectOptimalAmbulance({
                patientNodeId: nearestNode.id,
                severity: triage.severity,
                category: triage.category,
            });
            winner = selection.winner;
            await prisma.ambulance.update({
                where: { id: winner.ambulanceId },
                data: { status: "EN_ROUTE_TO_PATIENT" },
            });
        }

        // 4. Create Emergency record in database
        const emergency = await prisma.emergency.create({
            data: {
                callerName: parsed.callerName,
                phone: parsed.phone,
                description: parsed.description,
                lat: parsed.lat,
                lng: parsed.lng,
                nearestNodeId: nearestNode.id,
                category: triage.category,
                severity: triage.severity,
                requiredSpecialty: triage.requiredSpecialty,
                aiReasoning: triage.reasoning,
                aiSource: triage.aiSource,
                status: "EN_ROUTE_TO_PATIENT",
                ambulanceId: winner.ambulanceId,
            },
        });

        // 5. Record Stage 1 RouteLeg (TO_PATIENT)
        const leg = await prisma.routeLeg.create({
            data: {
                emergencyId: emergency.id,
                stage: "TO_PATIENT",
                pathNodeIds: winner.route.path,
                distanceKm: winner.route.distanceKm,
                etaMinutes: winner.route.etaMinutes,
                algorithm: "A_STAR",
                version: 1,
                isActive: true,
                reason: "Initial optimal dispatch to patient scene",
            },
        });

        // 6. Write audit JourneyEvents
        await prisma.journeyEvent.create({
            data: {
                emergencyId: emergency.id,
                type: "CREATED",
                message: `Emergency reported by ${parsed.callerName}. Location snapped to ${nearestNode.name}.`,
            },
        });

        await prisma.journeyEvent.create({
            data: {
                emergencyId: emergency.id,
                type: "TRIAGE",
                message: `Triage Classification (${triage.aiSource === "LLM" ? "AI Model" : "Rule Engine"}): ${triage.category}, Severity Level ${triage.severity}/5. ${triage.reasoning}`,
            },
        });

        await prisma.journeyEvent.create({
            data: {
                emergencyId: emergency.id,
                type: "ASSIGNED",
                message: `Assigned ambulance ${winner.code} (${winner.type}) from ${winner.stationName}. ETA: ${winner.effectiveEtaMinutes} min (${winner.distanceKm} km).`,
            },
        });

        return res.status(201).json(
            new ApiResponse(
                201,
                {
                    emergency,
                    triage,
                    winnerAmbulance: winner,
                    rankedAmbulances: selection.rankedList,
                    activeLeg: leg,
                },
                "Emergency created and ambulance dispatched successfully!"
            )
        );
    } catch (err) {
        next(err);
    }
}

export async function listEmergencies(req: Request, res: Response, next: NextFunction) {
    try {
        const emergencies = await prisma.emergency.findMany({
            orderBy: { createdAt: "desc" },
            include: {
                ambulance: {
                    include: { station: true },
                },
                hospital: true,
                routeLegs: {
                    where: { isActive: true },
                },
                journeyEvents: {
                    orderBy: { createdAt: "desc" },
                    take: 1,
                },
            },
            take: 50,
        });

        return res.status(200).json(
            new ApiResponse(200, emergencies, "Emergencies retrieved successfully")
        );
    } catch (err) {
        next(err);
    }
}

export async function getEmergencyById(req: Request, res: Response, next: NextFunction) {
    try {
        const id = req.params.id as string;

        const emergency = await prisma.emergency.findUnique({
            where: { id },
            include: {
                ambulance: {
                    include: { station: true },
                },
                hospital: true,
                routeLegs: {
                    orderBy: { version: "desc" },
                },
                journeyEvents: {
                    orderBy: { createdAt: "asc" },
                },
            },
        });

        if (!emergency) {
            throw new ApiError(404, "Emergency not found");
        }

        // Live hospital recommendations for UI display
        let hospitalRecommendations: unknown = null;
        if (
            emergency.status === "PICKUP_CONFIRMED" ||
            emergency.status === "EN_ROUTE_TO_HOSPITAL" ||
            emergency.status === "AT_PATIENT" ||
            emergency.status === "EN_ROUTE_TO_PATIENT"
        ) {
            try {
                hospitalRecommendations = await recommendOptimalHospital({
                    patientNodeId: emergency.nearestNodeId,
                    severity: emergency.severity,
                    requiredSpecialty: emergency.requiredSpecialty,
                    needsICU: emergency.severity >= 4,
                });
            } catch (err) {
                // Ignore preview recommendation errors if no hospital is eligible
            }
        }

        return res.status(200).json(
            new ApiResponse(
                200,
                {
                    emergency,
                    hospitalRecommendations,
                },
                "Emergency journey details retrieved"
            )
        );
    } catch (err) {
        next(err);
    }
}

export async function confirmPickup(req: Request, res: Response, next: NextFunction) {
    try {
        const id = req.params.id as string;

        const emergency = await prisma.emergency.findUnique({
            where: { id },
            include: { ambulance: true },
        });

        if (!emergency) {
            throw new ApiError(404, "Emergency not found");
        }

        // Allow pickup from EN_ROUTE_TO_PATIENT, AT_PATIENT, or AMBULANCE_ASSIGNED
        if (
            emergency.status !== "EN_ROUTE_TO_PATIENT" &&
            emergency.status !== "AMBULANCE_ASSIGNED" &&
            emergency.status !== "AT_PATIENT"
        ) {
            throw new ApiError(
                400,
                `Cannot confirm pickup from status '${emergency.status}'. Expected EN_ROUTE_TO_PATIENT, AT_PATIENT, or AMBULANCE_ASSIGNED.`
            );
        }

        // 1. Run multi-criteria hospital recommendation
        const hospitalRec = await recommendOptimalHospital({
            patientNodeId: emergency.nearestNodeId,
            severity: emergency.severity,
            requiredSpecialty: emergency.requiredSpecialty,
            needsICU: emergency.severity >= 4,
        });

        const targetHospital = hospitalRec.winner;
        if (!targetHospital.route) {
            throw new ApiError(500, "Recommended hospital route could not be calculated");
        }

        // 2. Deactivate previous route legs
        await prisma.routeLeg.updateMany({
            where: { emergencyId: id, isActive: true },
            data: { isActive: false },
        });

        // 3. Create Stage 2 RouteLeg (TO_HOSPITAL)
        const stage2Leg = await prisma.routeLeg.create({
            data: {
                emergencyId: id,
                stage: "TO_HOSPITAL",
                pathNodeIds: targetHospital.route.path,
                distanceKm: targetHospital.route.distanceKm,
                etaMinutes: targetHospital.route.etaMinutes,
                algorithm: "A_STAR",
                version: 1,
                isActive: true,
                reason: `Direct transit to recommended hospital (${targetHospital.name})`,
            },
        });

        // 4. Update emergency status
        const updatedEmergency = await prisma.emergency.update({
            where: { id },
            data: {
                status: "EN_ROUTE_TO_HOSPITAL",
                hospitalId: targetHospital.hospitalId,
                pickupAt: new Date(),
            },
            include: {
                hospital: true,
                ambulance: true,
            },
        });

        // 5. Update ambulance status and set current node to patient location
        if (emergency.ambulanceId) {
            await prisma.ambulance.update({
                where: { id: emergency.ambulanceId },
                data: {
                    status: "TRANSPORTING",
                    currentNodeId: emergency.nearestNodeId,
                },
            });
        }

        // 6. Write timeline events
        await prisma.journeyEvent.create({
            data: {
                emergencyId: id,
                type: "PICKUP_CONFIRMED",
                message: `Patient safely boarded. On-scene stabilization complete. Transit to hospital initiated.`,
            },
        });

        await prisma.journeyEvent.create({
            data: {
                emergencyId: id,
                type: "HOSPITAL_RECOMMENDED",
                message: `Recommended ${targetHospital.name}: Score ${targetHospital.scoreBreakdown.totalScore.toFixed(2)}, ETA ${targetHospital.etaMinutes} min, ${targetHospital.availableBeds} beds available.`,
            },
        });

        return res.status(200).json(
            new ApiResponse(
                200,
                {
                    emergency: updatedEmergency,
                    hospitalRecommendation: hospitalRec,
                    activeLeg: stage2Leg,
                },
                "Pickup confirmed. Ambulance en route to hospital."
            )
        );
    } catch (err) {
        next(err);
    }
}

export async function completeEmergency(req: Request, res: Response, next: NextFunction) {
    try {
        const id = req.params.id as string;

        const emergency = await prisma.emergency.findUnique({
            where: { id },
        });

        if (!emergency) {
            throw new ApiError(404, "Emergency not found");
        }

        // Guard against duplicate completion
        if (emergency.status === "COMPLETED") {
            return res.status(200).json(
                new ApiResponse(200, emergency, "Emergency is already marked as completed")
            );
        }

        const updated = await prisma.emergency.update({
            where: { id },
            data: {
                status: "COMPLETED",
                completedAt: new Date(),
            },
        });

        // Free ambulance to AVAILABLE
        if (emergency.ambulanceId) {
            await prisma.ambulance.update({
                where: { id: emergency.ambulanceId },
                data: { status: "AVAILABLE" },
            });
        }

        // Decrement hospital bed safely (without dropping below 0)
        if (emergency.hospitalId) {
            const hosp = await prisma.hospital.findUnique({ where: { id: emergency.hospitalId } });
            if (hosp && hosp.availableBeds > 0) {
                await prisma.hospital.update({
                    where: { id: emergency.hospitalId },
                    data: {
                        availableBeds: { decrement: 1 },
                    },
                }).catch(() => {});
            }
        }

        await prisma.journeyEvent.create({
            data: {
                emergencyId: id,
                type: "COMPLETED",
                message: "Patient admitted to emergency department. Emergency mission closed.",
            },
        });

        return res.status(200).json(
            new ApiResponse(200, updated, "Emergency marked as completed")
        );
    } catch (err) {
        next(err);
    }
}

export async function cancelEmergency(req: Request, res: Response, next: NextFunction) {
    try {
        const id = req.params.id as string;

        const emergency = await prisma.emergency.findUnique({
            where: { id },
        });

        if (!emergency) {
            throw new ApiError(404, "Emergency not found");
        }

        const updated = await prisma.emergency.update({
            where: { id },
            data: { status: "CANCELLED" },
        });

        if (emergency.ambulanceId) {
            await prisma.ambulance.update({
                where: { id: emergency.ambulanceId },
                data: { status: "AVAILABLE" },
            });
        }

        await prisma.journeyEvent.create({
            data: {
                emergencyId: id,
                type: "CANCELLED",
                message: "Emergency response cancelled by dispatch operator.",
            },
        });

        return res.status(200).json(
            new ApiResponse(200, updated, "Emergency cancelled")
        );
    } catch (err) {
        next(err);
    }
}
