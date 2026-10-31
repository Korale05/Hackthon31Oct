import type { Request, Response, NextFunction } from "express";
import { ApiError } from "../utils/apiError.js";

export function errorHandler(
    err: unknown,
    req: Request,
    res: Response,
    _next: NextFunction
) {
    if (err instanceof ApiError) {
        return res.status(err.statuscode || 500).json({
            statusCode: err.statuscode || 500,
            message: err.message,
            success: false,
            data: null,
        });
    }

    console.error("Unhandled Server Error:", err);

    const message = err instanceof Error ? err.message : "Internal Server Error";
    return res.status(500).json({
        statusCode: 500,
        message,
        success: false,
        data: null,
    });
}

