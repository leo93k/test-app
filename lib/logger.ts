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

        // 서버 사이드에서는 콘솔에 출력하고 로그 저장소에 직접 추가
        if (typeof window === "undefined") {
            console.log(logMessage);
            try {
                const { addLog } = await import("@/app/api/logs/logStore");
                addLog(logMessage, type);
            } catch (error) {
                console.error("Failed to add log to store:", error);
            }
        } else {
            // 클라이언트 사이드에서 API 호출
            try {
                await fetch("/api/logs", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        message: logMessage,
                        type,
                    }),
                });
            } catch (error) {
                console.error("Failed to send log:", error);
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
