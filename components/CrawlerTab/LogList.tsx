"use client";
import { useAppSelector, useAppDispatch } from "@/lib/hooks";
import { clearLogs } from "@/lib/store/logsSlice";
import { MAX_LOGS } from "@/service/logger";
import dayjs from "dayjs";
import "dayjs/locale/ko";

export default function LogList() {
    const dispatch = useAppDispatch();
    const logs = useAppSelector((state) => state.logs.logs);

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
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 min-h-50 ">
            <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
                        📋 실시간 로그
                    </h3>
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                        {logs.length}개 / {MAX_LOGS}개
                    </span>
                </div>
                <button
                    onClick={clearAllLogs}
                    className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg transition-colors"
                    disabled={logs.length === 0}
                >
                    🗑️ 전체 삭제
                </button>
            </div>
            <div className="max-h-100 overflow-y-auto space-y-2">
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
    );
}
