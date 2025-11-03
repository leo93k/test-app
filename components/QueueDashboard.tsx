"use client";
import { useState, useEffect, useCallback } from "react";
import { browserQueue } from "@/lib/browserQueue";
import { useAppSelector, useAppDispatch } from "@/lib/hooks";
import { clearLogs } from "@/lib/slices/logsSlice";
import dayjs from "dayjs";
import "dayjs/locale/ko";

interface QueueStatus {
    queueLength: number;
    runningCount: number;
    maxConcurrent: number;
}

export default function QueueDashboard() {
    const dispatch = useAppDispatch();
    const logs = useAppSelector((state) => state.logs.logs);
    const [queueStatus, setQueueStatus] = useState<QueueStatus>({
        queueLength: 0,
        runningCount: 0,
        maxConcurrent: 10,
    });
    const [isAutoRefresh, setIsAutoRefresh] = useState(true);

    // 큐 상태 폴링 함수
    const pollQueueStatus = useCallback(async () => {
        try {
            const status = browserQueue.getQueueStatus();
            setQueueStatus(status);
        } catch (error) {
            console.error("Failed to fetch queue status:", error);
        }
    }, []);

    // 자동 새로고침 설정
    useEffect(() => {
        let statusInterval: NodeJS.Timeout;

        if (isAutoRefresh) {
            statusInterval = setInterval(pollQueueStatus, 1000); // 1초마다 큐 상태 폴링
        }

        return () => {
            if (statusInterval) clearInterval(statusInterval);
        };
    }, [isAutoRefresh, pollQueueStatus]);

    // 로그 삭제 함수
    const clearAllLogs = () => {
        dispatch(clearLogs());
    };

    // 수동 새로고침
    const handleRefresh = () => {
        pollQueueStatus();
    };

    // UTC 시간을 로컬 시간으로 변환하는 함수
    const formatLocalTime = (utcTimestamp: string) => {
        try {
            return dayjs(utcTimestamp)
                .locale("ko")
                .format("YYYY. MM. DD. HH:mm:ss");
        } catch {
            return utcTimestamp; // 변환 실패 시 원본 반환
        }
    };

    // 큐 사용률 계산
    const queueUsage =
        queueStatus.maxConcurrent > 0
            ? Math.round(
                  (queueStatus.runningCount / queueStatus.maxConcurrent) * 100
              )
            : 0;

    return (
        <div className="p-6">
            <div className="mb-6">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
                        📊 브라우저 큐 모니터링 대시보드
                    </h2>
                    <div className="flex gap-2">
                        <button
                            onClick={handleRefresh}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                        >
                            🔄 새로고침
                        </button>
                        <button
                            onClick={clearAllLogs}
                            className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-sm font-medium transition-colors"
                        >
                            🗑️ 로그 초기화
                        </button>
                        <button
                            onClick={() => setIsAutoRefresh(!isAutoRefresh)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                isAutoRefresh
                                    ? "bg-green-600 hover:bg-green-700 text-white"
                                    : "bg-red-600 hover:bg-red-700 text-white"
                            }`}
                        >
                            {isAutoRefresh
                                ? "⏸️ 자동 새로고침 중지"
                                : "▶️ 자동 새로고침 시작"}
                        </button>
                    </div>
                </div>
                <p className="text-gray-600 dark:text-gray-300">
                    브라우저 큐의 실시간 상태를 모니터링하고 로그를 확인할 수
                    있습니다.
                </p>
            </div>

            {/* 큐 상태 카드들 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                {/* 대기 중인 작업 */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border-l-4 border-blue-500">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
                                대기 중인 작업
                            </p>
                            <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                                {queueStatus.queueLength}
                            </p>
                        </div>
                        <div className="text-4xl text-blue-500">⏳</div>
                    </div>
                    <div className="mt-2">
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                            <div
                                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                                style={{
                                    width: `${Math.min(
                                        (queueStatus.queueLength / 50) * 100,
                                        100
                                    )}%`,
                                }}
                            ></div>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            큐 사용률:{" "}
                            {Math.min(
                                (queueStatus.queueLength / 50) * 100,
                                100
                            ).toFixed(1)}
                            %
                        </p>
                    </div>
                </div>

                {/* 실행 중인 작업 */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border-l-4 border-green-500">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
                                실행 중인 작업
                            </p>
                            <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                                {queueStatus.runningCount}
                            </p>
                        </div>
                        <div className="text-4xl text-green-500">🚀</div>
                    </div>
                    <div className="mt-2">
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                            <div
                                className="bg-green-500 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${queueUsage}%` }}
                            ></div>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            시스템 사용률: {queueUsage}%
                        </p>
                    </div>
                </div>

                {/* 최대 동시 실행 */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border-l-4 border-purple-500">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
                                최대 동시 실행
                            </p>
                            <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                                {queueStatus.maxConcurrent}
                            </p>
                        </div>
                        <div className="text-4xl text-purple-500">⚙️</div>
                    </div>
                    <div className="mt-2">
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                            <div
                                className="bg-purple-500 h-2 rounded-full transition-all duration-300"
                                style={{ width: "100%" }}
                            ></div>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            시스템 제한값
                        </p>
                    </div>
                </div>
            </div>

            {/* 시스템 상태 요약 */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-8">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
                    📈 시스템 상태 요약
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <h4 className="text-md font-medium text-gray-700 dark:text-gray-300 mb-2">
                            현재 상태
                        </h4>
                        <div className="space-y-2">
                            <div className="flex justify-between">
                                <span className="text-sm text-gray-600 dark:text-gray-400">
                                    전체 작업:
                                </span>
                                <span className="text-sm font-medium text-gray-800 dark:text-white">
                                    {queueStatus.queueLength +
                                        queueStatus.runningCount}
                                    개
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-sm text-gray-600 dark:text-gray-400">
                                    시스템 효율성:
                                </span>
                                <span className="text-sm font-medium text-gray-800 dark:text-white">
                                    {queueUsage}%
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-sm text-gray-600 dark:text-gray-400">
                                    대기 시간 예상:
                                </span>
                                <span className="text-sm font-medium text-gray-800 dark:text-white">
                                    {queueStatus.queueLength > 0
                                        ? `${Math.ceil(
                                              queueStatus.queueLength /
                                                  queueStatus.maxConcurrent
                                          )} 배치`
                                        : "즉시 실행 가능"}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div>
                        <h4 className="text-md font-medium text-gray-700 dark:text-gray-300 mb-2">
                            성능 지표
                        </h4>
                        <div className="space-y-2">
                            <div className="flex justify-between">
                                <span className="text-sm text-gray-600 dark:text-gray-400">
                                    큐 포화도:
                                </span>
                                <span
                                    className={`text-sm font-medium ${
                                        queueStatus.queueLength > 20
                                            ? "text-red-600 dark:text-red-400"
                                            : queueStatus.queueLength > 10
                                            ? "text-yellow-600 dark:text-yellow-400"
                                            : "text-green-600 dark:text-green-400"
                                    }`}
                                >
                                    {queueStatus.queueLength > 20
                                        ? "높음"
                                        : queueStatus.queueLength > 10
                                        ? "보통"
                                        : "낮음"}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-sm text-gray-600 dark:text-gray-400">
                                    시스템 부하:
                                </span>
                                <span
                                    className={`text-sm font-medium ${
                                        queueUsage > 80
                                            ? "text-red-600 dark:text-red-400"
                                            : queueUsage > 50
                                            ? "text-yellow-600 dark:text-yellow-400"
                                            : "text-green-600 dark:text-green-400"
                                    }`}
                                >
                                    {queueUsage > 80
                                        ? "높음"
                                        : queueUsage > 50
                                        ? "보통"
                                        : "낮음"}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-sm text-gray-600 dark:text-gray-400">
                                    자동 새로고침:
                                </span>
                                <span
                                    className={`text-sm font-medium ${
                                        isAutoRefresh
                                            ? "text-green-600 dark:text-green-400"
                                            : "text-red-600 dark:text-red-400"
                                    }`}
                                >
                                    {isAutoRefresh ? "활성" : "비활성"}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 실시간 로그 */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
                        📋 실시간 로그
                    </h3>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={clearAllLogs}
                            className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg transition-colors"
                            disabled={logs.length === 0}
                        >
                            🗑️ 전체 삭제
                        </button>
                        <div
                            className={`w-3 h-3 rounded-full ${
                                isAutoRefresh
                                    ? "bg-green-500 animate-pulse"
                                    : "bg-gray-400"
                            }`}
                        ></div>
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                            {isAutoRefresh ? "실시간 업데이트 중" : "수동 모드"}
                        </span>
                    </div>
                </div>
                <div className="max-h-96 overflow-y-auto space-y-2 bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                    {logs.length === 0 ? (
                        <div className="text-center py-8">
                            <div className="text-4xl text-gray-400 mb-2">
                                📝
                            </div>
                            <p className="text-gray-500 dark:text-gray-400">
                                로그를 기다리는 중...
                            </p>
                            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                                브라우저 실행 시 로그가 여기에 표시됩니다.
                            </p>
                        </div>
                    ) : (
                        logs.map((log) => (
                            <div
                                key={log.id}
                                className={`p-3 rounded-lg text-sm border-l-4 ${
                                    log.type === "success"
                                        ? "bg-green-50 dark:bg-green-900 border-green-400 text-green-800 dark:text-green-200"
                                        : log.type === "error"
                                        ? "bg-red-50 dark:bg-red-900 border-red-400 text-red-800 dark:text-red-200"
                                        : "bg-blue-50 dark:bg-blue-900 border-blue-400 text-blue-800 dark:text-blue-200"
                                }`}
                            >
                                <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                        <span className="font-medium">
                                            {log.type === "success"
                                                ? "✅"
                                                : log.type === "error"
                                                ? "❌"
                                                : "ℹ️"}{" "}
                                            {log.message}
                                        </span>
                                    </div>
                                    <span className="font-mono text-xs opacity-75 ml-2">
                                        {formatLocalTime(log.timestamp)}
                                    </span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
