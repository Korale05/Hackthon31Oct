import { Router } from "express";
import {
    singup,
    singin,
    refreshAccessToken,
    logout,
    me,
} from "../controllers/auth.controller.js";
import { authMiddleware } from "../middlewares/auth.middlewares.js";

const router = Router();

router.post("/signup", singup);
router.post("/signin", singin);
router.post("/refresh-token", refreshAccessToken);
router.post("/logout", logout);
router.get("/me", authMiddleware, me);

export default router;

