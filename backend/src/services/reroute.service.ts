import { prisma } from "../DB/prisma.js";
import { findRouteAStar } from "./routing.service.js";
import { getRoadGraph, invalidateGraphCache, findNearestNode } from "./graph.service.js";
import { recommendOptimalHospital } from "./hospital-recommendation.service.js";

export interface RerouteEventSummary {
    emergencyId: string;
    oldEta: number;
    newEta: number;
    deltaMinutes: number;
    reason: string;
    newPath: string[];
    hospitalChanged: boolean;
    newHospitalName?: string | undefined;
}

export async function handleRoadNetworkChange(params: {
    affectedEdgeId?: string | undefined;
    fromNodeId?: string | undefined;
    toNodeId?: string | undefined;
    changeType: "BLOCKED" | "UNBLOCKED" | "TRAFFIC_CHANGED";
    detailMessage?: string | undefined;
}): Promise<RerouteEventSummary[]> {
    invalidateGraphCache();
    const updatedGraph = await getRoadGraph(true);

    const activeEmergencies = await prisma.emergency.findMany({
        where: {
            status: {
                in: ["EN_ROUTE_TO_PATIENT", "EN_ROUTE_TO_HOSPITAL"],
            },
        },
        include: {
            ambulance: true,
            hospital: true,
            routeLegs: {
                where: { isActive: true },
            },
        },
    });

    const affectedSummaries: RerouteEventSummary[] = [];

    for (const emergency of activeEmergencies) {
        const activeLeg = emergency.routeLegs[0];
        if (!activeLeg || !emergency.ambulance) continue;

        const currentPath = (activeLeg.pathNodeIds as string[]) || [];

        let usesAffectedEdge = false;
        if (params.fromNodeId && params.toNodeId) {
            for (let i = 0; i < currentPath.length - 1; i++) {
                const u = currentPath[i];
                const v = currentPath[i + 1];
                if (
                    (u === params.fromNodeId && v === params.toNodeId) ||
                    (u === params.toNodeId && v === params.fromNodeId)
                ) {
                    usesAffectedEdge = true;
                    break;
                }
            }
        } else {
            usesAffectedEdge = true;
        }

        if (!usesAffectedEdge && params.changeType !== "TRAFFIC_CHANGED") {
            continue;
        }

        // Snap ambulance's current live coordinate to nearest RoadNode for detour origin
        const nearestAmbulanceNode = await findNearestNode(emergency.ambulance.lat, emergency.ambulance.lng);
        const ambulanceStartNode = nearestAmbulanceNode.id;
        let goalNodeId: string;
        const stageName = activeLeg.stage;

        if (stageName === "TO_PATIENT") {
            goalNodeId = emergency.nearestNodeId;
        } else {
            if (!emergency.hospital) continue;
            goalNodeId = emergency.hospital.nodeId;
        }

        let newRoute = await findRouteAStar(ambulanceStartNode, goalNodeId, updatedGraph);
        let hospitalChanged = false;
        let newHospitalName: string | undefined = undefined;

        if (!newRoute && stageName === "TO_HOSPITAL") {
            try {
                const hospitalRec = await recommendOptimalHospital({
                    patientNodeId: ambulanceStartNode,
                    severity: emergency.severity,
                    requiredSpecialty: emergency.requiredSpecialty,
                    needsICU: emergency.severity >= 4,
                });

                if (hospitalRec.winner && hospitalRec.winner.route) {
                    newRoute = hospitalRec.winner.route;
                    hospitalChanged = true;
                    newHospitalName = hospitalRec.winner.name;

                    await prisma.emergency.update({
                        where: { id: emergency.id },
                        data: { hospitalId: hospitalRec.winner.hospitalId },
                    });

                    await prisma.journeyEvent.create({
                        data: {
                            emergencyId: emergency.id,
                            type: "HOSPITAL_REROUTED",
                            message: `Original hospital unreachable due to road blockage. Automatically diverted to ${hospitalRec.winner.name}.`,
                        },
                    });
                }
            } catch (err) {
                console.error("Failed to find alternative hospital during reroute:", err);
            }
        }

        if (!newRoute) {
            await prisma.journeyEvent.create({
                data: {
                    emergencyId: emergency.id,
                    type: "REROUTE_FAILED",
                    message: "Critical: Vehicle destination is currently blocked and unreachable via any available path.",
                },
            });
            continue;
        }

        const oldEta = activeLeg.etaMinutes;
        const newEta = newRoute.etaMinutes;
        const delta = parseFloat((newEta - oldEta).toFixed(1));
        const deltaFormatted = delta >= 0 ? `+${delta}` : `${delta}`;

        const reason =
            params.detailMessage ||
            (params.changeType === "BLOCKED"
                ? `Road ${params.fromNodeId}–${params.toNodeId} blocked. Dynamic detour calculated.`
                : `Traffic congestion updated on road network.`);

        await prisma.routeLeg.update({
            where: { id: activeLeg.id },
            data: { isActive: false },
        });

        await prisma.routeLeg.create({
            data: {
                emergencyId: emergency.id,
                stage: stageName,
                pathNodeIds: newRoute.path,
                distanceKm: newRoute.distanceKm,
                etaMinutes: newRoute.etaMinutes,
                algorithm: "A_STAR",
                version: activeLeg.version + 1,
                isActive: true,
                reason,
            },
        });

        const timelineMessage = `Route recalculated: ${reason} ETA ${oldEta.toFixed(1)} min → ${newEta.toFixed(1)} min (${deltaFormatted} min).`;

        await prisma.journeyEvent.create({
            data: {
                emergencyId: emergency.id,
                type: "REROUTE",
                message: timelineMessage,
            },
        });

        affectedSummaries.push({
            emergencyId: emergency.id,
            oldEta,
            newEta,
            deltaMinutes: delta,
            reason: timelineMessage,
            newPath: newRoute.path,
            hospitalChanged,
            newHospitalName,
        });
    }

    return affectedSummaries;
}
