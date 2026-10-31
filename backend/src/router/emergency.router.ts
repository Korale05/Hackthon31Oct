import { Router } from "express";
import {
    createEmergency,
    listEmergencies,
    getEmergencyById,
    confirmPickup,
    completeEmergency,
    cancelEmergency,
} from "../controllers/emergency.controller.js";

const router = Router();

// Public emergency intake and real-time tracking
router.post("/", createEmergency);
router.get("/", listEmergencies);
router.get("/:id", getEmergencyById);
router.post("/:id/confirm-pickup", confirmPickup);
router.post("/:id/complete", completeEmergency);
router.post("/:id/cancel", cancelEmergency);

export default router;

