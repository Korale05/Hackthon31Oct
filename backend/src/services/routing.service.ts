import { getRoadGraph, haversineKm, type RoadGraph } from "./graph.service.js";

export interface RouteCoordinate {
    lat: number;
    lng: number;
    name: string;
}

export interface RouteResult {
    path: string[];
    coordinates: RouteCoordinate[];
    distanceKm: number;
    etaMinutes: number;
    nodesExplored: number;
    algorithm: "A_STAR" | "DIJKSTRA";
}

interface HeapItem<T> {
    element: T;
    priority: number;
}

class PriorityQueue<T> {
    private heap: HeapItem<T>[] = [];

    push(element: T, priority: number): void {
        this.heap.push({ element, priority });
        this.bubbleUp(this.heap.length - 1);
    }

    pop(): T | undefined {
        if (this.heap.length === 0) return undefined;
        const first = this.heap[0];
        const bottom = this.heap.pop();
        if (first && bottom && this.heap.length > 0) {
            this.heap[0] = bottom;
            this.bubbleDown(0);
        }
        return first ? first.element : undefined;
    }

    isEmpty(): boolean {
        return this.heap.length === 0;
    }

    private bubbleUp(index: number): void {
        while (index > 0) {
            const parentIndex = Math.floor((index - 1) / 2);
            const parent = this.heap[parentIndex];
            const current = this.heap[index];
            if (!parent || !current || parent.priority <= current.priority) break;
            this.heap[index] = parent;
            this.heap[parentIndex] = current;
            index = parentIndex;
        }
    }

    private bubbleDown(index: number): void {
        const length = this.heap.length;
        while (true) {
            const leftChild = 2 * index + 1;
            const rightChild = 2 * index + 2;
            let smallest = index;

            const smallestItem = this.heap[smallest];
            const leftItem = leftChild < length ? this.heap[leftChild] : undefined;
            const rightItem = rightChild < length ? this.heap[rightChild] : undefined;

            if (smallestItem && leftItem && leftItem.priority < smallestItem.priority) {
                smallest = leftChild;
            }

            const currentSmallest = this.heap[smallest];
            if (currentSmallest && rightItem && rightItem.priority < currentSmallest.priority) {
                smallest = rightChild;
            }

            if (smallest === index) break;

            const temp = this.heap[index];
            const target = this.heap[smallest];
            if (temp && target) {
                this.heap[index] = target;
                this.heap[smallest] = temp;
            }
            index = smallest;
        }
    }
}

function reconstructRoute(
    goalNodeId: string,
    cameFrom: Map<string, { parent: string; distance: number; cost: number }>,
    graph: RoadGraph,
    nodesExplored: number,
    algorithm: "A_STAR" | "DIJKSTRA"
): RouteResult {
    const path: string[] = [];
    const coordinates: RouteCoordinate[] = [];
    let curr: string | undefined = goalNodeId;
    let totalDistanceKm = 0;
    let totalEtaMinutes = 0;

    while (curr) {
        path.unshift(curr);
        const node = graph.nodes.get(curr);
        if (node) {
            coordinates.unshift({ lat: node.lat, lng: node.lng, name: node.name });
        }
        const edgeInfo = cameFrom.get(curr);
        if (edgeInfo) {
            totalDistanceKm += edgeInfo.distance;
            totalEtaMinutes += edgeInfo.cost;
            curr = edgeInfo.parent;
        } else {
            curr = undefined;
        }
    }

    return {
        path,
        coordinates,
        distanceKm: parseFloat(totalDistanceKm.toFixed(2)),
        etaMinutes: parseFloat(totalEtaMinutes.toFixed(2)),
        nodesExplored,
        algorithm,
    };
}

export async function findRouteAStar(
    startNodeId: string,
    goalNodeId: string,
    customGraph?: RoadGraph
): Promise<RouteResult | null> {
    const graph = customGraph || (await getRoadGraph());

    const startNode = graph.nodes.get(startNodeId);
    const goalNode = graph.nodes.get(goalNodeId);

    if (!startNode || !goalNode) {
        return null;
    }

    if (startNodeId === goalNodeId) {
        return {
            path: [startNodeId],
            coordinates: [{ lat: startNode.lat, lng: startNode.lng, name: startNode.name }],
            distanceKm: 0,
            etaMinutes: 0,
            nodesExplored: 1,
            algorithm: "A_STAR",
        };
    }

    const maxSpeed = graph.maxSpeedKmh || 60;
    const heuristic = (nodeId: string): number => {
        const n = graph.nodes.get(nodeId);
        if (!n) return 0;
        const dist = haversineKm(n.lat, n.lng, goalNode.lat, goalNode.lng);
        return (dist / maxSpeed) * 60;
    };

    const gScore = new Map<string, number>();
    const cameFrom = new Map<string, { parent: string; distance: number; cost: number }>();
    const openSet = new PriorityQueue<string>();
    const closedSet = new Set<string>();

    gScore.set(startNodeId, 0);
    openSet.push(startNodeId, heuristic(startNodeId));

    let nodesExplored = 0;

    while (!openSet.isEmpty()) {
        const current = openSet.pop();
        if (!current) break;
        if (closedSet.has(current)) continue;
        closedSet.add(current);
        nodesExplored++;

        if (current === goalNodeId) {
            return reconstructRoute(goalNodeId, cameFrom, graph, nodesExplored, "A_STAR");
        }

        const neighbors = graph.adjacencyList.get(current) || [];
        const currentG = gScore.get(current) ?? Infinity;

        for (const edge of neighbors) {
            if (closedSet.has(edge.toNodeId)) continue;

            const tentativeG = currentG + edge.costMinutes;
            const existingG = gScore.get(edge.toNodeId) ?? Infinity;

            if (tentativeG < existingG) {
                gScore.set(edge.toNodeId, tentativeG);
                cameFrom.set(edge.toNodeId, {
                    parent: current,
                    distance: edge.distanceKm,
                    cost: edge.costMinutes,
                });
                const fScore = tentativeG + heuristic(edge.toNodeId);
                openSet.push(edge.toNodeId, fScore);
            }
        }
    }

    return null;
}

export async function findRouteDijkstra(
    startNodeId: string,
    goalNodeId: string,
    customGraph?: RoadGraph
): Promise<RouteResult | null> {
    const graph = customGraph || (await getRoadGraph());

    const startNode = graph.nodes.get(startNodeId);
    const goalNode = graph.nodes.get(goalNodeId);

    if (!startNode || !goalNode) {
        return null;
    }

    if (startNodeId === goalNodeId) {
        return {
            path: [startNodeId],
            coordinates: [{ lat: startNode.lat, lng: startNode.lng, name: startNode.name }],
            distanceKm: 0,
            etaMinutes: 0,
            nodesExplored: 1,
            algorithm: "DIJKSTRA",
        };
    }

    const dist = new Map<string, number>();
    const cameFrom = new Map<string, { parent: string; distance: number; cost: number }>();
    const pq = new PriorityQueue<string>();
    const visited = new Set<string>();

    dist.set(startNodeId, 0);
    pq.push(startNodeId, 0);

    let nodesExplored = 0;

    while (!pq.isEmpty()) {
        const current = pq.pop();
        if (!current) break;
        if (visited.has(current)) continue;
        visited.add(current);
        nodesExplored++;

        if (current === goalNodeId) {
            return reconstructRoute(goalNodeId, cameFrom, graph, nodesExplored, "DIJKSTRA");
        }

        const neighbors = graph.adjacencyList.get(current) || [];
        const currentDist = dist.get(current) ?? Infinity;

        for (const edge of neighbors) {
            if (visited.has(edge.toNodeId)) continue;

            const newDist = currentDist + edge.costMinutes;
            const existingDist = dist.get(edge.toNodeId) ?? Infinity;

            if (newDist < existingDist) {
                dist.set(edge.toNodeId, newDist);
                cameFrom.set(edge.toNodeId, {
                    parent: current,
                    distance: edge.distanceKm,
                    cost: edge.costMinutes,
                });
                pq.push(edge.toNodeId, newDist);
            }
        }
    }

    return null;
}
