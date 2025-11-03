import { NextApiRequest, NextApiResponse } from "next";
import { Server as HTTPServer } from "http";
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
    // Socket.io 서버 초기화 (서비스 레이어에서 처리)
    await initializeSocketServer(res.socket.server);

    res.end();
}
