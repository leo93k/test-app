"use client";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAppSelector, useAppDispatch } from "@/lib/hooks";
import {
    setMaxConcurrent,
    setAutoCloseDelay,
    setLogRetentionDays,
    setEnableAutoRefresh,
    setRefreshInterval,
    resetSettings,
    loadSettings,
} from "@/lib/slices/settingsSlice";
import dayjs from "dayjs";
import "dayjs/locale/ko";
import dynamic from "next/dynamic";

function SettingsContent() {
    const dispatch = useAppDispatch();
    const {
        maxConcurrent,
        autoCloseDelay,
        logRetentionDays,
        enableAutoRefresh,
        refreshInterval,
    } = useAppSelector((state) => state.settings);

    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState("");

    // 설정 로드 함수
    const loadSettingsFromStorage = () => {
        try {
            const savedSettings = localStorage.getItem("app-settings");
            if (savedSettings) {
                const settings = JSON.parse(savedSettings);
                dispatch(
                    loadSettings({
                        maxConcurrent: settings.maxConcurrent || 10,
                        autoCloseDelay: settings.autoCloseDelay || 0.5,
                        logRetentionDays: settings.logRetentionDays || 7,
                        enableAutoRefresh:
                            settings.enableAutoRefresh !== undefined
                                ? settings.enableAutoRefresh
                                : true,
                        refreshInterval: settings.refreshInterval || 1000,
                    })
                );
            }
        } catch {
            console.error("설정 로드 실패");
        }
    };

    // 컴포넌트 마운트 시 설정 로드
    useEffect(() => {
        loadSettingsFromStorage();
    }, [dispatch]);

    const saveSettings = () => {
        setIsLoading(true);
        try {
            const settings = {
                maxConcurrent,
                autoCloseDelay,
                logRetentionDays,
                enableAutoRefresh,
                refreshInterval,
            };
            localStorage.setItem("app-settings", JSON.stringify(settings));
            setMessage("설정이 저장되었습니다!");
            setTimeout(() => setMessage(""), 3000);
        } catch {
            setMessage("설정 저장에 실패했습니다.");
            setTimeout(() => setMessage(""), 3000);
        } finally {
            setIsLoading(false);
        }
    };

    const handleResetSettings = () => {
        dispatch(resetSettings());
        setMessage("설정이 초기화되었습니다!");
        setTimeout(() => setMessage(""), 3000);
    };

    return (
        <div className="p-6">
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">
                    ⚙️ 설정
                </h2>
                <p className="text-gray-600 dark:text-gray-300">
                    애플리케이션의 동작 방식을 설정할 수 있습니다.
                </p>
            </div>

            {/* 브라우저 큐 설정 */}
            <Card className="mb-6">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        🌐 브라우저 큐 설정
                        <Badge variant="secondary">핵심</Badge>
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                최대 동시 실행 브라우저 수
                            </label>
                            <input
                                type="number"
                                value={maxConcurrent}
                                onChange={(e) =>
                                    dispatch(
                                        setMaxConcurrent(
                                            parseInt(e.target.value) || 1
                                        )
                                    )
                                }
                                min="1"
                                max="50"
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                            />
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                시스템 부하를 고려하여 1-50 사이로 설정하세요
                            </p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                브라우저 자동 닫기 지연 시간 (초)
                            </label>
                            <input
                                type="number"
                                step="0.1"
                                value={autoCloseDelay}
                                onChange={(e) =>
                                    dispatch(
                                        setAutoCloseDelay(
                                            parseFloat(e.target.value) || 0
                                        )
                                    )
                                }
                                min="0"
                                max="60"
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                            />
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                브라우저가 열린 후 자동으로 닫히기까지의 시간
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* 로그 설정 */}
            <Card className="mb-6">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        📋 로그 설정
                        <Badge variant="outline">관리</Badge>
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                로그 보관 기간 (일)
                            </label>
                            <input
                                type="number"
                                value={logRetentionDays}
                                onChange={(e) =>
                                    dispatch(
                                        setLogRetentionDays(
                                            parseInt(e.target.value) || 1
                                        )
                                    )
                                }
                                min="1"
                                max="30"
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                            />
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                로그를 보관할 기간 (1-30일)
                            </p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                자동 새로고침 간격 (밀리초)
                            </label>
                            <input
                                type="number"
                                value={refreshInterval}
                                onChange={(e) =>
                                    dispatch(
                                        setRefreshInterval(
                                            parseInt(e.target.value) || 1000
                                        )
                                    )
                                }
                                min="100"
                                max="10000"
                                step="100"
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                            />
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                로그 및 상태 업데이트 주기
                            </p>
                        </div>
                    </div>
                    <div>
                        <label className="flex items-center space-x-2">
                            <input
                                type="checkbox"
                                checked={enableAutoRefresh}
                                onChange={(e) =>
                                    dispatch(
                                        setEnableAutoRefresh(e.target.checked)
                                    )
                                }
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                자동 새로고침 활성화
                            </span>
                        </label>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            실시간 로그 및 상태 업데이트를 자동으로 수행
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* 시스템 정보 */}
            <Card className="mb-6">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        💻 시스템 정보
                        <Badge variant="outline">정보</Badge>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div className="space-y-2">
                            <div className="flex justify-between">
                                <span className="text-gray-600 dark:text-gray-400">
                                    현재 시간:
                                </span>
                                <span className="font-mono">
                                    {dayjs()
                                        .locale("ko")
                                        .format("YYYY. MM. DD. HH:mm:ss")}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600 dark:text-gray-400">
                                    브라우저:
                                </span>
                                <span>{navigator.userAgent.split(" ")[0]}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600 dark:text-gray-400">
                                    언어:
                                </span>
                                <span>{navigator.language}</span>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-between">
                                <span className="text-gray-600 dark:text-gray-400">
                                    온라인 상태:
                                </span>
                                <Badge
                                    variant={
                                        navigator.onLine
                                            ? "default"
                                            : "destructive"
                                    }
                                >
                                    {navigator.onLine ? "온라인" : "오프라인"}
                                </Badge>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600 dark:text-gray-400">
                                    화면 해상도:
                                </span>
                                <span>
                                    {screen.width} × {screen.height}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600 dark:text-gray-400">
                                    색상 깊이:
                                </span>
                                <span>{screen.colorDepth}bit</span>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* 액션 버튼 */}
            <div className="flex gap-4">
                <Button
                    onClick={saveSettings}
                    disabled={isLoading}
                    className="flex-1"
                >
                    {isLoading ? "저장 중..." : "💾 설정 저장"}
                </Button>
                <Button
                    onClick={handleResetSettings}
                    variant="outline"
                    className="flex-1"
                >
                    🔄 초기화
                </Button>
            </div>

            {/* 메시지 표시 */}
            {message && (
                <div className="mt-4 p-3 bg-green-100 dark:bg-green-900 border border-green-400 dark:border-green-600 text-green-700 dark:text-green-200 rounded-lg">
                    {message}
                </div>
            )}
        </div>
    );
}

// Dynamic import로 클라이언트에서만 로드
export default dynamic(() => Promise.resolve(SettingsContent), {
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
