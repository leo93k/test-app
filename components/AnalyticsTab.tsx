"use client";
import { useState } from "react";
import { browserQueue } from "@/lib/browserQueue";
import { Logger } from "@/service/logger";
import { useAppSelector, useAppDispatch } from "@/lib/hooks";
import { clearLogs } from "@/lib/store/logsSlice";
import dayjs from "dayjs";
import "dayjs/locale/ko";
import dynamic from "next/dynamic";

function AnalyticsContent() {
    const dispatch = useAppDispatch();
    const logs = useAppSelector((state) => state.logs.logs);
    const [url, setUrl] = useState("");
    const [count, setCount] = useState(2);
    // 운영 환경에서는 무조건 백그라운드로 고정
    const isProduction = process.env.NODE_ENV === "production";
    const [headless, setHeadless] = useState(true);

    // 운영 환경에서는 항상 headless로 고정
    const effectiveHeadless = isProduction ? true : headless;
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

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

    // 로그 삭제 함수
    const clearAllLogs = () => {
        dispatch(clearLogs());
    };

    const handleRun = async () => {
        if (!url.trim()) {
            setError("URL을 입력해주세요.");
            return;
        }

        if (count < 1 || count > 100) {
            setError("횟수는 1~100 사이의 숫자를 입력해주세요.");
            return;
        }

        setLoading(true);
        setError("");
        dispatch(clearLogs());

        try {
            // 시작 로그
            const logger = Logger.getInstance("analytics");
            // await logger.info(`🚀 ${count}개의 브라우저를 큐에 추가합니다...`);
            await logger.info(`작업을 시작합니다1`);
            await logger.info(`작업을 시작합니다2`);
            await logger.info(`작업을 시작합니다3`);

            // 큐에 작업들을 추가
            const promises = Array.from({ length: count }, (_, index) => {
                const browserNumber = index + 1;
                return browserQueue
                    .add(url.trim(), effectiveHeadless)
                    .then(async (result) => {
                        // 각 브라우저가 완료되는 대로 즉시 로그 표시
                        const logger = Logger.getInstance("analytics");
                        await logger.success(
                            `✅ 브라우저 ${browserNumber} 완료: ${url.trim()}`
                        );
                        return { url: url.trim(), browserNumber, result };
                    })
                    .catch(async (error) => {
                        // 에러 발생 시 즉시 로그 표시
                        const logger = Logger.getInstance("analytics");
                        await logger.error(
                            `❌ 브라우저 ${browserNumber} 실패: ${error.message}`
                        );
                        throw new Error(
                            `브라우저 ${browserNumber} 실행 실패: ${error.message}`
                        );
                    });
            });

            // 모든 브라우저 실행 완료 대기 (에러 처리용)
            const results = await Promise.allSettled(promises);

            // 최종 완료 로그
            const successCount = results.filter(
                (r) => r.status === "fulfilled"
            ).length;
            const failCount = results.filter(
                (r) => r.status === "rejected"
            ).length;

            await logger.success(
                `🎉 브라우저 실행 완료! 성공: ${successCount}개, 실패: ${failCount}개`
            );
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "알 수 없는 오류가 발생했습니다."
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-6">
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">
                    🌐 브라우저 실행
                </h2>
                <p className="text-gray-600 dark:text-gray-300">
                    주소와 횟수를 입력하면 같은 사이트를 원하는 개수만큼
                    브라우저 창으로 띄우고, 2초 후 자동으로 닫힙니다.
                </p>
            </div>

            {/* 입력 폼 */}
            <div className="max-w-4xl mx-auto mb-8">
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
                        다중 브라우저 실행 설정
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-4">
                        <div className="md:col-span-7">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                실행할 주소 (URL)
                            </label>
                            <input
                                type="url"
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                placeholder="https://example.com"
                                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                                disabled={loading}
                            />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                실행횟수
                            </label>
                            <input
                                type="number"
                                value={count}
                                onChange={(e) =>
                                    setCount(parseInt(e.target.value) || 0)
                                }
                                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                                disabled={loading}
                            />
                        </div>
                        <div className="md:col-span-3">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                실행 모드
                            </label>
                            <select
                                value={
                                    effectiveHeadless ? "headless" : "visible"
                                }
                                onChange={(e) =>
                                    setHeadless(e.target.value === "headless")
                                }
                                disabled={
                                    loading ||
                                    process.env.NODE_ENV === "production"
                                }
                                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <option value="visible">
                                    👁️ 브라우저 표시
                                </option>
                                <option value="headless">
                                    🚫 백그라운드 실행
                                </option>
                            </select>
                            {process.env.NODE_ENV === "production" && (
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    운영 환경에서는 백그라운드 실행 모드만 사용
                                    가능합니다.
                                </p>
                            )}
                        </div>
                    </div>
                    <div className="flex justify-center">
                        <button
                            onClick={handleRun}
                            disabled={loading}
                            className="px-8 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
                        >
                            실행
                        </button>
                    </div>

                    {/* 에러 메시지 표시 */}
                    {error && (
                        <div className="mt-4 p-4 bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-200 rounded-lg">
                            {error}
                        </div>
                    )}

                    {/* 실시간 로그 표시 */}
                    <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
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
                                        <span className="ml-2">
                                            {log.message}
                                        </span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Dynamic import로 클라이언트에서만 로드
export default dynamic(() => Promise.resolve(AnalyticsContent), {
    ssr: false,
    loading: () => (
        <div className="p-6">
            <div className="text-center">
                <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-4 text-gray-600 dark:text-gray-300">
                    로딩 중...
                </p>
            </div>
        </div>
    ),
});
