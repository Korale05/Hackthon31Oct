import type { Request, Response, NextFunction } from "express";

import { verifyAccessToken } from "../utils/jwt.js";
import { ApiError } from "../utils/apiError.js";

export interface AuthRequest extends Request {
    userId?: string;
}

export function authMiddleware(
    req: AuthRequest,
    res: Response,
    next: NextFunction
) {
    try {
        const authHeader = req.headers.authorization;
        const bearerToken = authHeader?.startsWith("Bearer ")
            ? authHeader.split(" ")[1]
            : undefined;
        const accessToken = req.cookies?.accessToken || bearerToken;
        
        if (!accessToken) {
            return res.status(401).json(
                new ApiError(401, "Access Token is Missing!")
            );
        }

        const decode = verifyAccessToken(accessToken);
        req.userId = decode.userId;

        next();
    } catch (error) {
        return res.status(401).json(
            new ApiError(401, "Invalid or expired AccessToken!")
        );
    }
}
