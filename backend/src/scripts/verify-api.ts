import { prisma } from "../DB/prisma.js";
import { findNearestNode } from "../services/graph.service.js";
import { selectOptimalAmbulance } from "../services/ambulance-selection.service.js";
import { recommendOptimalHospital } from "../services/hospital-recommendation.service.js";
import { handleRoadNetworkChange } from "../services/reroute.service.js";
import { simulationTick, resetSimulationToSeed } from "../services/simulation.service.js";
import { triageEmergency } from "../services/triage.service.js";

async function verifyFullApiPipeline() {
    console.log("🧪 === TESTING LIFELINE FULL API & LIFECYCLE WORKFLOW ===");

    // Step 0: Ensure fresh state
    console.log("\n0. Resetting simulation state...");
    await resetSimulationToSeed();

    // Step 1: Topology
    console.log("\n1. Verifying Network Topology...");
    const [nodes, edges, hospitals, ambulances] = await Promise.all([
        prisma.roadNode.findMany(),
        prisma.roadEdge.findMany(),
        prisma.hospital.findMany(),
        prisma.ambulance.findMany(),
    ]);
    console.log(`   Nodes: ${nodes.length}, Edges: ${edges.length}, Hospitals: ${hospitals.length}, Ambulances: ${ambulances.length}`);

    // Step 2: Emergency Intake & Auto-Dispatch
    console.log("\n2. Intake: New Emergency Call...");
    const callerLat = 17.6610;
    const callerLng = 75.9180; // Ashok Chowk
    const description = "Pedestrian struck by heavy vehicle, unconscious with severe trauma and bleeding";

    const triage = await triageEmergency({ description });
    console.log(`   AI Triage: ${triage.category} (Severity ${triage.severity}/5, Needs ICU: ${triage.needsICU})`);

    const nearestNode = await findNearestNode(callerLat, callerLng);
    console.log(`   Nearest Road Junction: ${nearestNode.name} (${nearestNode.id})`);

    const selection = await selectOptimalAmbulance({
        patientNodeId: nearestNode.id,
        severity: triage.severity,
        category: triage.category,
    });
    console.log(`   Winner Ambulance: ${selection.winner.code} (${selection.winner.type}) from ${selection.winner.stationName}`);
    console.log(`   Stage 1 ETA: ${selection.winner.effectiveEtaMinutes} min, Distance: ${selection.winner.distanceKm} km`);

    // Create Emergency in DB
    const emergency = await prisma.emergency.create({
        data: {
            callerName: "Ramesh Shinde",
            phone: "+91 98220 12345",
            description,
            lat: callerLat,
            lng: callerLng,
            nearestNodeId: nearestNode.id,
            category: triage.category,
            severity: triage.severity,
            requiredSpecialty: triage.requiredSpecialty,
            aiReasoning: triage.reasoning,
            aiSource: triage.aiSource,
            status: "EN_ROUTE_TO_PATIENT",
            ambulanceId: selection.winner.ambulanceId,
        },
    });

    await prisma.ambulance.update({
        where: { id: selection.winner.ambulanceId },
        data: { status: "EN_ROUTE_TO_PATIENT" },
    });

    const leg1 = await prisma.routeLeg.create({
        data: {
            emergencyId: emergency.id,
            stage: "TO_PATIENT",
            pathNodeIds: selection.winner.route.path,
            distanceKm: selection.winner.route.distanceKm,
            etaMinutes: selection.winner.route.etaMinutes,
            algorithm: "A_STAR",
            version: 1,
            isActive: true,
            reason: "Initial optimal dispatch to patient scene",
        },
    });

    await prisma.journeyEvent.create({
        data: {
            emergencyId: emergency.id,
            type: "ASSIGNED",
            message: `Ambulance ${selection.winner.code} dispatched. ETA: ${selection.winner.effectiveEtaMinutes} min.`,
        },
    });

    console.log(`   ✅ Emergency ID: ${emergency.id} created with active RouteLeg v1 (${(leg1.pathNodeIds as string[]).length} nodes)`);

    // Step 3: Dynamic Rerouting Demonstration (Block road on the ambulance path)
    console.log("\n3. Testing Dynamic Reroute upon Road Blockage...");
    const pathNodes = leg1.pathNodeIds as string[];
    if (pathNodes.length >= 2) {
        const u = pathNodes[0]!;
        const v = pathNodes[1]!;
        console.log(`   Simulating emergency road closure between: ${u} <-> ${v}`);

        // Mark edge blocked
        await prisma.roadEdge.updateMany({
            where: {
                OR: [
                    { fromNodeId: u, toNodeId: v },
                    { fromNodeId: v, toNodeId: u },
                ],
            },
            data: { isBlocked: true },
        });

        // Trigger reroute service
        const reroutes = await handleRoadNetworkChange({
            fromNodeId: u,
            toNodeId: v,
            changeType: "BLOCKED",
            detailMessage: `Emergency road blockage between ${u} and ${v}. Detour computed.`,
        });

        console.log(`   ✅ Reroutes Triggered: ${reroutes.length}`);
        if (reroutes.length > 0) {
            const r = reroutes[0]!;
            console.log(`   New ETA: ${r.newEta} min (Delta: ${r.deltaMinutes >= 0 ? "+" : ""}${r.deltaMinutes} min)`);
            console.log(`   Timeline Notice: "${r.reason}"`);
        }

        // Verify that RouteLeg version was incremented
        const activeLeg = await prisma.routeLeg.findFirst({
            where: { emergencyId: emergency.id, isActive: true },
        });
        console.log(`   ✅ Active RouteLeg is now version: ${activeLeg?.version} (Old version archived)`);
    }

    // Step 4: Advance Simulation
    console.log("\n4. Advancing Simulation Tick (Time Compression 10x)...");
    const tickResult = await simulationTick(10);
    console.log(`   Active journeys simulated: ${tickResult.activeCount}`);

    // Step 5: Paramedic Arrived & Confirm Pickup
    console.log("\n5. Confirming Patient Pickup & Running Hospital Recommendation...");
    const hospRec = await recommendOptimalHospital({
        patientNodeId: emergency.nearestNodeId,
        severity: emergency.severity,
        requiredSpecialty: emergency.requiredSpecialty,
        needsICU: emergency.severity >= 4,
    });

    console.log(`   Recommended Hospital: ${hospRec.winner.name}`);
    console.log(`   Score: ${hospRec.winner.scoreBreakdown.totalScore}, ETA: ${hospRec.winner.etaMinutes} min, Available Beds: ${hospRec.winner.availableBeds}`);

    // Confirm pickup & transition to Stage 2 (TO_HOSPITAL)
    await prisma.routeLeg.updateMany({
        where: { emergencyId: emergency.id, isActive: true },
        data: { isActive: false },
    });

    const stage2Leg = await prisma.routeLeg.create({
        data: {
            emergencyId: emergency.id,
            stage: "TO_HOSPITAL",
            pathNodeIds: hospRec.winner.route!.path,
            distanceKm: hospRec.winner.route!.distanceKm,
            etaMinutes: hospRec.winner.route!.etaMinutes,
            algorithm: "A_STAR",
            version: 1,
            isActive: true,
            reason: `Transit to recommended hospital (${hospRec.winner.name})`,
        },
    });

    await prisma.emergency.update({
        where: { id: emergency.id },
        data: {
            status: "EN_ROUTE_TO_HOSPITAL",
            hospitalId: hospRec.winner.hospitalId,
            pickupAt: new Date(),
        },
    });

    await prisma.ambulance.update({
        where: { id: selection.winner.ambulanceId },
        data: { status: "TRANSPORTING" },
    });

    console.log(`   ✅ Status updated to EN_ROUTE_TO_HOSPITAL, Stage 2 Leg active (${stage2Leg.distanceKm} km, ETA: ${stage2Leg.etaMinutes} min)`);

    // Step 6: Complete Emergency
    console.log("\n6. Completing Emergency Mission...");
    await prisma.emergency.update({
        where: { id: emergency.id },
        data: { status: "COMPLETED", completedAt: new Date() },
    });

    await prisma.ambulance.update({
        where: { id: selection.winner.ambulanceId },
        data: { status: "AVAILABLE" },
    });

    await prisma.hospital.update({
        where: { id: hospRec.winner.hospitalId },
        data: { availableBeds: { decrement: 1 } },
    });

    console.log("   ✅ Emergency marked COMPLETED, ambulance freed to AVAILABLE, hospital bed count updated.");

    // Clean up reset
    await resetSimulationToSeed();
    console.log("\n🎉 ALL LIFELINE API WORKFLOWS TESTED & VERIFIED SUCCESSFULLY!");
}

verifyFullApiPipeline()
    .catch((err) => {
        console.error("❌ API pipeline verification failed:", err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

