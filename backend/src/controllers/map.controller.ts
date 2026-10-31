import type { Request, Response, NextFunction } from "express";
import { prisma } from "../DB/prisma.js";
import { ApiResponse } from "../utils/apiResponce.js";
import { ApiError } from "../utils/apiError.js";
import { handleRoadNetworkChange } from "../services/reroute.service.js";
import { simulationTick, resetSimulationToSeed } from "../services/simulation.service.js";

export async function getMapGraph(req: Request, res: Response, next: NextFunction) {
    try {
        const [nodes, edges, stations, hospitals, ambulances] = await Promise.all([
            prisma.roadNode.findMany(),
            prisma.roadEdge.findMany(),
            prisma.ambulanceStation.findMany(),
            prisma.hospital.findMany(),
            prisma.ambulance.findMany({
                include: { station: true },
            }),
        ]);

        return res.status(200).json(
            new ApiResponse(
                200,
                {
                    nodes,
                    edges,
                    stations,
                    hospitals,
                    ambulances,
                },
                "Map graph and fleet topology retrieved successfully"
            )
        );
    } catch (err) {
        next(err);
    }
}

export async function blockRoadEdge(req: Request, res: Response, next: NextFunction) {
    try {
        const edgeId = req.params.edgeId as string;
        const { blocked } = req.body;

        if (typeof blocked !== "boolean") {
            throw new ApiError(400, "Body must specify { blocked: boolean }");
        }

        const edge = await prisma.roadEdge.findUnique({
            where: { id: edgeId },
        });

        if (!edge) {
            throw new ApiError(404, "Road edge not found");
        }

        // Update target edge and its reverse bidirectional edge
        await prisma.roadEdge.updateMany({
            where: {
                OR: [
                    { id: edgeId },
                    { fromNodeId: edge.toNodeId, toNodeId: edge.fromNodeId },
                ],
            },
            data: { isBlocked: blocked },
        });

        // Trigger dynamic reroute service for all active emergencies
        const reroutes = await handleRoadNetworkChange({
            affectedEdgeId: edgeId,
            fromNodeId: edge.fromNodeId,
            toNodeId: edge.toNodeId,
            changeType: blocked ? "BLOCKED" : "UNBLOCKED",
            detailMessage: blocked
                ? `Road segment (${edge.fromNodeId} ↔ ${edge.toNodeId}) is now BLOCKED.`
                : `Road segment (${edge.fromNodeId} ↔ ${edge.toNodeId}) has been CLEARED.`,
        });

        return res.status(200).json(
            new ApiResponse(
                200,
                {
                    edgeId,
                    blocked,
                    reroutesTriggered: reroutes.length,
                    reroutes,
                },
                blocked
                    ? `Road blocked. Dynamic reroutes triggered for ${reroutes.length} active emergency journeys.`
                    : `Road unblocked. Network cache refreshed.`
            )
        );
    } catch (err) {
        next(err);
    }
}

export async function setRoadTraffic(req: Request, res: Response, next: NextFunction) {
    try {
        const edgeId = req.params.edgeId as string;
        const { trafficFactor } = req.body;

        const factor = Number(trafficFactor);
        if (isNaN(factor) || factor < 0.5 || factor > 10.0) {
            throw new ApiError(400, "trafficFactor must be a number between 0.5 and 10.0");
        }

        const edge = await prisma.roadEdge.findUnique({
            where: { id: edgeId },
        });

        if (!edge) {
            throw new ApiError(404, "Road edge not found");
        }

        // Update target edge and its reverse bidirectional edge
        await prisma.roadEdge.updateMany({
            where: {
                OR: [
                    { id: edgeId },
                    { fromNodeId: edge.toNodeId, toNodeId: edge.fromNodeId },
                ],
            },
            data: { trafficFactor: factor },
        });

        const reroutes = await handleRoadNetworkChange({
            affectedEdgeId: edgeId,
            fromNodeId: edge.fromNodeId,
            toNodeId: edge.toNodeId,
            changeType: "TRAFFIC_CHANGED",
            detailMessage: `Traffic slowdown factor updated to ${factor}x on road (${edge.fromNodeId} ↔ ${edge.toNodeId}).`,
        });

        return res.status(200).json(
            new ApiResponse(
                200,
                {
                    edgeId,
                    trafficFactor: factor,
                    reroutesTriggered: reroutes.length,
                    reroutes,
                },
                `Road traffic factor set to ${factor}x. Reroutes evaluated.`
            )
        );
    } catch (err) {
        next(err);
    }
}

export async function updateAmbulanceStatus(req: Request, res: Response, next: NextFunction) {
    try {
        const id = req.params.id as string;
        const { status } = req.body;

        const allowed = [
            "AVAILABLE",
            "ASSIGNED",
            "EN_ROUTE_TO_PATIENT",
            "AT_PATIENT",
            "TRANSPORTING",
            "COMPLETED",
            "OFFLINE",
        ];

        if (!allowed.includes(status)) {
            throw new ApiError(400, `Invalid ambulance status '${status}'. Must be one of: ${allowed.join(", ")}`);
        }

        const updated = await prisma.ambulance.update({
            where: { id },
            data: { status },
        });

        return res.status(200).json(
            new ApiResponse(200, updated, `Ambulance ${updated.code} status set to ${status}`)
        );
    } catch (err) {
        next(err);
    }
}

export async function updateHospital(req: Request, res: Response, next: NextFunction) {
    try {
        const id = req.params.id as string;
        const { availableBeds, emergencyOpen, icuBeds } = req.body;

        const updateData: {
            availableBeds?: number;
            emergencyOpen?: boolean;
            icuBeds?: number;
        } = {};

        if (typeof availableBeds === "number") updateData.availableBeds = availableBeds;
        if (typeof emergencyOpen === "boolean") updateData.emergencyOpen = emergencyOpen;
        if (typeof icuBeds === "number") updateData.icuBeds = icuBeds;

        const updated = await prisma.hospital.update({
            where: { id },
            data: updateData,
        });

        return res.status(200).json(
            new ApiResponse(200, updated, `Hospital ${updated.name} updated successfully`)
        );
    } catch (err) {
        next(err);
    }
}

export async function triggerSimulationTick(req: Request, res: Response, next: NextFunction) {
    try {
        const factor = Number(req.body?.timeCompressionFactor) || 10;
        const result = await simulationTick(factor);

        return res.status(200).json(
            new ApiResponse(200, result, "Simulation tick executed")
        );
    } catch (err) {
        next(err);
    }
}

export async function resetSimulation(req: Request, res: Response, next: NextFunction) {
    try {
        await resetSimulationToSeed();

        return res.status(200).json(
            new ApiResponse(200, null, "Simulation environment successfully reset to fresh Solapur seed state!")
        );
    } catch (err) {
        next(err);
    }
}

