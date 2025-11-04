import { store } from "../lib/store";
import { addLog } from "../lib/store/logsSlice";

// 최대 로그 개수 상수
export const MAX_LOGS = 100;

// Logger 클래스
export class Logger {
    private static instance: Logger;
    private sessionId: string;

    private constructor(sessionId: string) {
        this.sessionId = sessionId;
    }

    public static getInstance(sessionId: string): Logger {
        if (!Logger.instance) {
            Logger.instance = new Logger(sessionId);
        } else {
            // 기존 인스턴스가 있으면 sessionId 업데이트
            Logger.instance.sessionId = sessionId;
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

            // WebSocket 서버가 있으면 해당 세션의 클라이언트에만 전송 (동적 import로 서버 사이드만)
            try {
                const { getSocketServer } = await import("./socket");
                // getSocketServer()가 null을 반환하면 자동으로 초기화 시도
                const io = await getSocketServer();
                if (io) {
                    // 해당 sessionId를 가진 소켓만 찾아서 전송
                    const sockets = await io.fetchSockets();
                    const targetSockets = sockets.filter(
                        (socket: any) =>
                            socket.data?.sessionId === this.sessionId
                    );

                    if (targetSockets.length > 0) {
                        const logData = {
                            message: logMessage,
                            type,
                            timestamp: new Date().toISOString(),
                        };

                        // 해당 세션의 소켓들에만 전송
                        targetSockets.forEach((socket: any) => {
                            socket.emit("log", logData);
                        });
                    }
                } else {
                    // Socket.io 서버 초기화 실패 (HTTP 서버 인스턴스가 없음)
                    // Pages Router의 /api/socket이 먼저 호출되어야 함
                }
            } catch {
                // 동적 import 실패는 드물지만, 발생하면 에러 로그만 출력
                // console.error("❌ Failed to send log via WebSocket:", error);
            }
        } else {
            // 클라이언트 사이드에서 Redux store에 직접 추가
            try {
                store.dispatch(
                    addLog({
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
