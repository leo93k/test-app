"use client";
import { useState } from "react";
import { useAppSelector, useAppDispatch } from "@/lib/hooks";
import { clearLogs } from "@/lib/slices/logsSlice";
import { useSocket } from "@/lib/hooks/useSocket";
import { Logger } from "@/lib/logger";
import dayjs from "dayjs";
import "dayjs/locale/ko";

export default function LogsDisplay() {
    const dispatch = useAppDispatch();
    const logs = useAppSelector((state) => state.logs.logs);
    const [apiTestLoading, setApiTestLoading] = useState(false);
    const { isConnected, socketId } = useSocket(); // WebSocket 연결 및 로그 수신 (서버 초기화 포함)

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
            // 약간의 지연 후 테스트 로그 API 호출
            await new Promise((resolve) => setTimeout(resolve, 100));

            const response = await fetch("/api/test-log", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ type }),
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

    const formatLocalTime = (utcTimestamp: string) => {
        try {
            return dayjs(utcTimestamp)
                .locale("ko")
                .format("YYYY. MM. DD. HH:mm:ss");
        } catch {
            return utcTimestamp;
        }
    };

    const clearAllLogs = () => {
        dispatch(clearLogs());
    };

    return (
        <div className="max-w-4xl mx-auto">
            {/* 로그 테스트 섹션 */}
            <div className="mb-6 p-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
                    🧪 로그 테스트
                </h3>

                {/* Socket.io 연결 상태 표시 */}
                <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2">
                                <div
                                    className={`w-3 h-3 rounded-full ${
                                        isConnected
                                            ? "bg-green-500 animate-pulse"
                                            : "bg-red-500"
                                    }`}
                                ></div>
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Socket.io 연결 상태:
                                </span>
                                <span
                                    className={`text-sm font-semibold ${
                                        isConnected
                                            ? "text-green-600 dark:text-green-400"
                                            : "text-red-600 dark:text-red-400"
                                    }`}
                                >
                                    {isConnected ? "연결됨" : "연결 안됨"}
                                </span>
                            </div>
                        </div>
                        {isConnected && socketId && (
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                    Socket ID:
                                </span>
                                <span className="text-xs font-mono bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded text-gray-800 dark:text-gray-200">
                                    {socketId}
                                </span>
                            </div>
                        )}
                    </div>
                </div>

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
                            {apiTestLoading
                                ? "전송 중..."
                                : "📡 API Success 로그"}
                        </button>
                        <button
                            onClick={() => handleTestApiLog("error")}
                            disabled={apiTestLoading}
                            className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
                        >
                            {apiTestLoading
                                ? "전송 중..."
                                : "📡 API Error 로그"}
                        </button>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                        API를 호출하면 서버에서 로그가 생성되고, WebSocket을
                        통해 실시간으로 클라이언트에 전달됩니다.
                    </p>
                </div>
            </div>

            {/* 로그 표시 영역 */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
                <div className="flex justify-between items-center mb-3">
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
                        📋 실시간 로그
                    </h3>
                    <button
                        onClick={clearAllLogs}
                        className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg transition-colors"
                        disabled={logs.length === 0}
                    >
                        🗑️ 전체 삭제
                    </button>
                </div>
                <div className="max-h-64 overflow-y-auto space-y-2">
                    {logs.length === 0 ? (
                        <p className="text-gray-500 dark:text-gray-400 text-sm">
                            로그를 기다리는 중...
                        </p>
                    ) : (
                        logs.map((log) => (
                            <div
                                key={log.id}
                                className={`p-2 rounded text-sm ${
                                    log.type === "success"
                                        ? "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200"
                                        : log.type === "error"
                                        ? "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200"
                                        : "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200"
                                }`}
                            >
                                <span className="font-mono text-xs opacity-75">
                                    {formatLocalTime(log.timestamp)}
                                </span>
                                <span className="ml-2">{log.message}</span>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
