import { store } from "../lib/store";
import { addLog } from "../lib/store/logsSlice";
import { SOCKET_EVENTS } from "@/const/socketEvents";

// Logger 클래스
export class Logger {
    // sessionId별 Logger 인스턴스 관리 (Map 방식으로 변경)
    private static instances: Map<string, Logger> = new Map();
    private sessionId: string;

    private constructor(sessionId: string) {
        this.sessionId = sessionId;
    }

    public static getInstance(sessionId: string): Logger {
        // 이미 해당 sessionId의 Logger가 있으면 재사용
        if (Logger.instances.has(sessionId)) {
            return Logger.instances.get(sessionId)!;
        }

        // 새 Logger 인스턴스 생성
        const logger = new Logger(sessionId);
        Logger.instances.set(sessionId, logger);
        return logger;
    }

    // 특정 sessionId의 Logger 인스턴스 제거 (메모리 관리)
    public static removeInstance(sessionId: string): void {
        Logger.instances.delete(sessionId);
    }

    // 모든 Logger 인스턴스 제거
    public static clearAll(): void {
        Logger.instances.clear();
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
                        (socket: {
                            data?: { sessionId?: string };
                            emit: (event: string, data: unknown) => void;
                        }) =>
                            (socket.data as { sessionId?: string })
                                ?.sessionId === this.sessionId
                    );

                    if (targetSockets.length > 0) {
                        const logData = {
                            message: logMessage,
                            type,
                            timestamp: new Date().toISOString(),
                        };

                        // 해당 세션의 소켓들에만 전송
                        targetSockets.forEach(
                            (socket: {
                                emit: (event: string, data: unknown) => void;
                            }) => {
                                socket.emit(SOCKET_EVENTS.LOG, logData);
                            }
                        );
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
