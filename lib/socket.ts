import { io, Socket } from "socket.io-client";
import { SOCKET_EVENTS } from "@/const/socketEvents";

/**
 * 클라이언트 사이드: Socket.io 클라이언트 관리
 * 브라우저 환경에서만 사용됩니다.
 */
class SocketClient {
    private static instance: SocketClient;
    private clientSocket: Socket | null = null;

    private constructor() {
        // 싱글톤 패턴
    }

    public static getInstance(): SocketClient {
        if (!SocketClient.instance) {
            SocketClient.instance = new SocketClient();
        }
        return SocketClient.instance;
    }

    /**
     * Socket.io 클라이언트 연결
     */
    public connect(): Socket {
        // 서버 사이드에서는 사용 불가
        if (typeof window === "undefined") {
            throw new Error(
                "connect()는 클라이언트 사이드에서만 사용할 수 있습니다."
            );
        }

        // 이미 연결된 socket이 있으면 재사용
        if (this.clientSocket?.connected) {
            console.log(
                "♻️ Reusing existing socket connection:",
                this.clientSocket.id
            );
            return this.clientSocket;
        }

        // socket이 존재하지만 연결되지 않은 경우, 연결 대기
        if (this.clientSocket && !this.clientSocket.connected) {
            console.log(
                "⏳ Socket exists but not connected, waiting for connection..."
            );
            return this.clientSocket;
        }

        // 새 socket 생성
        console.log("🆕 Creating new socket connection...");

        // Next.js 개발 환경에서는 localhost, 프로덕션에서는 환경변수 사용
        const socketUrl =
            window.location.origin ||
            process.env.NEXT_PUBLIC_SOCKET_URL ||
            "http://localhost:3000";

        this.clientSocket = io(socketUrl, {
            path: "/api/socket.io",
            transports: ["websocket", "polling"],
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            reconnectionAttempts: 5,
        });

        // 이벤트 리스너는 한 번만 등록
        this.clientSocket.once("connect", () => {
            console.log(
                "✅ Socket.io client connected:",
                this.clientSocket?.id
            );
            console.log("🔗 Socket URL:", socketUrl);
            console.log("🔗 Socket path:", "/api/socket.io");
        });

        this.clientSocket.on("disconnect", (reason) => {
            console.log(
                "❌ Socket.io client disconnected:",
                reason,
                "Socket ID:",
                this.clientSocket?.id
            );
        });

        this.clientSocket.on("connect_error", (error) => {
            console.error("❌ Socket.io connection error:", error);
        });

        this.clientSocket.on("reconnect", (attemptNumber) => {
            console.log(
                "🔄 Socket.io reconnected after",
                attemptNumber,
                "attempts. New ID:",
                this.clientSocket?.id
            );
        });

        // 모든 이벤트 디버깅 (개발 환경에서만)
        if (process.env.NODE_ENV === "development") {
            this.clientSocket.onAny((eventName, ...args) => {
                if (eventName === SOCKET_EVENTS.LOG) {
                    console.log("🔍 Socket.io received 'log' event:", args[0]);
                }
            });
        }

        return this.clientSocket;
    }

    /**
     * 현재 연결된 Socket 인스턴스 가져오기
     */
    public getSocket(): Socket | null {
        return this.clientSocket;
    }
}

// 싱글톤 인스턴스 export
export const socketClient = SocketClient.getInstance();

// 기존 함수 호환성을 위한 wrapper 함수
export function connectSocket(): Socket {
    return socketClient.connect();
}
