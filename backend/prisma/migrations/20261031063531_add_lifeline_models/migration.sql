-- CreateTable
CREATE TABLE "RoadNode" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "RoadNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoadEdge" (
    "id" TEXT NOT NULL,
    "fromNodeId" TEXT NOT NULL,
    "toNodeId" TEXT NOT NULL,
    "distanceKm" DOUBLE PRECISION NOT NULL,
    "baseSpeedKmh" DOUBLE PRECISION NOT NULL,
    "trafficFactor" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "isBlocked" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "RoadEdge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AmbulanceStation" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "nodeId" TEXT NOT NULL,

    CONSTRAINT "AmbulanceStation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ambulance" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "currentNodeId" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "stationId" TEXT NOT NULL,

    CONSTRAINT "Ambulance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Hospital" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "nodeId" TEXT NOT NULL,
    "specialties" TEXT[],
    "totalBeds" INTEGER NOT NULL,
    "availableBeds" INTEGER NOT NULL,
    "icuBeds" INTEGER NOT NULL,
    "emergencyOpen" BOOLEAN NOT NULL DEFAULT true,
    "traumaLevel" INTEGER NOT NULL,

    CONSTRAINT "Hospital_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Emergency" (
    "id" TEXT NOT NULL,
    "callerName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "nearestNodeId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "severity" INTEGER NOT NULL,
    "requiredSpecialty" TEXT NOT NULL,
    "aiReasoning" TEXT NOT NULL,
    "aiSource" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "ambulanceId" TEXT,
    "hospitalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pickupAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "Emergency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RouteLeg" (
    "id" TEXT NOT NULL,
    "emergencyId" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "pathNodeIds" JSONB NOT NULL,
    "distanceKm" DOUBLE PRECISION NOT NULL,
    "etaMinutes" DOUBLE PRECISION NOT NULL,
    "algorithm" TEXT NOT NULL DEFAULT 'A_STAR',
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "reason" TEXT,

    CONSTRAINT "RouteLeg_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JourneyEvent" (
    "id" TEXT NOT NULL,
    "emergencyId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JourneyEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Ambulance_code_key" ON "Ambulance"("code");

-- AddForeignKey
ALTER TABLE "RoadEdge" ADD CONSTRAINT "RoadEdge_fromNodeId_fkey" FOREIGN KEY ("fromNodeId") REFERENCES "RoadNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoadEdge" ADD CONSTRAINT "RoadEdge_toNodeId_fkey" FOREIGN KEY ("toNodeId") REFERENCES "RoadNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ambulance" ADD CONSTRAINT "Ambulance_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "AmbulanceStation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Emergency" ADD CONSTRAINT "Emergency_ambulanceId_fkey" FOREIGN KEY ("ambulanceId") REFERENCES "Ambulance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Emergency" ADD CONSTRAINT "Emergency_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RouteLeg" ADD CONSTRAINT "RouteLeg_emergencyId_fkey" FOREIGN KEY ("emergencyId") REFERENCES "Emergency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JourneyEvent" ADD CONSTRAINT "JourneyEvent_emergencyId_fkey" FOREIGN KEY ("emergencyId") REFERENCES "Emergency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
