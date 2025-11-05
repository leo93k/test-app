import { NextApiRequest, NextApiResponse } from "next";
import { getServerQueue } from "@/service/queue/browserQueue";

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method !== "GET") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    try {
        const queue = getServerQueue();
        const status = queue.getQueueStatus();

        // 디버깅을 위한 로그
        console.log(`[Queue Status] ${JSON.stringify(status)}`);

        return res.status(200).json({
            success: true,
            ...status,
        });
    } catch (error) {
        console.error("Queue status error:", error);
        return res.status(500).json({
            success: false,
            error:
                error instanceof Error
                    ? error.message
                    : "알 수 없는 오류가 발생했습니다.",
        });
    }
}
