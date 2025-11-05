import { NextApiRequest, NextApiResponse } from "next";
import { Server as HTTPServer } from "http";
import { getServerQueue } from "@/service/queue/browserQueue";
import { validateUrl, sendValidationError } from "@/lib/utils/validation";
import { initializeSocketServer } from "@/service/socket";

type NextApiResponseWithSocket = NextApiResponse & {
    socket: {
        server: HTTPServer;
    };
};

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponseWithSocket
) {
    // POST 메서드만 허용
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    // Socket.io 서버 초기화 (로깅을 위해)
    await initializeSocketServer(res.socket.server);

    try {
        const {
            url,
            username,
            password,
            headless = false,
            friendRequest = false,
            message = "",
            sessionId,
        } = req.body;

        // URL 유효성 검사
        const urlError = validateUrl(url);
        if (urlError) {
            return sendValidationError(res, urlError);
        }

        // 큐에 작업 추가 (비동기로 처리)
        const queue = getServerQueue();
        const queueId = await queue.add({
            url,
            headless,
            username,
            password,
            sessionId,
            friendRequest,
            message,
        });

        // 큐에 추가되었음을 즉시 응답
        return res.status(200).json({
            success: true,
            queueId,
            message: "큐에 작업이 추가되었습니다.",
        });
    } catch (error) {
        console.error("Crawl API error:", error);
        return res.status(500).json({
            success: false,
            error:
                error instanceof Error
                    ? error.message
                    : "알 수 없는 오류가 발생했습니다.",
        });
    }
}
