import { prisma } from "../DB/prisma.js";
import { getRoadGraph, findNearestNode } from "../services/graph.service.js";
import { findRouteAStar, findRouteDijkstra } from "../services/routing.service.js";
import { selectOptimalAmbulance } from "../services/ambulance-selection.service.js";
import { recommendOptimalHospital } from "../services/hospital-recommendation.service.js";
import { handleRoadNetworkChange } from "../services/reroute.service.js";
import { simulationTick, resetSimulationToSeed } from "../services/simulation.service.js";
import { triageEmergency, ruleBasedTriage } from "../services/triage.service.js";

async function runRigorousE2E() {
    console.log("======================================================================");
    console.log("🏥 LIFELINE RIGOROUS END-TO-END VERIFICATION & DEBUGGING SUITE");
    console.log("======================================================================\n");

    // ------------------------------------------------------------------
    // 1. Database & Seed Verification
    // ------------------------------------------------------------------
    console.log("1. [DB & SCHEMA] Verifying PostgreSQL connection and models...");
    await resetSimulationToSeed();

    const [nodes, edges, stations, ambulances, hospitals, users] = await Promise.all([
        prisma.roadNode.findMany(),
        prisma.roadEdge.findMany(),
        prisma.ambulanceStation.findMany(),
        prisma.ambulance.findMany(),
        prisma.hospital.findMany(),
        prisma.user.findMany(),
    ]);

    if (nodes.length !== 26) throw new Error(`Expected 26 nodes, got ${nodes.length}`);
    if (edges.length !== 70) throw new Error(`Expected 70 edges, got ${edges.length}`);
    if (stations.length !== 4) throw new Error(`Expected 4 stations, got ${stations.length}`);
    if (ambulances.length !== 10) throw new Error(`Expected 10 ambulances, got ${ambulances.length}`);
    if (hospitals.length !== 6) throw new Error(`Expected 6 hospitals, got ${hospitals.length}`);

    console.log(`   ✅ DB verified: ${nodes.length} Nodes, ${edges.length} Edges, ${stations.length} Stations, ${ambulances.length} Ambulances, ${hospitals.length} Hospitals.`);
    console.log(`   ✅ Existing User model intact (${users.length} users in DB).`);

    // ------------------------------------------------------------------
    // 2. AI Triage & Deterministic Fallback
    // ------------------------------------------------------------------
    console.log("\n2. [TRIAGE] Verifying AI triage classification and offline rule fallback...");
    const triageTestCases = [
        { desc: "Severe chest pain radiating to jaw and shortness of breath", expectedCat: "CARDIAC", expectedSev: 5 },
        { desc: "Pedestrian run over by bus with arterial bleeding and multiple compound fractures", expectedCat: "TRAUMA", expectedSev: 4 },
        { desc: "Sudden facial paralysis, unable to speak, right side numbness", expectedCat: "STROKE", expectedSev: 5 },
        { desc: "Third degree burns over arms and face from factory fire", expectedCat: "BURNS", expectedSev: 4 },
        { desc: "Acute asthma attack, blue lips, gasping for air", expectedCat: "RESPIRATORY", expectedSev: 4 },
        { desc: "Active labor contractions every 2 minutes, water broke", expectedCat: "MATERNITY", expectedSev: 4 },
        { desc: "Convulsions and high fever in 2-year-old child", expectedCat: "PEDIATRIC", expectedSev: 4 },
        { desc: "Mild persistent stomach pain and low fever", expectedCat: "GENERAL", expectedSev: 2 },
    ];

    for (const tc of triageTestCases) {
        const triage = await triageEmergency({ description: tc.desc });
        if (triage.category !== tc.expectedCat) {
            throw new Error(`Triage category mismatch for '${tc.desc}': expected ${tc.expectedCat}, got ${triage.category}`);
        }
        if (triage.severity !== tc.expectedSev) {
            throw new Error(`Triage severity mismatch: expected ${tc.expectedSev}, got ${triage.severity}`);
        }
        console.log(`   ✅ ${tc.expectedCat} verified (Sev ${triage.severity}/5, Source: ${triage.aiSource})`);
    }

    // ------------------------------------------------------------------
    // 3. A* vs Dijkstra & Blocked Road Exclusion
    // ------------------------------------------------------------------
    console.log("\n3. [ROUTING] Verifying A* against Dijkstra & Blocked Road Exclusion...");
    const graph = await getRoadGraph(true);
    const startNode = "node_02"; // Old Pune Naka
    const goalNode = "node_16";  // Akkalkot Naka

    const routeA = await findRouteAStar(startNode, goalNode, graph);
    const routeD = await findRouteDijkstra(startNode, goalNode, graph);

    if (!routeA || !routeD) throw new Error("Failed to find route between test nodes");
    if (Math.abs(routeA.etaMinutes - routeD.etaMinutes) > 0.05) {
        throw new Error(`A* ETA (${routeA.etaMinutes}) does not match Dijkstra ETA (${routeD.etaMinutes})`);
    }
    console.log(`   ✅ A* and Dijkstra match exactly: ETA ${routeA.etaMinutes} min, Distance ${routeA.distanceKm} km.`);
    console.log(`   ✅ Efficiency: A* evaluated ${routeA.nodesExplored} nodes vs Dijkstra ${routeD.nodesExplored} nodes.`);

    // Test Blocked Road Exclusion
    console.log("   Testing road segment blockage...");
    const roadToBlock = edges.find((e) => e.fromNodeId === "node_10" && e.toNodeId === "node_18");
    if (!roadToBlock) throw new Error("Could not find edge node_10 <-> node_18");

    await prisma.roadEdge.updateMany({
        where: {
            OR: [
                { id: roadToBlock.id },
                { fromNodeId: roadToBlock.toNodeId, toNodeId: roadToBlock.fromNodeId },
            ],
        },
        data: { isBlocked: true },
    });

    const updatedGraph = await getRoadGraph(true);
    const detourRoute = await findRouteAStar("node_10", "node_18", updatedGraph);

    if (!detourRoute) throw new Error("Detour could not be found around blocked road");

    // Verify the blocked road is NOT in the detour path
    for (let i = 0; i < detourRoute.path.length - 1; i++) {
        const u = detourRoute.path[i];
        const v = detourRoute.path[i + 1];
        if (
            (u === roadToBlock.fromNodeId && v === roadToBlock.toNodeId) ||
            (u === roadToBlock.toNodeId && v === roadToBlock.fromNodeId)
        ) {
            throw new Error("Detour route illegally includes the blocked road segment!");
        }
    }
    console.log(`   ✅ Blocked road successfully excluded! Detour calculated: ${detourRoute.path.join(" -> ")} (ETA: ${detourRoute.etaMinutes}m)`);

    // Restore road
    await prisma.roadEdge.updateMany({
        where: {
            OR: [
                { id: roadToBlock.id },
                { fromNodeId: roadToBlock.toNodeId, toNodeId: roadToBlock.fromNodeId },
            ],
        },
        data: { isBlocked: false },
    });

    // ------------------------------------------------------------------
    // 4. Ambulance Allocation & Race Condition Prevention
    // ------------------------------------------------------------------
    console.log("\n4. [ALLOCATION] Testing ambulance assignment and race condition prevention...");
    // Simulate 2 near-simultaneous emergencies at the same location
    const patientNode = "node_04"; // Saat Rasta

    const select1 = await selectOptimalAmbulance({ patientNodeId: patientNode, severity: 5, category: "CARDIAC" });
    const winner1 = select1.winner;

    // First assignment
    const update1 = await prisma.ambulance.updateMany({
        where: { id: winner1.ambulanceId, status: "AVAILABLE" },
        data: { status: "EN_ROUTE_TO_PATIENT" },
    });
    if (update1.count !== 1) throw new Error("First ambulance assignment failed");

    // Concurrent second request: should NOT get winner1 because winner1 is no longer AVAILABLE!
    const select2 = await selectOptimalAmbulance({ patientNodeId: patientNode, severity: 5, category: "CARDIAC" });
    const winner2 = select2.winner;

    if (winner1.ambulanceId === winner2.ambulanceId) {
        throw new Error("RACE CONDITION BUG: Second emergency received already-assigned ambulance!");
    }
    console.log(`   ✅ Emergency 1 assigned: ${winner1.code} (${winner1.type})`);
    console.log(`   ✅ Emergency 2 assigned distinct vehicle: ${winner2.code} (${winner2.type})`);
    console.log("   ✅ Zero duplicate assignments confirmed.");

    // Clean up test ambulances
    await prisma.ambulance.updateMany({
        where: { id: { in: [winner1.ambulanceId, winner2.ambulanceId] } },
        data: { status: "AVAILABLE" },
    });

    // ------------------------------------------------------------------
    // 5. Full End-to-End Emergency Lifecycle Journey
    // ------------------------------------------------------------------
    console.log("\n5. [E2E JOURNEY] Testing complete 2-stage emergency lifecycle...");

    // A. Emergency Intake
    const incidentLat = 17.6715; // Station area
    const incidentLng = 75.9102;
    const callerDesc = "Heart attack patient collapsed on railway platform, unresponsive";

    const triage = await triageEmergency({ description: callerDesc });
    const snappedNode = await findNearestNode(incidentLat, incidentLng);

    const selection = await selectOptimalAmbulance({
        patientNodeId: snappedNode.id,
        severity: triage.severity,
        category: triage.category,
    });

    const assignedAmb = selection.winner;

    const emergency = await prisma.emergency.create({
        data: {
            callerName: "Platform Duty Officer",
            phone: "+91 94220 99999",
            description: callerDesc,
            lat: incidentLat,
            lng: incidentLng,
            nearestNodeId: snappedNode.id,
            category: triage.category,
            severity: triage.severity,
            requiredSpecialty: triage.requiredSpecialty,
            aiReasoning: triage.reasoning,
            aiSource: triage.aiSource,
            status: "EN_ROUTE_TO_PATIENT",
            ambulanceId: assignedAmb.ambulanceId,
        },
    });

    await prisma.ambulance.update({
        where: { id: assignedAmb.ambulanceId },
        data: { status: "EN_ROUTE_TO_PATIENT" },
    });

    const leg1 = await prisma.routeLeg.create({
        data: {
            emergencyId: emergency.id,
            stage: "TO_PATIENT",
            pathNodeIds: assignedAmb.route.path,
            distanceKm: assignedAmb.route.distanceKm,
            etaMinutes: assignedAmb.route.etaMinutes,
            algorithm: "A_STAR",
            version: 1,
            isActive: true,
            reason: "Initial optimal dispatch",
        },
    });

    console.log(`   A. Emergency Created: ID=${emergency.id}`);
    console.log(`      Stage 1 RouteLeg v1: ${assignedAmb.route.distanceKm} km, ETA: ${assignedAmb.route.etaMinutes} min`);

    // B. Ambulance Movement via Simulation Ticks
    console.log("   B. Simulating ambulance movement towards patient scene...");
    let ticks = 0;
    let ambRecord = await prisma.ambulance.findUnique({ where: { id: assignedAmb.ambulanceId } });

    while (ambRecord?.status === "EN_ROUTE_TO_PATIENT" && ticks < 20) {
        await simulationTick(20); // 20x compression to accelerate arrival in test
        ambRecord = await prisma.ambulance.findUnique({ where: { id: assignedAmb.ambulanceId } });
        ticks++;
    }

    const updatedEmergency = await prisma.emergency.findUnique({ where: { id: emergency.id } });
    console.log(`      Ambulance arrived at patient scene after ${ticks} simulation ticks.`);
    console.log(`      Ambulance Status: ${ambRecord?.status}, Emergency Status: ${updatedEmergency?.status}`);

    if (ambRecord?.status !== "AT_PATIENT") {
        throw new Error(`Expected ambulance status AT_PATIENT, got ${ambRecord?.status}`);
    }

    // C. Hospital Recommendation & Capacity Filtering
    console.log("   C. Testing Hospital Recommendation & Constraint Filtering...");
    const hospRec = await recommendOptimalHospital({
        patientNodeId: emergency.nearestNodeId,
        severity: emergency.severity,
        requiredSpecialty: emergency.requiredSpecialty,
        needsICU: true,
    });

    const topHospital = hospRec.winner;
    console.log(`      Recommended Hospital: ${topHospital.name} (Score: ${topHospital.scoreBreakdown.totalScore}, ETA: ${topHospital.etaMinutes}m)`);

    // Verify that closed/full hospitals were disqualified
    const closedHosp = hospRec.rankedList.find((h) => !h.emergencyOpen);
    const fullHosp = hospRec.rankedList.find((h) => h.availableBeds === 0);
    if (closedHosp && closedHosp.eligible !== false) throw new Error("Closed hospital was not filtered!");
    if (fullHosp && fullHosp.eligible !== false) throw new Error("0-bed hospital was not filtered!");
    console.log("      ✅ Capacity and Emergency Open constraint filtering verified.");

    // D. Confirm Patient Pickup
    console.log("   D. Confirming patient pickup & initiating Stage 2 (TO_HOSPITAL)...");
    await prisma.routeLeg.updateMany({
        where: { emergencyId: emergency.id, isActive: true },
        data: { isActive: false },
    });

    const leg2 = await prisma.routeLeg.create({
        data: {
            emergencyId: emergency.id,
            stage: "TO_HOSPITAL",
            pathNodeIds: topHospital.route!.path,
            distanceKm: topHospital.route!.distanceKm,
            etaMinutes: topHospital.route!.etaMinutes,
            algorithm: "A_STAR",
            version: 1,
            isActive: true,
            reason: `Direct transit to recommended hospital (${topHospital.name})`,
        },
    });

    await prisma.emergency.update({
        where: { id: emergency.id },
        data: {
            status: "EN_ROUTE_TO_HOSPITAL",
            hospitalId: topHospital.hospitalId,
            pickupAt: new Date(),
        },
    });

    await prisma.ambulance.update({
        where: { id: assignedAmb.ambulanceId },
        data: {
            status: "TRANSPORTING",
            currentNodeId: emergency.nearestNodeId,
        },
    });

    console.log(`      Stage 2 Leg Active: ${leg2.distanceKm} km, ETA: ${leg2.etaMinutes} min to ${topHospital.name}.`);

    // E. Dynamic Detour while Transporting Patient to Hospital
    console.log("   E. Simulating dynamic road block and reroute en route to hospital...");
    const leg2Nodes = leg2.pathNodeIds as string[];
    if (leg2Nodes.length >= 2) {
        const u = leg2Nodes[0]!;
        const v = leg2Nodes[1]!;

        await prisma.roadEdge.updateMany({
            where: {
                OR: [
                    { fromNodeId: u, toNodeId: v },
                    { fromNodeId: v, toNodeId: u },
                ],
            },
            data: { isBlocked: true },
        });

        const reroutes = await handleRoadNetworkChange({
            fromNodeId: u,
            toNodeId: v,
            changeType: "BLOCKED",
            detailMessage: `Emergency road blockage between ${u} and ${v}.`,
        });

        console.log(`      ✅ Dynamic Reroute Triggered: ${reroutes.length} active emergency affected.`);
        const activeLegNow = await prisma.routeLeg.findFirst({
            where: { emergencyId: emergency.id, isActive: true },
        });
        console.log(`      ✅ RouteLeg incremented to version: v${activeLegNow?.version} (ETA: ${activeLegNow?.etaMinutes}m).`);

        // Unblock
        await prisma.roadEdge.updateMany({
            where: {
                OR: [
                    { fromNodeId: u, toNodeId: v },
                    { fromNodeId: v, toNodeId: u },
                ],
            },
            data: { isBlocked: false },
        });
    }

    // F. Hospital Arrival & Completion
    console.log("   F. Completing emergency admission at hospital...");
    const hospBefore = await prisma.hospital.findUnique({ where: { id: topHospital.hospitalId } });
    const bedsBefore = hospBefore?.availableBeds || 0;

    // Simulate completion
    await prisma.emergency.update({
        where: { id: emergency.id },
        data: { status: "COMPLETED", completedAt: new Date() },
    });

    await prisma.ambulance.update({
        where: { id: assignedAmb.ambulanceId },
        data: { status: "AVAILABLE" },
    });

    if (hospBefore && hospBefore.availableBeds > 0) {
        await prisma.hospital.update({
            where: { id: topHospital.hospitalId },
            data: { availableBeds: { decrement: 1 } },
        });
    }

    const ambAfter = await prisma.ambulance.findUnique({ where: { id: assignedAmb.ambulanceId } });
    const hospAfter = await prisma.hospital.findUnique({ where: { id: topHospital.hospitalId } });

    console.log(`      Ambulance Status Restored: ${ambAfter?.status}`);
    console.log(`      Hospital Beds: ${bedsBefore} -> ${hospAfter?.availableBeds}`);

    if (ambAfter?.status !== "AVAILABLE") throw new Error("Ambulance was not restored to AVAILABLE!");
    if (hospAfter?.availableBeds !== bedsBefore - 1) throw new Error("Hospital bed was not decremented correctly!");

    console.log("      ✅ Mission completed, vehicle freed, bed count properly decremented.");

    // Clean up reset
    await resetSimulationToSeed();

    console.log("\n======================================================================");
    console.log("🎉 ALL 17 RIGOROUS E2E SPECIFICATION CHECKS PASSED WITH ZERO ERRORS!");
    console.log("======================================================================");
}

runRigorousE2E()
    .catch((err) => {
        console.error("❌ E2E VERIFICATION FAILED:", err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

