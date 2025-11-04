"use client";
import { useState, useEffect } from "react";
import { Logger } from "@/service/logger";
import { useSocket } from "@/lib/hooks/useSocket";
import type { Socket } from "socket.io-client";

// 소켓 연결 상태를 실제로 확인하는 컴포넌트
function SocketConnectionStatus() {
    const { isConnected, socketId } = useSocket();
    const [actualConnected, setActualConnected] = useState(false);
    const [actualSocketId, setActualSocketId] = useState<string | null>(null);

    useEffect(() => {
        const checkConnection = async () => {
            const { connectSocket } = await import("@/lib/socket");
            const socket = connectSocket();
            setActualConnected(socket.connected);
            setActualSocketId(socket.id || null);
        };

        // 초기 상태 확인
        checkConnection();

        // 소켓 인스턴스 가져오기 및 이벤트 리스너 등록
        let socket: Socket | null = null;
        const initSocket = async () => {
            const { connectSocket } = await import("@/lib/socket");
            socket = connectSocket();

            // 소켓 연결 상태 변경 시 업데이트
            const updateStatus = () => {
                if (socket) {
                    setActualConnected(socket.connected);
                    setActualSocketId(socket.id || null);
                }
            };

            socket.on("connect", updateStatus);
            socket.on("disconnect", updateStatus);

            // 주기적으로 상태 확인 (소켓 상태가 변경되었을 수 있으므로)
            const interval = setInterval(checkConnection, 1000);

            return () => {
                if (socket) {
                    socket.off("connect", updateStatus);
                    socket.off("disconnect", updateStatus);
                }
                clearInterval(interval);
            };
        };

        let cleanup: (() => void) | undefined;
        initSocket().then((cleanupFn) => {
            cleanup = cleanupFn;
        });

        return () => {
            if (cleanup) cleanup();
        };
    }, []);

    // 실제 연결 상태와 훅 상태 중 실제 상태를 우선 사용
    const connected = actualConnected || isConnected;
    const displaySocketId = actualSocketId || socketId;

    return (
        <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                        <div
                            className={`w-3 h-3 rounded-full ${
                                connected
                                    ? "bg-green-500 animate-pulse"
                                    : "bg-red-500"
                            }`}
                        ></div>
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Socket.io 연결 상태:
                        </span>
                        <span
                            className={`text-sm font-semibold ${
                                connected
                                    ? "text-green-600 dark:text-green-400"
                                    : "text-red-600 dark:text-red-400"
                            }`}
                        >
                            {connected ? "연결됨" : "연결 안됨"}
                        </span>
                    </div>
                </div>
                {connected && displaySocketId && (
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                            Socket ID:
                        </span>
                        <span className="text-xs font-mono bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded text-gray-800 dark:text-gray-200">
                            {displaySocketId}
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function LogTestSection() {
    const [apiTestLoading, setApiTestLoading] = useState(false);
    const { sessionId } = useSocket();

    // 로그 테스트 함수들
    const handleTestLog = async (type: "info" | "success" | "error") => {
        const logger = Logger.getInstance("test");
        const messages = {
            info: "📝 정보 로그 테스트 메시지입니다.",
            success: "✅ 성공 로그 테스트 메시지입니다.",
            error: "❌ 에러 로그 테스트 메시지입니다.",
        };
        await logger[type](messages[type]);
    };

    // API를 통한 로그 테스트 (서버에서 WebSocket으로 전달)
    const handleTestApiLog = async (type: "info" | "success" | "error") => {
        setApiTestLoading(true);
        try {
            // useSocket에서 생성한 sessionId 사용 (항상 생성되므로 null 체크만)
            if (!sessionId) {
                throw new Error(
                    "Socket sessionId가 없습니다. 소켓 연결을 확인해주세요."
                );
            }

            // 소켓 초기화 (없으면 생성, 있으면 재사용)
            const { ensureSocketInitialized } = await import(
                "@/lib/utils/socketInit"
            );
            const socketInitialized = await ensureSocketInitialized(sessionId);
            if (!socketInitialized) {
                throw new Error(
                    "소켓이 연결되지 않았습니다. 소켓 연결을 확인해주세요."
                );
            }

            const response = await fetch("/api/test-log", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    type,
                    sessionId: sessionId, // useSocket에서 가져온 sessionId 사용
                }),
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || "API 호출 실패");
            }
        } catch (error) {
            console.error("API test log error:", error);
            const logger = Logger.getInstance("test");
            await logger.error(
                `❌ API 로그 테스트 실패: ${
                    error instanceof Error ? error.message : "알 수 없는 오류"
                }`
            );
        } finally {
            setApiTestLoading(false);
        }
    };

    return (
        <div className="mb-6 p-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
                🧪 로그 테스트
            </h3>

            {/* Socket.io 연결 상태 표시 */}
            <SocketConnectionStatus />

            {/* 클라이언트 로그 테스트 */}
            <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    📱 클라이언트 로그 테스트
                </h4>
                <div className="flex gap-3 flex-wrap">
                    <button
                        onClick={() => handleTestLog("info")}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                    >
                        📝 Info 로그 생성
                    </button>
                    <button
                        onClick={() => handleTestLog("success")}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
                    >
                        ✅ Success 로그 생성
                    </button>
                    <button
                        onClick={() => handleTestLog("error")}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
                    >
                        ❌ Error 로그 생성
                    </button>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    클라이언트에서 직접 생성되는 로그입니다.
                </p>
            </div>

            {/* API 로그 테스트 (WebSocket 실시간 전달) */}
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    🌐 API 로그 테스트 (실시간 WebSocket 전달)
                </h4>
                <div className="flex gap-3 flex-wrap">
                    <button
                        onClick={() => handleTestApiLog("info")}
                        disabled={apiTestLoading}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
                    >
                        {apiTestLoading ? "전송 중..." : "📡 API Info 로그"}
                    </button>
                    <button
                        onClick={() => handleTestApiLog("success")}
                        disabled={apiTestLoading}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
                    >
                        {apiTestLoading ? "전송 중..." : "📡 API Success 로그"}
                    </button>
                    <button
                        onClick={() => handleTestApiLog("error")}
                        disabled={apiTestLoading}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
                    >
                        {apiTestLoading ? "전송 중..." : "📡 API Error 로그"}
                    </button>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    API를 호출하면 서버에서 로그가 생성되고, WebSocket을 통해
                    실시간으로 클라이언트에 전달됩니다.
                </p>
            </div>
        </div>
    );
}
