import { store } from "./store";
import { addLog as addLogAction } from "./slices/logsSlice";

export class Logger {
    private static instance: Logger;
    private sessionId: string;

    private constructor(sessionId: string) {
        this.sessionId = sessionId;
    }

    public static getInstance(sessionId: string): Logger {
        if (!Logger.instance) {
            Logger.instance = new Logger(sessionId);
        }
        return Logger.instance;
    }

    public async log(
        message: string,
        type: "info" | "success" | "error" = "info"
    ) {
        const timestamp = new Date().toLocaleTimeString("ko-KR");
        const logMessage = `[${timestamp}] ${message}`;

        // 서버 사이드에서는 콘솔 출력 + WebSocket으로 전송
        if (typeof window === "undefined") {
            console.log(logMessage);

            // WebSocket 서버가 있으면 클라이언트에 전송 (동적 import로 서버 사이드만)
            try {
                const { getSocketServer } = await import("../service/socket");
                const io = getSocketServer();
                if (io) {
                    io.emit("log", {
                        message: logMessage,
                        type,
                        timestamp: new Date().toISOString(),
                    });
                    console.log("✅ Log sent via WebSocket:", logMessage);
                } else {
                    console.warn(
                        "⚠️ Socket.io server not initialized. Make sure /api/socket has been called."
                    );
                }
            } catch (error) {
                console.error("❌ Failed to send log via WebSocket:", error);
            }
        } else {
            // 클라이언트 사이드에서 Redux store에 직접 추가
            try {
                store.dispatch(
                    addLogAction({
                        message: logMessage,
                        type,
                    })
                );
            } catch (error) {
                console.error("Failed to add log to store:", error);
            }
        }
    }

    public async info(message: string) {
        await this.log(message, "info");
    }

    public async success(message: string) {
        await this.log(message, "success");
    }

    public async error(message: string) {
        await this.log(message, "error");
    }
}
