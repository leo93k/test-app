import type { NextApiRequest, NextApiResponse } from "next";
import { authenticateUser } from "@/lib/auth/users";
import { generateToken } from "@/lib/auth/jwt";

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    try {
        const { username, password } = req.body;

        // 입력 검증
        if (!username || !password) {
            return res.status(400).json({
                error: "사용자 이름과 비밀번호를 입력해주세요.",
            });
        }

        // 사용자 인증
        const user = authenticateUser(username, password);

        if (!user) {
            return res.status(401).json({
                error: "사용자 이름 또는 비밀번호가 올바르지 않습니다.",
            });
        }

        // JWT 토큰 생성
        const token = generateToken({
            userId: user.id,
            username: user.username,
            name: user.name,
        });

        // 성공 응답
        return res.status(200).json({
            success: true,
            token,
            user: {
                id: user.id,
                username: user.username,
                name: user.name,
            },
        });
    } catch (error) {
        console.error("Login API error:", error);
        return res.status(500).json({
            error: "로그인 처리 중 오류가 발생했습니다.",
        });
    }
}
