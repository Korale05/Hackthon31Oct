import { prisma } from "../DB/prisma.js";

// Haversine formula to compute great-circle distance between two GPS coordinates in kilometers
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's mean radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return parseFloat((R * c).toFixed(2));
}

export interface GraphNode {
    id: string;
    name: string;
    lat: number;
    lng: number;
}

export interface GraphEdge {
    id: string;
    fromNodeId: string;
    toNodeId: string;
    distanceKm: number;
    baseSpeedKmh: number;
    trafficFactor: number;
    isBlocked: boolean;
    costMinutes: number; // Computed traversal cost in minutes
}

export interface RoadGraph {
    nodes: Map<string, GraphNode>;
    adjacencyList: Map<string, GraphEdge[]>;
    maxSpeedKmh: number;
}

let cachedGraph: RoadGraph | null = null;
let lastLoadTime = 0;
const CACHE_TTL_MS = 1000; // Cache for 1s to optimize bulk path queries while keeping live updates snappy

/**
 * Loads the road graph from PostgreSQL into an in-memory adjacency list.
 * Edge cost (minutes) = (distanceKm / (baseSpeedKmh / trafficFactor)) * 60.
 * Blocked edges (isBlocked = true) are excluded from the adjacency list.
 */
export async function getRoadGraph(forceRefresh = false): Promise<RoadGraph> {
    const now = Date.now();
    if (!forceRefresh && cachedGraph && now - lastLoadTime < CACHE_TTL_MS) {
        return cachedGraph;
    }

    const [dbNodes, dbEdges] = await Promise.all([
        prisma.roadNode.findMany(),
        prisma.roadEdge.findMany(),
    ]);

    const nodes = new Map<string, GraphNode>();
    for (const n of dbNodes) {
        nodes.set(n.id, {
            id: n.id,
            name: n.name,
            lat: n.lat,
            lng: n.lng,
        });
    }

    const adjacencyList = new Map<string, GraphEdge[]>();
    for (const n of dbNodes) {
        adjacencyList.set(n.id, []);
    }

    let maxSpeed = 40; // Default baseline

    for (const edge of dbEdges) {
        if (edge.baseSpeedKmh > maxSpeed) {
            maxSpeed = edge.baseSpeedKmh;
        }

        // Exclude blocked edges from reachable graph
        if (edge.isBlocked) {
            continue;
        }

        // Effective speed accounts for traffic slowdowns
        const effectiveSpeed = Math.max(5, edge.baseSpeedKmh / Math.max(0.1, edge.trafficFactor));
        const costMinutes = (edge.distanceKm / effectiveSpeed) * 60;

        const graphEdge: GraphEdge = {
            id: edge.id,
            fromNodeId: edge.fromNodeId,
            toNodeId: edge.toNodeId,
            distanceKm: edge.distanceKm,
            baseSpeedKmh: edge.baseSpeedKmh,
            trafficFactor: edge.trafficFactor,
            isBlocked: edge.isBlocked,
            costMinutes,
        };

        const existing = adjacencyList.get(edge.fromNodeId);
        if (existing) {
            existing.push(graphEdge);
        } else {
            adjacencyList.set(edge.fromNodeId, [graphEdge]);
        }
    }

    cachedGraph = {
        nodes,
        adjacencyList,
        maxSpeedKmh: maxSpeed,
    };
    lastLoadTime = now;

    return cachedGraph;
}

/**
 * Invalidate graph cache when roads are blocked or traffic factors are updated.
 */
export function invalidateGraphCache(): void {
    cachedGraph = null;
    lastLoadTime = 0;
}

/**
 * Snaps any arbitrary latitude/longitude to the nearest RoadNode in the road network.
 */
export async function findNearestNode(lat: number, lng: number): Promise<GraphNode> {
    const graph = await getRoadGraph();
    let nearestNode: GraphNode | null = null;
    let minDistance = Infinity;

    for (const node of graph.nodes.values()) {
        const d = haversineKm(lat, lng, node.lat, node.lng);
        if (d < minDistance) {
            minDistance = d;
            nearestNode = node;
        }
    }

    if (!nearestNode) {
        throw new Error("No road nodes found in database");
    }

    return nearestNode;
}

