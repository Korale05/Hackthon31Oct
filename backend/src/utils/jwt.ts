import jwt from "jsonwebtoken";

export function generateAccessToken(userId: string) {
    return jwt.sign(
        {
            userId,
        },
        process.env.JWT_ACCESS_SECRET!,
        {
            expiresIn: "15m",
        }
    );
}

export function generateRefreshToken(userId: string) {
    return jwt.sign(
        {
            userId,
        },
        process.env.JWT_REFRESH_SECRET!,
        {
            expiresIn: "7d",
        }
    );
}

export function verifyAccessToken(token: string) {
    return jwt.verify(
        token,
        process.env.JWT_ACCESS_SECRET!
    ) as {
        userId: string;
    };
}

export function verifyRefreshToken(token: string) {
    return jwt.verify(
        token,
        process.env.JWT_REFRESH_SECRET!
    ) as {
        userId: string;
    };
}
