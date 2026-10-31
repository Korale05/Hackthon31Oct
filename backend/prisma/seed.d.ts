import "dotenv/config";
export declare const SOLAPUR_NODES: {
    id: string;
    name: string;
    lat: number;
    lng: number;
}[];
export declare const AMBULANCE_STATIONS: {
    id: string;
    name: string;
    lat: number;
    lng: number;
    nodeId: string;
}[];
export declare const AMBULANCES: {
    id: string;
    code: string;
    type: string;
    status: string;
    currentNodeId: string;
    lat: number;
    lng: number;
    stationId: string;
}[];
export declare const HOSPITALS: {
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
}[];
export declare function main(): Promise<void>;
//# sourceMappingURL=seed.d.ts.map