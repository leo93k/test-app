import type { NextApiRequest, NextApiResponse } from "next";
import { extractTokenFromHeader, verifyToken } from "@/lib/auth/jwt";

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method !== "GET") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    try {
        const authHeader = req.headers.authorization;
        const token = extractTokenFromHeader(authHeader);

        if (!token) {
            return res.status(401).json({
                authenticated: false,
                error: "토큰이 제공되지 않았습니다.",
            });
        }

        const payload = verifyToken(token);

        if (!payload) {
            return res.status(401).json({
                authenticated: false,
                error: "유효하지 않은 토큰입니다.",
            });
        }

        // 토큰이 유효하면 인증 성공
        return res.status(200).json({
            authenticated: true,
            user: payload,
        });
    } catch (error) {
        console.error("Verify API error:", error);
        return res.status(500).json({
            authenticated: false,
            error: "토큰 검증 중 오류가 발생했습니다.",
        });
    }
}
