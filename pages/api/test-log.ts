import { NextApiRequest, NextApiResponse } from "next";
import { Server as HTTPServer } from "http";
import { initializeSocketServer } from "@/service/socket";
import { Logger } from "@/lib/logger";

type NextApiResponseWithSocket = NextApiResponse & {
    socket: {
        server: HTTPServer;
    };
};

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponseWithSocket
) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    // Socket.io 서버 초기화 (서비스 레이어에서 처리)
    await initializeSocketServer(res.socket.server);

    try {
        const { type = "info", message } = req.body;

        const logger = Logger.getInstance("api-test");

        // 지연을 주어서 여러 로그가 순차적으로 보이도록 함
        await new Promise((resolve) => setTimeout(resolve, 100));

        switch (type) {
            case "info":
                await logger.info(
                    message || "🔵 API에서 생성된 Info 로그입니다."
                );
                break;
            case "success":
                await logger.success(
                    message || "✅ API에서 생성된 Success 로그입니다."
                );
                break;
            case "error":
                await logger.error(
                    message || "❌ API에서 생성된 Error 로그입니다."
                );
                break;
            default:
                await logger.info(
                    message || "📝 API에서 생성된 기본 로그입니다."
                );
        }

        // 추가 로그들로 실시간 전달 테스트
        await new Promise((resolve) => setTimeout(resolve, 200));
        await logger.info(
            "📡 WebSocket을 통해 실시간으로 전달되는 로그입니다."
        );

        await new Promise((resolve) => setTimeout(resolve, 200));
        await logger.success(
            "🚀 서버에서 클라이언트로 즉시 전달되는 로그입니다."
        );

        return res.status(200).json({
            success: true,
            message: "로그가 성공적으로 생성되었습니다.",
        });
    } catch (error) {
        console.error("Test log API error:", error);
        return res.status(500).json({
            success: false,
            error: "로그 생성 중 오류가 발생했습니다.",
        });
    }
}
