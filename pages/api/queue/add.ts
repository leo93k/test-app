import { NextApiRequest, NextApiResponse } from "next";
import { Server as HTTPServer } from "http";
import { getServerQueue } from "@/service/queue/browserQueue";
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
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    // Socket.io 서버 초기화 (로깅을 위해)
    await initializeSocketServer(res.socket.server);

    try {
        const {
            url,
            headless = false,
            username,
            password,
            sessionId,
            friendRequest = false,
            message = "",
        } = req.body;

        if (!url) {
            return res.status(400).json({ error: "URL이 필요합니다." });
        }

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

        // 큐 상태 확인
        const status = queue.getQueueStatus();
        console.log(`[Queue Add] 작업 추가 완료: ${queueId}, 상태:`, status);

        return res.status(200).json({
            success: true,
            queueId,
            message: "큐에 작업이 추가되었습니다.",
            status, // 현재 큐 상태도 함께 반환
        });
    } catch (error) {
        console.error("Queue add error:", error);
        return res.status(500).json({
            success: false,
            error:
                error instanceof Error
                    ? error.message
                    : "알 수 없는 오류가 발생했습니다.",
        });
    }
}
