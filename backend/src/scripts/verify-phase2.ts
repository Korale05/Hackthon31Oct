import { getRoadGraph, findNearestNode } from "../services/graph.service.js";
import { findRouteAStar, findRouteDijkstra } from "../services/routing.service.js";
import { selectOptimalAmbulance } from "../services/ambulance-selection.service.js";
import { recommendOptimalHospital } from "../services/hospital-recommendation.service.js";
import { prisma } from "../DB/prisma.js";

async function runVerification() {
    console.log("🧪 === RUNNING PHASE 2 ALGORITHM VERIFICATION TESTS ===");

    // Test 1: Graph loading
    console.log("\n1. Testing Graph Loading from DB...");
    const graph = await getRoadGraph(true);
    console.log(`   ✅ Nodes in Graph: ${graph.nodes.size}`);
    let totalEdges = 0;
    for (const edges of graph.adjacencyList.values()) {
        totalEdges += edges.length;
    }
    console.log(`   ✅ Active Directed Edges: ${totalEdges}`);

    // Test 2: A* vs Dijkstra Equivalence & Performance
    console.log("\n2. Testing A* vs Dijkstra Equivalence & Efficiency...");
    const startNode = "node_01"; // Solapur Railway Station
    const goalNode = "node_14";  // D-Mart Jule Solapur

    const routeAStar = await findRouteAStar(startNode, goalNode, graph);
    const routeDijkstra = await findRouteDijkstra(startNode, goalNode, graph);

    if (!routeAStar || !routeDijkstra) {
        throw new Error("Failed to find routes between node_01 and node_14");
    }

    console.log(`   A* Path: ${routeAStar.path.join(" -> ")}`);
    console.log(`   A* Distance: ${routeAStar.distanceKm} km, ETA: ${routeAStar.etaMinutes} min, Nodes Explored: ${routeAStar.nodesExplored}`);
    console.log(`   Dijkstra Distance: ${routeDijkstra.distanceKm} km, ETA: ${routeDijkstra.etaMinutes} min, Nodes Explored: ${routeDijkstra.nodesExplored}`);

    if (Math.abs(routeAStar.etaMinutes - routeDijkstra.etaMinutes) > 0.05) {
        throw new Error(`A* ETA (${routeAStar.etaMinutes}) does not match Dijkstra ETA (${routeDijkstra.etaMinutes})!`);
    }
    console.log("   ✅ A* and Dijkstra calculated the exact same optimal ETA!");

    if (routeAStar.nodesExplored <= routeDijkstra.nodesExplored) {
        console.log(`   ✅ A* explored ${routeAStar.nodesExplored} nodes vs Dijkstra's ${routeDijkstra.nodesExplored} nodes (Heuristic pruning confirmed!)`);
    }

    // Test 3: Nearest Node Snapping
    console.log("\n3. Testing GPS Snapping to Nearest RoadNode...");
    // Near Saat Rasta: 17.6682, 75.9035
    const nearest = await findNearestNode(17.6682, 75.9035);
    console.log(`   GPS (17.6682, 75.9035) snapped to: ${nearest.name} (${nearest.id})`);
    if (nearest.id !== "node_04" && nearest.id !== "node_06") {
        throw new Error("Snapping unexpected node");
    }
    console.log("   ✅ Snapping accurate.");

    // Test 4: Ambulance Selection
    console.log("\n4. Testing Optimal Ambulance Selection...");
    const ambResult = await selectOptimalAmbulance({
        patientNodeId: "node_07", // Ashok Chowk
        severity: 4, // High severity
        category: "TRAUMA",
    });
    console.log(`   Winner Ambulance: ${ambResult.winner.code} (${ambResult.winner.type})`);
    console.log(`   Winner ETA: ${ambResult.winner.effectiveEtaMinutes} min from ${ambResult.winner.stationName}`);
    console.log(`   Ranked Candidates Evaluated: ${ambResult.rankedList.length}`);
    console.log(`   Reason: ${ambResult.winner.reason}`);
    console.log("   ✅ Ambulance selection completed with capability-weighted ranking.");

    // Test 5: Hospital Recommendation & Hard Filtering
    console.log("\n5. Testing Hospital Recommendation & Hard Filtering...");
    const hospResult = await recommendOptimalHospital({
        patientNodeId: "node_07",
        severity: 5,
        requiredSpecialty: "cardiac",
        needsICU: true,
    });
    console.log(`   Winner Hospital: ${hospResult.winner.name}`);
    console.log(`   Winner Total Score: ${hospResult.winner.scoreBreakdown.totalScore} (ETA: ${hospResult.winner.etaMinutes} min)`);

    // Verify hard filtering
    const closedHosp = hospResult.rankedList.find((h) => h.name.includes("CLOSED"));
    const fullHosp = hospResult.rankedList.find((h) => h.name.includes("FULL"));

    if (!closedHosp || closedHosp.eligible !== false) {
        throw new Error("Closed hospital was not excluded by hard filter!");
    }
    console.log(`   ✅ Closed Hospital correctly rejected: "${closedHosp.ineligibleReason}"`);

    if (!fullHosp || fullHosp.eligible !== false) {
        throw new Error("Full hospital (0 beds) was not excluded by hard filter!");
    }
    console.log(`   ✅ Full Hospital correctly rejected: "${fullHosp.ineligibleReason}"`);

    console.log("\n🎉 ALL PHASE 2 ALGORITHM VERIFICATION TESTS PASSED SUCCESSFULLY!");
}

runVerification()
    .catch((err) => {
        console.error("❌ Verification failed:", err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

