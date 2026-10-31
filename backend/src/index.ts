import express from "express";
import cors from "cors";
import "dotenv/config";
import { prisma } from "./DB/prisma.js";
import { env } from "node:process";

const app = express();

app.use(cors());
app.use(express.json());

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
        console.log(error);
        return res.status(500).json({
            msg: "Error creating user",
        });
    }
});

const PORT = env.PORT || 3000;
app.listen(PORT, () => {
    console.log("Backend is running on port : ", PORT);
});
