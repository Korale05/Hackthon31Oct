import { triageEmergency, ruleBasedTriage } from "../services/triage.service.js";

async function verifyTriage() {
    console.log("🧪 === TESTING EMERGENCY TRIAGE SERVICE ===");

    // Test 1: Cardiac emergency with chest pain
    const res1 = await triageEmergency({
        description: "Elderly man complaining of crushing chest pain and sweating profusely",
    });
    console.log(`1. Test Cardiac: Category=${res1.category}, Severity=${res1.severity}, Specialty=${res1.requiredSpecialty}, Source=${res1.aiSource}`);
    if (res1.category !== "CARDIAC" || res1.severity !== 5) {
        throw new Error("Failed cardiac rule match");
    }

    // Test 2: Trauma emergency
    const res2 = await triageEmergency({
        description: "Motorbike collision near junction with severe leg fracture and active bleeding",
    });
    console.log(`2. Test Trauma: Category=${res2.category}, Severity=${res2.severity}, Specialty=${res2.requiredSpecialty}, Source=${res2.aiSource}`);
    if (res2.category !== "TRAUMA" || res2.severity < 4) {
        throw new Error("Failed trauma rule match");
    }

    // Test 3: Neurological / Stroke
    const res3 = await triageEmergency({
        description: "Patient suddenly collapsed with slurred speech and facial drooping",
    });
    console.log(`3. Test Stroke: Category=${res3.category}, Severity=${res3.severity}, Specialty=${res3.requiredSpecialty}, Source=${res3.aiSource}`);
    if (res3.category !== "STROKE" || res3.severity !== 5) {
        throw new Error("Failed stroke rule match");
    }

    console.log("✅ All triage classification checks passed successfully!");
}

verifyTriage().catch((e) => {
    console.error("❌ Triage test failed:", e);
    process.exit(1);
});

