import type { Response, Request } from "express";

import type { AuthRequest } from "../middlewares/auth.middlewares.js";
import { ApiError } from "../utils/apiError.js";
import { prisma } from "../DB/prisma.js";
import { ApiResponse } from "../utils/apiResponce.js";
import { comparePassword, hashPassword } from "../utils/hashPassword.js";
import {
    generateAccessToken,
    generateRefreshToken,
    verifyRefreshToken,
} from "../utils/jwt.js";

const isProd = process.env.NODE_ENV === "production";

export async function singup(req: Request, res: Response) {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json(
                new ApiError(400, "Username and password are required")
            );
        }

        if (password.length < 6) {
            return res.status(400).json(
                new ApiError(400, "Password must be at least 6 characters")
            );
        }

        const existingUser = await prisma.user.findUnique({
            where: {
                username,
            },
        });

        if (existingUser) {
            return res.status(409).json(
                new ApiError(409, "Username already exists")
            );
        }

        const hashedPassword = await hashPassword(password);

        const user = await prisma.user.create({
            data: {
                username,
                password: hashedPassword,
            },
            select: {
                id: true,
                username: true,
            },
        });

        return res.status(201).json(
            new ApiResponse(201, user, "User Created Successfully!")
        );
    } catch (error) {
        return res.status(500).json(
            new ApiError(500, "Signup Failed!")
        );
    }
}

export const signup = singup;

export async function singin(req: Request, res: Response) {
    try {
        const username = req.body.username || req.body.email;
        const { password } = req.body;

        if (!username || !password) {
            return res.status(400).json(
                new ApiError(400, "Username and Password are required!")
            );
        }

        const user = await prisma.user.findUnique({
            where: {
                username,
            },
        });

        if (!user) {
            return res.status(401).json(
                new ApiError(401, "Invalid Username or Password!")
            );
        }

        const validPassword = await comparePassword(password, user.password);

        if (!validPassword) {
            return res.status(401).json(
                new ApiError(401, "Invalid Username or Password!")
            );
        }

        const accessToken = generateAccessToken(user.id);
        const refreshToken = generateRefreshToken(user.id);

        await prisma.user.update({
            where: { id: user.id },
            data: { refreshToken },
        });

        res.cookie("accessToken", accessToken, {
            httpOnly: true,
            secure: isProd,
            sameSite: isProd ? "none" : "lax",
            path: "/",
            maxAge: 15 * 60 * 1000, //15 min
        });

        res.cookie("refreshToken", refreshToken, {
            httpOnly: true,
            secure: isProd,
            sameSite: isProd ? "none" : "lax",
            path: "/",
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        const reqUserInfo = {
            id: user.id,
            username: user.username,
        };

        return res.status(200).json(
            new ApiResponse(
                200,
                { user: reqUserInfo, accessToken, refreshToken },
                "Signin Successfully!"
            )
        );
    } catch (error) {
        return res.status(500).json(
            new ApiError(500, "Internal Server Error!")
        );
    }
}

export const signin = singin;

export async function refreshAccessToken(req: Request, res: Response) {
    try {
        const refreshToken =
            req.cookies?.refreshToken || req.body?.refreshToken;

        if (!refreshToken) {
            return res.status(401).json(
                new ApiError(401, "RefreshToken is Missing!")
            );
        }

        const decoded = verifyRefreshToken(refreshToken);

        const user = await prisma.user.findUnique({
            where: { id: decoded.userId },
        });

        if (!user || (user.refreshToken && user.refreshToken !== refreshToken)) {
            return res.status(401).json(
                new ApiError(401, "Invalid or expired refresh token")
            );
        }

        const newAccessToken = generateAccessToken(user.id);
        const newRefreshToken = generateRefreshToken(user.id);

        await prisma.user.update({
            where: { id: user.id },
            data: { refreshToken: newRefreshToken },
        });

        res.cookie("accessToken", newAccessToken, {
            httpOnly: true,
            secure: isProd,
            sameSite: isProd ? "none" : "lax",
            path: "/",
            maxAge: 15 * 60 * 1000,
        });

        res.cookie("refreshToken", newRefreshToken, {
            httpOnly: true,
            secure: isProd,
            sameSite: isProd ? "none" : "lax",
            path: "/",
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        return res.status(200).json(
            new ApiResponse(
                200,
                { accessToken: newAccessToken, refreshToken: newRefreshToken },
                "Access token refreshed"
            )
        );
    } catch (error) {
        return res.status(401).json(
            new ApiError(401, "Invalid or expired refresh token")
        );
    }
}

export async function logout(req: AuthRequest, res: Response) {
    try {
        const refreshToken =
            req.cookies?.refreshToken || req.body?.refreshToken;

        if (req.userId) {
            await prisma.user
                .update({
                    where: { id: req.userId },
                    data: { refreshToken: null },
                })
                .catch(() => {});
        } else if (refreshToken) {
            try {
                const decoded = verifyRefreshToken(refreshToken);
                if (decoded?.userId) {
                    await prisma.user
                        .update({
                            where: { id: decoded.userId },
                            data: { refreshToken: null },
                        })
                        .catch(() => {});
                }
            } catch {
                // Ignore invalid token on logout
            }
        }

        res.clearCookie("accessToken", {
            httpOnly: true,
            secure: isProd,
            sameSite: isProd ? "none" : "lax",
            path: "/",
        });

        res.clearCookie("refreshToken", {
            httpOnly: true,
            secure: isProd,
            sameSite: isProd ? "none" : "lax",
            path: "/",
        });

        return res.status(200).json(
            new ApiResponse(200, null, "Logout Successfully!")
        );
    } catch (error) {
        return res.status(500).json(
            new ApiError(500, "Logout failed!")
        );
    }
}

export async function me(req: AuthRequest, res: Response) {
    try {
        if (!req.userId) {
            return res.status(401).json(
                new ApiError(401, "Unauthorized!")
            );
        }

        const user = await prisma.user.findUnique({
            where: {
                id: req.userId,
            },
            select: {
                id: true,
                username: true,
            },
        });

        if (!user) {
            return res.status(404).json(
                new ApiError(404, "User not found!")
            );
        }

        return res.status(200).json(
            new ApiResponse(200, user, "User fetched successfully")
        );
    } catch (error) {
        console.error(error);

        return res.status(500).json(
            new ApiError(500, "Internal server error")
        );
    }
}
