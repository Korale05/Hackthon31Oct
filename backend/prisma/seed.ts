import "dotenv/config";
import { runDatabaseSeed } from "../src/services/seed.service.js";
import { prisma } from "../src/DB/prisma.js";

async function main() {
    console.log("🌱 Starting LifeLine Seed for Solapur, Maharashtra...");
    await runDatabaseSeed();
    console.log("🎉 LifeLine Solapur seed completed successfully!");
}

main()
    .catch((e) => {
        console.error("❌ Seed error:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
