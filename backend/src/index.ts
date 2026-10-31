import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import "dotenv/config";
import { env } from "node:process";

import emergencyRouter from "./router/emergency.router.js";
import mapRouter from "./router/map.router.js";
import authRouter from "./router/auth.router.js";
import { errorHandler } from "./middlewares/error.middleware.js";
import { startSimulationLoop } from "./services/simulation.service.js";
import { prisma } from "./DB/prisma.js";

const app = express();

// Middlewares with dynamic localhost CORS origin matching
app.use(
    cors({
        origin: (origin, callback) => {
            if (!origin || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
                callback(null, true);
            } else {
                callback(null, true);
            }
        },
        credentials: true,
    })
);
app.use(express.json());
app.use(cookieParser());

// Routers
app.use("/api/emergencies", emergencyRouter);
app.use("/api/map", mapRouter);
app.use("/api", mapRouter);
app.use("/api/auth", authRouter);
app.use("/api/v1/auth", authRouter);

// Existing test route kept intact
app.post("/users", async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await prisma.user.create({
            data: {
                username: username,
                password: password,
            },
            select: {
                id: true,
                username: true,
            },
        });
        return res.status(200).json({
            msg: "User created successfully !",
            user,
        });
    } catch (error) {
        return res.status(500).json({
            msg: "Error creating user",
        });
    }
});

// Centralized error handler
app.use(errorHandler);

// Start autonomous background simulation loop (1s ticks)
startSimulationLoop();

const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚑 LifeLine Backend running on http://localhost:${PORT} (0.0.0.0:${PORT})`);
});
