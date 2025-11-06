import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    try {
        return res.status(200).json({
            success: true,
            message: "로그아웃되었습니다.",
        });
    } catch (error) {
        console.error("Logout API error:", error);
        return res.status(500).json({
            error: "로그아웃 처리 중 오류가 발생했습니다.",
        });
    }
}
