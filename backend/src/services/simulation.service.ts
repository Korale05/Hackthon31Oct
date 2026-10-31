import { prisma } from "../DB/prisma.js";
import { getRoadGraph, haversineKm } from "./graph.service.js";
import { runDatabaseSeed } from "./seed.service.js";

/**
 * Advances the simulation by 1 step.
 * timeCompressionFactor = 10 (1 real second = 10 simulation seconds).
 */
export async function simulationTick(timeCompressionFactor = 10): Promise<{
    activeCount: number;
    updatedAmbulances: Array<{ code: string; status: string; lat: number; lng: number }>;
}> {
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

    if (activeEmergencies.length === 0) {
        return { activeCount: 0, updatedAmbulances: [] };
    }

    const graph = await getRoadGraph();
    const updatedAmbulances: Array<{ code: string; status: string; lat: number; lng: number }> = [];

    for (const emergency of activeEmergencies) {
        const amb = emergency.ambulance;
        const activeLeg = emergency.routeLegs[0];
        if (!amb || !activeLeg) continue;

        const pathNodeIds = (activeLeg.pathNodeIds as string[]) || [];
        if (pathNodeIds.length === 0) continue;

        const routeCoords: Array<{ id: string; lat: number; lng: number }> = [];
        for (const nodeId of pathNodeIds) {
            const n = graph.nodes.get(nodeId);
            if (n) {
                routeCoords.push({ id: n.id, lat: n.lat, lng: n.lng });
            }
        }
        if (routeCoords.length === 0) continue;

        // Baseline speed ~50 km/h with 10x compression = ~0.138 km per 1-second tick
        const speedKmh = 50;
        const distanceToMoveKm = (speedKmh / 3600) * timeCompressionFactor;

        // Find current position index along path
        let fromIdx = pathNodeIds.indexOf(amb.currentNodeId);
        if (fromIdx < 0) {
            let closestIdx = 0;
            let closestDist = Infinity;
            for (let i = 0; i < routeCoords.length; i++) {
                const pt = routeCoords[i];
                if (!pt) continue;
                const d = haversineKm(amb.lat, amb.lng, pt.lat, pt.lng);
                if (d < closestDist) {
                    closestDist = d;
                    closestIdx = i;
                }
            }
            fromIdx = closestIdx;
        }

        const targetIdx = fromIdx + 1;

        if (targetIdx >= routeCoords.length) {
            // Already at target end of this leg
            continue;
        }

        const targetPt = routeCoords[targetIdx];
        if (!targetPt) continue;

        const distToTarget = haversineKm(amb.lat, amb.lng, targetPt.lat, targetPt.lng);

        if (distToTarget <= distanceToMoveKm) {
            // Arrived at target node
            const isDestination = targetIdx === routeCoords.length - 1;

            if (isDestination) {
                if (emergency.status === "EN_ROUTE_TO_PATIENT") {
                    // REACHED PATIENT: Set ambulance & emergency to AT_PATIENT
                    // Stop and wait for user to click "Confirm Pickup"
                    await prisma.ambulance.update({
                        where: { id: amb.id },
                        data: {
                            status: "AT_PATIENT",
                            currentNodeId: targetPt.id,
                            lat: targetPt.lat,
                            lng: targetPt.lng,
                        },
                    });

                    await prisma.emergency.update({
                        where: { id: emergency.id },
                        data: { status: "AT_PATIENT" },
                    });

                    await prisma.journeyEvent.create({
                        data: {
                            emergencyId: emergency.id,
                            type: "AT_PATIENT",
                            message: `Ambulance ${amb.code} arrived at patient location. Ready for on-scene stabilization & pickup confirmation.`,
                        },
                    });

                    updatedAmbulances.push({
                        code: amb.code,
                        status: "AT_PATIENT",
                        lat: targetPt.lat,
                        lng: targetPt.lng,
                    });
                } else if (emergency.status === "EN_ROUTE_TO_HOSPITAL") {
                    // REACHED HOSPITAL: Complete mission & free ambulance
                    await prisma.ambulance.update({
                        where: { id: amb.id },
                        data: {
                            status: "AVAILABLE",
                            currentNodeId: targetPt.id,
                            lat: targetPt.lat,
                            lng: targetPt.lng,
                        },
                    });

                    await prisma.emergency.update({
                        where: { id: emergency.id },
                        data: {
                            status: "COMPLETED",
                            completedAt: new Date(),
                        },
                    });

                    if (emergency.hospitalId) {
                        const hosp = await prisma.hospital.findUnique({ where: { id: emergency.hospitalId } });
                        if (hosp && hosp.availableBeds > 0) {
                            await prisma.hospital.update({
                                where: { id: emergency.hospitalId },
                                data: { availableBeds: { decrement: 1 } },
                            }).catch(() => {});
                        }
                    }

                    await prisma.journeyEvent.create({
                        data: {
                            emergencyId: emergency.id,
                            type: "COMPLETED",
                            message: `Ambulance ${amb.code} arrived at ${emergency.hospital?.name || "Hospital"}. Patient admitted. Mission completed.`,
                        },
                    });

                    updatedAmbulances.push({
                        code: amb.code,
                        status: "AVAILABLE",
                        lat: targetPt.lat,
                        lng: targetPt.lng,
                    });
                }
            } else {
                // Advance to next intermediate waypoint
                await prisma.ambulance.update({
                    where: { id: amb.id },
                    data: {
                        currentNodeId: targetPt.id,
                        lat: targetPt.lat,
                        lng: targetPt.lng,
                    },
                });

                updatedAmbulances.push({
                    code: amb.code,
                    status: amb.status,
                    lat: targetPt.lat,
                    lng: targetPt.lng,
                });
            }
        } else {
            // Move fractionally along straight line to targetPt
            const ratio = Math.min(1.0, distanceToMoveKm / Math.max(0.001, distToTarget));
            const newLat = parseFloat((amb.lat + (targetPt.lat - amb.lat) * ratio).toFixed(6));
            const newLng = parseFloat((amb.lng + (targetPt.lng - amb.lng) * ratio).toFixed(6));

            await prisma.ambulance.update({
                where: { id: amb.id },
                data: {
                    lat: newLat,
                    lng: newLng,
                },
            });

            updatedAmbulances.push({
                code: amb.code,
                status: amb.status,
                lat: newLat,
                lng: newLng,
            });
        }
    }

    return {
        activeCount: activeEmergencies.length,
        updatedAmbulances,
    };
}

let simulationTimer: NodeJS.Timeout | null = null;

export function startSimulationLoop(): void {
    if (simulationTimer) return;
    simulationTimer = setInterval(async () => {
        try {
            await simulationTick(10);
        } catch (err) {
            // Silently ignore tick errors so simulation runs robustly
        }
    }, 1000);
}

export function stopSimulationLoop(): void {
    if (simulationTimer) {
        clearInterval(simulationTimer);
        simulationTimer = null;
    }
}

export async function resetSimulationToSeed(): Promise<void> {
    await runDatabaseSeed();
}
