import type { Server as HTTPServer } from "http";
import { SOCKET_EVENTS } from "@/const/socketEvents";

// 서버 사이드 타입 정의 (socket.io는 동적 import로 처리)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SocketIOServer = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ServerSocket = any;

// 글로벌 HTTP 서버 인스턴스 저장 (Pages Router에서 설정)
let globalHttpServer: HTTPServer | null = null;

/**
 * 서버 사이드: Socket.io 서버 관리 클래스
 * 서버 환경에서만 사용됩니다.
 */
class SocketServer {
    private static instance: SocketServer;
    private serverSocket: SocketIOServer | null = null;

    private constructor() {
        // 싱글톤 패턴
    }

    public static getInstance(): SocketServer {
        if (!SocketServer.instance) {
            SocketServer.instance = new SocketServer();
        }
        return SocketServer.instance;
    }

    /**
     * 서버 사이드: Socket.io 서버 인스턴스 설정
     */
    public setServer(server: SocketIOServer | null): void {
        this.serverSocket = server;
    }

    /**
     * 서버 사이드: Socket.io 서버 인스턴스 가져오기
     * 없으면 HTTP 서버 인스턴스를 사용해서 자동 초기화 시도
     */
    public async getServer(): Promise<SocketIOServer | null> {
        // 이미 초기화된 서버가 있으면 반환
        if (this.serverSocket) {
            return this.serverSocket;
        }

        // HTTP 서버 인스턴스가 저장되어 있으면 자동 초기화 시도
        if (globalHttpServer) {
            return await this.initializeServer(globalHttpServer);
        }

        return null;
    }

    /**
     * 동기 버전: Socket.io 서버 인스턴스 가져오기 (호환성 유지)
     */
    public getServerSync(): SocketIOServer | null {
        return this.serverSocket;
    }

    /**
     * 서버 사이드: Socket.io 서버 초기화
     * Next.js Pages Router API Route에서 사용됩니다.
     */
    public async initializeServer(
        httpServer: HTTPServer
    ): Promise<SocketIOServer | null> {
        // HTTP 서버 인스턴스 저장 (나중에 자동 초기화에 사용)
        globalHttpServer = httpServer;

        // 이미 초기화된 서버가 있으면 반환
        if (this.serverSocket) {
            console.log("Socket.io server already running.");
            return this.serverSocket;
        }

        // HTTP 서버에 이미 Socket.io가 연결되어 있는지 확인
        const serverWithIO = httpServer as HTTPServer & { io?: SocketIOServer };
        if (serverWithIO.io) {
            console.log("Socket.io server already attached to HTTP server.");
            this.serverSocket = serverWithIO.io;
            return this.serverSocket;
        }

        // 서버 전용 코드는 동적 import로 처리 (클라이언트 번들에서 제외)
        const { Server: SocketIOServerImpl } = await import("socket.io");

        // 새 Socket.io 서버 생성
        console.log("Socket.io server starting...");
        const io = new SocketIOServerImpl(httpServer, {
            cors: {
                origin:
                    process.env.NODE_ENV === "production"
                        ? process.env.NEXT_PUBLIC_APP_URL || "*"
                        : "http://localhost:3000",
                methods: ["GET", "POST"],
            },
            path: "/api/socket.io",
        });

        // HTTP 서버에 Socket.io 인스턴스 연결
        serverWithIO.io = io;
        this.serverSocket = io;

        // 전역 Socket.io 인스턴스 설정 (Logger에서 사용)
        this.setServer(io);

        // 이벤트 핸들러 등록
        io.on("connection", (socket: ServerSocket) => {
            console.log("🔌 Server: A user connected:", socket.id);
            console.log(
                "🔌 Server: Total connected clients:",
                io?.sockets.sockets.size || 0
            );

            // 클라이언트가 sessionId를 전송하면 저장 및 room에 추가
            socket.on(SOCKET_EVENTS.JOIN_SESSION, (sessionId: string) => {
                socket.data.sessionId = sessionId;
                // sessionId를 room 이름으로 사용하여 그룹화
                socket.join(sessionId);
                console.log(
                    `🔗 Socket ${socket.id} joined session: ${sessionId}`
                );
            });

            // 로그 수신 핸들러 (클라이언트 간 브로드캐스트는 제거)
            socket.on(
                SOCKET_EVENTS.LOG,
                (data: {
                    message: string;
                    type: string;
                    timestamp: string;
                }) => {
                    // 클라이언트 간 로그 브로드캐스트 제거 (세션 분리)
                    // socket.broadcast.emit(SOCKET_EVENTS.LOG, data);
                }
            );

            // 서버에서 로그를 클라이언트에게 전송
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            socket.on("disconnect", (reason: any) => {
                console.log(
                    "🔌 Server: A user disconnected:",
                    socket.id,
                    "Reason:",
                    reason
                );
                console.log(
                    "🔌 Server: Remaining connected clients:",
                    io?.sockets.sockets.size || 0
                );
            });
        });

        console.log("Socket.io server started successfully");
        return io;
    }
}

// 싱글톤 인스턴스 export
export const socketServer = SocketServer.getInstance();

// 서버 사이드 wrapper 함수들
export function setSocketServer(server: SocketIOServer | null): void {
    socketServer.setServer(server);
}

/**
 * Socket.io 서버 인스턴스 가져오기 (비동기)
 * 없으면 자동 초기화 시도
 */
export async function getSocketServer(): Promise<SocketIOServer | null> {
    return await socketServer.getServer();
}

/**
 * Socket.io 서버 인스턴스 가져오기 (동기, 호환성 유지)
 */
export function getSocketServerSync(): SocketIOServer | null {
    return socketServer.getServerSync();
}

/**
 * 서버 사이드: Socket.io 서버 초기화
 * Next.js Pages Router API Route에서 사용됩니다.
 */
export async function initializeSocketServer(
    httpServer: HTTPServer
): Promise<SocketIOServer | null> {
    return socketServer.initializeServer(httpServer);
}
