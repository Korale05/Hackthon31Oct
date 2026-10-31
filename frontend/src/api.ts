import axios from "axios";
import type { MapGraphData, Emergency } from "./types.js";

const API_BASE = import.meta.env.VITE_API_URL || "/api";

export const apiClient = axios.create({
    baseURL: API_BASE,
    withCredentials: true,
    headers: {
        "Content-Type": "application/json",
    },
});

export async function fetchMapGraph(): Promise<MapGraphData> {
    const res = await apiClient.get("/map/graph");
    return res.data.data;
}

export async function fetchEmergencies(): Promise<Emergency[]> {
    const res = await apiClient.get("/emergencies");
    return res.data.data;
}

export async function fetchEmergencyById(id: string): Promise<{
    emergency: Emergency;
    hospitalRecommendations?: {
        winner: any;
        rankedList: any[];
    };
}> {
    const res = await apiClient.get(`/emergencies/${id}`);
    return res.data.data;
}

export async function createEmergency(payload: {
    callerName: string;
    phone: string;
    description: string;
    lat: number;
    lng: number;
    symptoms?: string[];
}): Promise<any> {
    const res = await apiClient.post("/emergencies", payload);
    return res.data.data;
}

export async function confirmPickup(emergencyId: string): Promise<any> {
    const res = await apiClient.post(`/emergencies/${emergencyId}/confirm-pickup`);
    return res.data.data;
}

export async function completeEmergency(emergencyId: string): Promise<any> {
    const res = await apiClient.post(`/emergencies/${emergencyId}/complete`);
    return res.data.data;
}

export async function cancelEmergency(emergencyId: string): Promise<any> {
    const res = await apiClient.post(`/emergencies/${emergencyId}/cancel`);
    return res.data.data;
}

export async function blockRoad(edgeId: string, blocked: boolean): Promise<any> {
    const res = await apiClient.patch(`/roads/${edgeId}/block`, { blocked });
    return res.data.data;
}

export async function setRoadTraffic(edgeId: string, trafficFactor: number): Promise<any> {
    const res = await apiClient.patch(`/roads/${edgeId}/traffic`, { trafficFactor });
    return res.data.data;
}

export async function updateAmbulanceStatus(id: string, status: string): Promise<any> {
    const res = await apiClient.patch(`/ambulances/${id}/status`, { status });
    return res.data.data;
}

export async function updateHospital(
    id: string,
    data: { availableBeds?: number; emergencyOpen?: boolean; icuBeds?: number }
): Promise<any> {
    const res = await apiClient.patch(`/hospitals/${id}`, data);
    return res.data.data;
}

export async function triggerSimulationTick(): Promise<any> {
    const res = await apiClient.post("/simulation/tick", { timeCompressionFactor: 10 });
    return res.data.data;
}

export async function resetSimulation(): Promise<any> {
    const res = await apiClient.post("/simulation/reset");
    return res.data;
}

