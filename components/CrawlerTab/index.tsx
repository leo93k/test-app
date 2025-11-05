"use client";
import { useState, useRef } from "react";

import type { BlogSearchResult } from "./types";
import type { TabType } from "./Tabs";
import BlogSearchSection from "./BlogSearchSection";
import FriendRequestSection from "./FriendRequestSection";
import Tabs from "./Tabs";
import { useSocket } from "@/lib/hooks/useSocket";
import LogTestSection from "./LogTestSection";
import LogList from "./LogList";

export default function CrawlerTab() {
    const [activeTab, setActiveTab] = useState<TabType>("main");
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [searchResults, setSearchResults] = useState<BlogSearchResult[]>([]);
    const [friendRequestTargets, setFriendRequestTargets] = useState<
        BlogSearchResult[]
    >([]);
    const [friendRequestLoading, setFriendRequestLoading] = useState(false);
    const [searchLoading, setSearchLoading] = useState(false);
    const [headless, setHeadless] = useState(true);
    const [error, setError] = useState("");

    // Socket.io 연결 상태 확인
    const { isConnected, sessionId } = useSocket();

    // AbortController를 ref로 관리하여 중지 기능 구현
    const searchAbortControllerRef = useRef<AbortController | null>(null);

    const handleBlogSearch = async (keyword: string, maxPage: number) => {
        if (!keyword.trim()) {
            setError("검색할 키워드를 입력해주세요.");
            return;
        }

        // 이전 요청이 있으면 취소
        if (searchAbortControllerRef.current) {
            searchAbortControllerRef.current.abort();
        }

        // 새로운 AbortController 생성
        const abortController = new AbortController();
        searchAbortControllerRef.current = abortController;

        setSearchLoading(true);
        setError("");

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
                console.warn("소켓 초기화 실패, 계속 진행...");
            }

            const response = await fetch("/api/blog-search", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    keyword: keyword.trim(),
                    pageNumbers: Array.from(
                        { length: maxPage },
                        (_, i) => i + 1
                    ),
                    sessionId: sessionId, // useSocket에서 가져온 sessionId 사용
                }),
                signal: abortController.signal,
            });

            // 중지되었는지 확인
            if (abortController.signal.aborted) {
                return;
            }

            const data = await response.json();

            // 중지되었는지 다시 확인
            if (abortController.signal.aborted) {
                return;
            }

            if (!response.ok) {
                throw new Error(data.error || "블로그 검색에 실패했습니다.");
            }

            const results = data.results || [];
            setSearchResults(results);
            setFriendRequestTargets(results);
        } catch (err) {
            // AbortError는 사용자가 중지한 것이므로 에러로 표시하지 않음
            if (err instanceof Error && err.name === "AbortError") {
                setError("검색이 중지되었습니다.");
            } else {
                setError(
                    err instanceof Error
                        ? err.message
                        : "알 수 없는 오류가 발생했습니다."
                );
            }
        } finally {
            setSearchLoading(false);
            searchAbortControllerRef.current = null;
        }
    };

    const handleCancelSearch = () => {
        if (searchAbortControllerRef.current) {
            searchAbortControllerRef.current.abort();
            searchAbortControllerRef.current = null;
            setSearchLoading(false);
            setError("검색이 중지되었습니다.");
        }
    };

    const handleAddToTargets = (result: BlogSearchResult) => {
        if (!friendRequestTargets.some((item) => item.url === result.url)) {
            setFriendRequestTargets([...friendRequestTargets, result]);
        }
    };

    return (
        <div className="p-6">
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">
                    서로 이웃추가하기
                </h2>
                <p className="text-gray-600 dark:text-gray-300">
                    URL을 입력하면 셀레니움으로 웹사이트를 크롤링합니다.
                    로그인이 필요한 사이트도 자동 로그인 가능합니다.
                </p>
            </div>

            {/* 탭 컨텐츠 */}
            <div className="max-w-4xl mx-auto mb-8">
                <Tabs activeTab={activeTab} onTabChange={setActiveTab} />
                {activeTab === "main" ? (
                    <div className="flex flex-col gap-4">
                        <BlogSearchSection
                            searchResults={searchResults}
                            friendRequestTargets={friendRequestTargets}
                            onSearch={handleBlogSearch}
                            onAddToTargets={handleAddToTargets}
                            onCancel={handleCancelSearch}
                            searchLoading={searchLoading}
                        />

                        <FriendRequestSection
                            username={username}
                            password={password}
                            headless={headless}
                            friendRequestTargets={friendRequestTargets}
                            searchResults={searchResults}
                            onUsernameChange={setUsername}
                            onPasswordChange={setPassword}
                            onHeadlessChange={setHeadless}
                            onTargetsChange={setFriendRequestTargets}
                            onError={setError}
                            onLoadingChange={setFriendRequestLoading}
                        />

                        {error && (
                            <div className="max-w-4xl mx-auto mb-8">
                                <div className="p-4 bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-200 rounded-lg">
                                    {error}
                                </div>
                            </div>
                        )}

                        <LogList />
                    </div>
                ) : (
                    <div className="max-w-4xl mx-auto">
                        {/* 로그 테스트 섹션 */}
                        <LogTestSection />

                        {/* 로그 표시 영역 */}
                        <LogList />
                    </div>
                )}
            </div>
        </div>
    );
}
