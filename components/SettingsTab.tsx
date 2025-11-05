"use client";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAppSelector, useAppDispatch } from "@/lib/hooks";
import {
    setMaxBlogSearchPages,
    resetSettings,
    loadSettings,
} from "@/lib/store/settingsSlice";
import dayjs from "dayjs";
import "dayjs/locale/ko";
import dynamic from "next/dynamic";

function SettingsContent() {
    const dispatch = useAppDispatch();
    const { maxBlogSearchPages } = useAppSelector((state) => state.settings);

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
                        maxBlogSearchPages: settings.maxBlogSearchPages || 3,
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const saveSettings = () => {
        setIsLoading(true);
        try {
            const settings = {
                maxBlogSearchPages,
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

            <div className="max-w-4xl mx-auto mb-8">
                {/* 블로그 검색 설정 */}
                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            🔍 블로그 검색 설정
                            <Badge variant="outline">검색</Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    블로그 검색 최대 페이지 수
                                </label>
                                <input
                                    type="number"
                                    value={maxBlogSearchPages}
                                    onChange={(e) =>
                                        dispatch(
                                            setMaxBlogSearchPages(
                                                parseInt(e.target.value) || 1
                                            )
                                        )
                                    }
                                    min="1"
                                    max="10"
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                                />
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    블로그 검색 시 최대 검색할 페이지 수 (1-10)
                                </p>
                            </div>
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
                                    <span>
                                        {navigator.userAgent.split(" ")[0]}
                                    </span>
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
                                        {navigator.onLine
                                            ? "온라인"
                                            : "오프라인"}
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
