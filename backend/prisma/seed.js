import "dotenv/config";
import { prisma } from "../src/DB/prisma.js";
// Haversine formula to compute great-circle distance between two GPS coordinates in kilometers
function haversineKm(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's mean radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return parseFloat((R * c).toFixed(2));
}
// 26 Strategic Road Nodes / Junctions in Solapur, Maharashtra, India
export const SOLAPUR_NODES = [
    { id: "node_01", name: "Solapur Railway Station", lat: 17.6715, lng: 75.9102 },
    { id: "node_02", name: "Old Pune Naka", lat: 17.6830, lng: 75.8920 },
    { id: "node_03", name: "New Pune Naka (NH-65)", lat: 17.6950, lng: 75.8750 },
    { id: "node_04", name: "Saat Rasta Junction", lat: 17.6680, lng: 75.9030 },
    { id: "node_05", name: "Siddheshwar Temple", lat: 17.6730, lng: 75.9060 },
    { id: "node_06", name: "Bhuikot Fort Circle", lat: 17.6695, lng: 75.9025 },
    { id: "node_07", name: "Ashok Chowk", lat: 17.6610, lng: 75.9180 },
    { id: "node_08", name: "Vijapur Naka (NH-52)", lat: 17.6520, lng: 75.8970 },
    { id: "node_09", name: "Hotgi Road Airport Chowk", lat: 17.6320, lng: 75.9320 },
    { id: "node_10", name: "Dufferin Chowk", lat: 17.6720, lng: 75.9150 },
    { id: "node_11", name: "Navi Peth Market", lat: 17.6700, lng: 75.9120 },
    { id: "node_12", name: "Kambar Talao", lat: 17.6580, lng: 75.8850 },
    { id: "node_13", name: "Jule Solapur Chowk", lat: 17.6410, lng: 75.8990 },
    { id: "node_14", name: "D-Mart Jule Solapur", lat: 17.6350, lng: 75.8950 },
    { id: "node_15", name: "MIDC Sambhaji Nagar Road", lat: 17.7120, lng: 75.9250 },
    { id: "node_16", name: "Akkalkot Naka", lat: 17.6540, lng: 75.9350 },
    { id: "node_17", name: "Hyderabad Road Naka (NH-65)", lat: 17.6750, lng: 75.9450 },
    { id: "node_18", name: "Civil Hospital Junction", lat: 17.6740, lng: 75.9190 },
    { id: "node_19", name: "Walchand College Chowk", lat: 17.6640, lng: 75.9230 },
    { id: "node_20", name: "Solapur University / Kegaon", lat: 17.7150, lng: 75.8450 },
    { id: "node_21", name: "Bhavani Peth", lat: 17.6650, lng: 75.9110 },
    { id: "node_22", name: "Modi Khana", lat: 17.6600, lng: 75.9050 },
    { id: "node_23", name: "Lashkar Camp", lat: 17.6760, lng: 75.8980 },
    { id: "node_24", name: "Majrewadi Cross", lat: 17.6250, lng: 75.9150 },
    { id: "node_25", name: "Nehru Nagar", lat: 17.6480, lng: 75.9120 },
    { id: "node_26", name: "Gandhi Nagar Bypass", lat: 17.6850, lng: 75.9200 },
];
// Undirected Road Connections with base speed (km/h) based on road hierarchy
const ROAD_CONNECTIONS = [
    // City core & Central Hubs
    ["node_01", "node_10", 35], // Station <-> Dufferin Chowk
    ["node_01", "node_11", 30], // Station <-> Navi Peth
    ["node_01", "node_05", 35], // Station <-> Siddheshwar Temple
    ["node_05", "node_06", 30], // Siddheshwar Temple <-> Bhuikot Fort
    ["node_06", "node_04", 40], // Fort <-> Saat Rasta
    ["node_04", "node_23", 45], // Saat Rasta <-> Lashkar
    ["node_23", "node_02", 50], // Lashkar <-> Old Pune Naka
    ["node_02", "node_03", 55], // Old Pune Naka <-> New Pune Naka
    ["node_03", "node_20", 60], // New Pune Naka <-> University (Highway)
    // Civil Hospital & East Links
    ["node_10", "node_18", 40], // Dufferin Chowk <-> Civil Hospital
    ["node_18", "node_26", 45], // Civil Hospital <-> Gandhi Nagar
    ["node_18", "node_17", 50], // Civil Hospital <-> Hyderabad Naka
    ["node_26", "node_15", 55], // Gandhi Nagar <-> MIDC Sambhaji Road
    ["node_10", "node_07", 35], // Dufferin Chowk <-> Ashok Chowk
    ["node_07", "node_19", 40], // Ashok Chowk <-> Walchand College
    ["node_19", "node_16", 45], // Walchand <-> Akkalkot Naka
    ["node_16", "node_17", 50], // Akkalkot Naka <-> Hyderabad Naka
    // South & Jule Solapur Arterials
    ["node_04", "node_22", 40], // Saat Rasta <-> Modi Khana
    ["node_22", "node_21", 35], // Modi Khana <-> Bhavani Peth
    ["node_21", "node_07", 35], // Bhavani Peth <-> Ashok Chowk
    ["node_04", "node_08", 45], // Saat Rasta <-> Vijapur Naka
    ["node_08", "node_12", 40], // Vijapur Naka <-> Kambar Talao
    ["node_08", "node_13", 50], // Vijapur Naka <-> Jule Solapur Chowk
    ["node_13", "node_14", 45], // Jule Solapur Chowk <-> D-Mart
    ["node_13", "node_25", 40], // Jule Solapur <-> Nehru Nagar
    ["node_25", "node_08", 40], // Nehru Nagar <-> Vijapur Naka
    ["node_25", "node_16", 45], // Nehru Nagar <-> Akkalkot Naka
    ["node_14", "node_24", 45], // D-Mart <-> Majrewadi Cross
    ["node_24", "node_09", 50], // Majrewadi <-> Airport Chowk
    ["node_09", "node_16", 50], // Airport Chowk <-> Akkalkot Naka
    // Ring & Cross Connections (Providing redundant alternative routes for rerouting)
    ["node_02", "node_12", 45], // Old Pune Naka <-> Kambar Talao
    ["node_02", "node_26", 50], // Old Pune Naka <-> Gandhi Nagar
    ["node_04", "node_01", 35], // Saat Rasta <-> Station
    ["node_11", "node_21", 30], // Navi Peth <-> Bhavani Peth
    ["node_07", "node_25", 40], // Ashok Chowk <-> Nehru Nagar
];
// 4 Ambulance Stations
export const AMBULANCE_STATIONS = [
    {
        id: "station_01",
        name: "Central Solapur EMS Depot (Saat Rasta)",
        lat: 17.6680,
        lng: 75.9030,
        nodeId: "node_04",
    },
    {
        id: "station_02",
        name: "North Corridor EMS Post (Old Pune Naka)",
        lat: 17.6830,
        lng: 75.8920,
        nodeId: "node_02",
    },
    {
        id: "station_03",
        name: "South Suburban EMS Station (Jule Solapur)",
        lat: 17.6410,
        lng: 75.8990,
        nodeId: "node_13",
    },
    {
        id: "station_04",
        name: "East Industrial EMS Unit (Akkalkot Naka)",
        lat: 17.6540,
        lng: 75.9350,
        nodeId: "node_16",
    },
];
// 10 Ambulances: 7 AVAILABLE, 3 busy/offline
export const AMBULANCES = [
    {
        id: "amb_01",
        code: "MH-13-EM-101",
        type: "BASIC",
        status: "AVAILABLE",
        currentNodeId: "node_04",
        lat: 17.6680,
        lng: 75.9030,
        stationId: "station_01",
    },
    {
        id: "amb_02",
        code: "MH-13-EM-102",
        type: "ADVANCED",
        status: "AVAILABLE",
        currentNodeId: "node_04",
        lat: 17.6680,
        lng: 75.9030,
        stationId: "station_01",
    },
    {
        id: "amb_03",
        code: "MH-13-EM-103",
        type: "ICU",
        status: "AVAILABLE",
        currentNodeId: "node_04",
        lat: 17.6680,
        lng: 75.9030,
        stationId: "station_01",
    },
    {
        id: "amb_04",
        code: "MH-13-EM-201",
        type: "BASIC",
        status: "AVAILABLE",
        currentNodeId: "node_02",
        lat: 17.6830,
        lng: 75.8920,
        stationId: "station_02",
    },
    {
        id: "amb_05",
        code: "MH-13-EM-202",
        type: "ADVANCED",
        status: "AVAILABLE",
        currentNodeId: "node_02",
        lat: 17.6830,
        lng: 75.8920,
        stationId: "station_02",
    },
    {
        id: "amb_06",
        code: "MH-13-EM-301",
        type: "BASIC",
        status: "AVAILABLE",
        currentNodeId: "node_13",
        lat: 17.6410,
        lng: 75.8990,
        stationId: "station_03",
    },
    {
        id: "amb_07",
        code: "MH-13-EM-302",
        type: "ICU",
        status: "AVAILABLE",
        currentNodeId: "node_13",
        lat: 17.6410,
        lng: 75.8990,
        stationId: "station_03",
    },
    {
        id: "amb_08",
        code: "MH-13-EM-401",
        type: "ADVANCED",
        status: "ASSIGNED",
        currentNodeId: "node_16",
        lat: 17.6540,
        lng: 75.9350,
        stationId: "station_04",
    },
    {
        id: "amb_09",
        code: "MH-13-EM-402",
        type: "BASIC",
        status: "TRANSPORTING",
        currentNodeId: "node_17",
        lat: 17.6750,
        lng: 75.9450,
        stationId: "station_04",
    },
    {
        id: "amb_10",
        code: "MH-13-EM-104",
        type: "ICU",
        status: "OFFLINE",
        currentNodeId: "node_04",
        lat: 17.6680,
        lng: 75.9030,
        stationId: "station_01",
    },
];
// 6 Hospitals (with varied specialties, beds, 1 full with 0 beds, 1 closed)
export const HOSPITALS = [
    {
        id: "hosp_01",
        name: "Dr. V.M. Govt Medical College & Civil Hospital",
        lat: 17.6740,
        lng: 75.9190,
        nodeId: "node_18",
        specialties: ["cardiac", "trauma", "neuro", "burns", "general", "maternity", "pediatric"],
        totalBeds: 250,
        availableBeds: 45,
        icuBeds: 12,
        emergencyOpen: true,
        traumaLevel: 1,
    },
    {
        id: "hosp_02",
        name: "Ashwini Sahakari Rugnalaya & Heart Centre",
        lat: 17.6680,
        lng: 75.9030,
        nodeId: "node_04",
        specialties: ["cardiac", "neuro", "trauma", "general"],
        totalBeds: 180,
        availableBeds: 28,
        icuBeds: 8,
        emergencyOpen: true,
        traumaLevel: 1,
    },
    {
        id: "hosp_03",
        name: "Markandey Memorial Hospital",
        lat: 17.6610,
        lng: 75.9180,
        nodeId: "node_07",
        specialties: ["pediatric", "maternity", "general", "respiratory"],
        totalBeds: 100,
        availableBeds: 15,
        icuBeds: 4,
        emergencyOpen: true,
        traumaLevel: 2,
    },
    {
        id: "hosp_04",
        name: "Solapur Neuro & Trauma Speciality Centre",
        lat: 17.6830,
        lng: 75.8920,
        nodeId: "node_02",
        specialties: ["neuro", "trauma", "burns"],
        totalBeds: 80,
        availableBeds: 10,
        icuBeds: 6,
        emergencyOpen: true,
        traumaLevel: 2,
    },
    {
        id: "hosp_05",
        name: "Lifecare Multi-Specialty Hospital (FULL - 0 Beds)",
        lat: 17.6350,
        lng: 75.8950,
        nodeId: "node_14",
        specialties: ["cardiac", "general", "trauma"],
        totalBeds: 60,
        availableBeds: 0, // 0 beds to show recommendation filtering
        icuBeds: 0,
        emergencyOpen: true,
        traumaLevel: 3,
    },
    {
        id: "hosp_06",
        name: "City Metro Emergency Clinic (CLOSED - Inactive)",
        lat: 17.6700,
        lng: 75.9120,
        nodeId: "node_11",
        specialties: ["general", "maternity"],
        totalBeds: 50,
        availableBeds: 20,
        icuBeds: 2,
        emergencyOpen: false, // emergencyOpen=false to show recommendation filtering
        traumaLevel: 3,
    },
];
export async function main() {
    console.log("🌱 Starting LifeLine Seed for Solapur, Maharashtra...");
    // 1. Clean existing records in correct relation order
    console.log("🧹 Clearing previous simulation data...");
    await prisma.journeyEvent.deleteMany({});
    await prisma.routeLeg.deleteMany({});
    await prisma.emergency.deleteMany({});
    await prisma.ambulance.deleteMany({});
    await prisma.ambulanceStation.deleteMany({});
    await prisma.hospital.deleteMany({});
    await prisma.roadEdge.deleteMany({});
    await prisma.roadNode.deleteMany({});
    // 2. Insert Road Nodes
    console.log(`📍 Inserting ${SOLAPUR_NODES.length} Road Nodes...`);
    for (const node of SOLAPUR_NODES) {
        await prisma.roadNode.create({
            data: node,
        });
    }
    // Map for fast lookup
    const nodeMap = new Map();
    for (const n of SOLAPUR_NODES) {
        nodeMap.set(n.id, n);
    }
    // 3. Insert Bidirectional Edges
    console.log(`🛣️ Generating bidirectional road edges from ${ROAD_CONNECTIONS.length} pairs...`);
    let edgeCount = 0;
    for (const [fromId, toId, baseSpeed] of ROAD_CONNECTIONS) {
        const fromNode = nodeMap.get(fromId);
        const toNode = nodeMap.get(toId);
        if (!fromNode || !toNode) {
            console.warn(`Node pair missing: ${fromId} -> ${toId}`);
            continue;
        }
        const distanceKm = haversineKm(fromNode.lat, fromNode.lng, toNode.lat, toNode.lng);
        // Direction 1: from -> to
        await prisma.roadEdge.create({
            data: {
                fromNodeId: fromId,
                toNodeId: toId,
                distanceKm,
                baseSpeedKmh: baseSpeed,
                trafficFactor: 1.0,
                isBlocked: false,
            },
        });
        edgeCount++;
        // Direction 2: to -> from
        await prisma.roadEdge.create({
            data: {
                fromNodeId: toId,
                toNodeId: fromId,
                distanceKm,
                baseSpeedKmh: baseSpeed,
                trafficFactor: 1.0,
                isBlocked: false,
            },
        });
        edgeCount++;
    }
    console.log(`✅ Created ${edgeCount} bidirectional road edges.`);
    // 4. Insert Ambulance Stations
    console.log(`🏥 Inserting ${AMBULANCE_STATIONS.length} Ambulance Stations...`);
    for (const station of AMBULANCE_STATIONS) {
        await prisma.ambulanceStation.create({
            data: station,
        });
    }
    // 5. Insert Ambulances
    console.log(`🚑 Inserting ${AMBULANCES.length} Ambulances...`);
    for (const amb of AMBULANCES) {
        await prisma.ambulance.create({
            data: amb,
        });
    }
    // 6. Insert Hospitals
    console.log(`🏨 Inserting ${HOSPITALS.length} Hospitals...`);
    for (const hosp of HOSPITALS) {
        await prisma.hospital.create({
            data: hosp,
        });
    }
    console.log("\n🎉 LifeLine Solapur seed completed successfully!");
    console.log(`- Nodes: ${SOLAPUR_NODES.length}`);
    console.log(`- Edges: ${edgeCount}`);
    console.log(`- Stations: ${AMBULANCE_STATIONS.length}`);
    console.log(`- Ambulances: ${AMBULANCES.length} (7 Available, 3 Busy/Offline)`);
    console.log(`- Hospitals: ${HOSPITALS.length} (Including 1 Full and 1 Closed)`);
}
if (process.argv[1] && process.argv[1].includes("seed")) {
    main()
        .catch((e) => {
        console.error("❌ Seed error:", e);
        process.exit(1);
    })
        .finally(async () => {
        await prisma.$disconnect();
    });
}
//# sourceMappingURL=seed.js.map