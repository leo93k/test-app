"use client";
import { useState } from "react";
import { ID, PASSWORD } from "@/const";
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
    const [username, setUsername] = useState(ID);
    const [password, setPassword] = useState(PASSWORD);
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

    const handleBlogSearch = async (keyword: string, maxPage: number) => {
        if (!keyword.trim()) {
            setError("검색할 키워드를 입력해주세요.");
            return;
        }

        setSearchLoading(true);
        setError("");

        try {
            // Socket.io 서버 초기화 확인 및 초기화 시도
            try {
                await fetch("/api/socket", { method: "GET" });
            } catch (socketError) {
                console.warn(
                    "Socket.io 서버 초기화 실패, 계속 진행:",
                    socketError
                );
            }

            // useSocket에서 생성한 sessionId 사용 (항상 생성되므로 null 체크만)
            if (!sessionId) {
                throw new Error(
                    "Socket sessionId가 없습니다. 소켓 연결을 확인해주세요."
                );
            }

            // 소켓에 join-session을 다시 보내서 확실히 등록 (이미 등록되어 있어도 문제없음)
            const { connectSocket } = await import("@/lib/socket");
            const socket = connectSocket();
            if (socket.connected) {
                socket.emit("join-session", sessionId);
                console.log(`📤 Sent sessionId to server: ${sessionId}`);
            }

            // 약간의 지연 후 API 호출 (소켓 등록이 완료되도록)
            await new Promise((resolve) => setTimeout(resolve, 100));

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
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "블로그 검색에 실패했습니다.");
            }

            const results = data.results || [];
            setSearchResults(results);
            setFriendRequestTargets(results);
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "알 수 없는 오류가 발생했습니다."
            );
        } finally {
            setSearchLoading(false);
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
                        <LogList />

                        <BlogSearchSection
                            searchResults={searchResults}
                            friendRequestTargets={friendRequestTargets}
                            onSearch={handleBlogSearch}
                            onAddToTargets={handleAddToTargets}
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
