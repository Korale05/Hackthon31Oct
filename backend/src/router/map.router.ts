import { Router } from "express";
import {
    getMapGraph,
    blockRoadEdge,
    setRoadTraffic,
    updateAmbulanceStatus,
    updateHospital,
    triggerSimulationTick,
    resetSimulation,
} from "../controllers/map.controller.js";

const router = Router();

// Graph & network topology
router.get("/graph", getMapGraph);

// Simulation & admin road/fleet manipulation
router.patch("/roads/:edgeId/block", blockRoadEdge);
router.patch("/roads/:edgeId/traffic", setRoadTraffic);
router.patch("/ambulances/:id/status", updateAmbulanceStatus);
router.patch("/hospitals/:id", updateHospital);

router.post("/simulation/tick", triggerSimulationTick);
router.post("/simulation/reset", resetSimulation);

export default router;

