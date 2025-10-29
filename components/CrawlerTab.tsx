"use client";
import { useState, useEffect, useCallback } from "react";
import { ID, PASSWORD } from "@/const";
import { Logger } from "@/lib/logger";
import dayjs from "dayjs";
import "dayjs/locale/ko";

interface LogEntry {
    id: string;
    message: string;
    timestamp: string;
    type: "info" | "success" | "error";
}

interface BlogSearchResult {
    title: string;
    url: string;
    description: string;
    author: string;
    date: string;
    platform: string;
}

export default function CrawlerTab() {
    const [username, setUsername] = useState(ID);
    const [password, setPassword] = useState(PASSWORD);
    const [keyword, setKeyword] = useState("");
    const [maxPage, setMaxPage] = useState(1);
    const [friendRequestMessage, setFriendRequestMessage] = useState(
        "안녕하세요! 좋은 글 잘 보고 있습니다. 서로이웃 신청드려요! 😊"
    );
    const [selectedMessageType, setSelectedMessageType] = useState("sample1");
    const [searchResults, setSearchResults] = useState<BlogSearchResult[]>([]);
    const [friendRequestTargets, setFriendRequestTargets] = useState<
        BlogSearchResult[]
    >([]);
    const [friendRequestLoading, setFriendRequestLoading] = useState(false);
    const [loginTestLoading, setLoginTestLoading] = useState(false);
    const [searchLoading, setSearchLoading] = useState(false);
    const [headless, setHeadless] = useState(false); // 실행 모드: false = 브라우저 창 표시
    const [error, setError] = useState("");
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [lastLogId, setLastLogId] = useState("0");

    // 서로이웃 추가 메시지 샘플
    const messageSamples = {
        sample1:
            "안녕하세요! 좋은 글 잘 보고 있습니다. 서로이웃 신청드려요! 😊",
        sample2: "블로그 글 정말 유익하네요! 서로이웃으로 소통해요~",
        sample3: "관심있는 주제의 글을 많이 보고 있어요. 서로이웃 신청합니다!",
        sample4:
            "좋은 정보 공유 감사합니다. 서로이웃으로 지속적인 소통 부탁드려요!",
        sample5: "블로그 운영 화이팅! 서로이웃 신청드립니다. 함께 성장해요! 🚀",
    };

    // 메시지 타입 변경 핸들러
    const handleMessageTypeChange = (type: string) => {
        setSelectedMessageType(type);
        if (type === "custom") {
            setFriendRequestMessage("");
        } else {
            setFriendRequestMessage(
                messageSamples[type as keyof typeof messageSamples]
            );
        }
    };

    // 로그인 테스트 함수
    const handleLoginTest = async () => {
        if (!username.trim() || !password.trim()) {
            setError("아이디와 비밀번호를 모두 입력해주세요.");
            return;
        }

        setLoginTestLoading(true);
        setError("");

        try {
            const logger = Logger.getInstance("login-test");
            await logger.info("🔐 네이버 로그인 테스트를 시작합니다...");

            const response = await fetch("/api/crawl", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    url: "https://nid.naver.com/nidlogin.login?url=https%3A%2F%2Fsection.blog.naver.com%2FBlogHome.naver",
                    username: username.trim(),
                    password: password.trim(),
                    testMode: true, // 테스트 모드 플래그
                    headless: headless, // 실행 모드
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "로그인 테스트에 실패했습니다.");
            }

            await logger.success(
                "✅ 로그인 테스트가 성공적으로 완료되었습니다!"
            );
        } catch (err) {
            const errorMessage =
                err instanceof Error
                    ? err.message
                    : "알 수 없는 오류가 발생했습니다.";
            setError(errorMessage);

            const logger = Logger.getInstance("login-test");
            await logger.error(`❌ 로그인 테스트 실패: ${errorMessage}`);
        } finally {
            setLoginTestLoading(false);
        }
    };

    // 서로이웃 추가 함수
    const handleFriendRequest = async () => {
        if (!username.trim() || !password.trim()) {
            setError("아이디와 비밀번호를 모두 입력해주세요.");
            return;
        }

        if (friendRequestTargets.length === 0) {
            setError("먼저 블로그를 검색하고 서이추 목록에 추가해주세요.");
            return;
        }

        setFriendRequestLoading(true);
        setError("");

        try {
            const logger = Logger.getInstance("friend-request");
            await logger.info(
                `🤝 ${friendRequestTargets.length}개 블로그에 서로이웃 추가 요청을 시작합니다...`
            );

            // 각 블로그에 대해 서로이웃 추가 프로세스 실행
            const promises = friendRequestTargets.map(async (blog, index) => {
                try {
                    await logger.info(
                        `📝 블로그 ${index + 1} 처리 시작: ${blog.title}`
                    );

                    const response = await fetch("/api/crawl", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                            url: blog.url,
                            username: username.trim(),
                            password: password.trim(),
                            message: friendRequestMessage.trim(),
                            headless: headless, // 실행 모드
                            friendRequest: true, // 서로이웃 추가 모드
                        }),
                    });

                    const data = await response.json();

                    if (!response.ok) {
                        throw new Error(
                            data.error || "서로이웃 추가 요청에 실패했습니다."
                        );
                    }

                    await logger.success(
                        `✅ 블로그 ${index + 1} 서로이웃 추가 완료: ${
                            blog.title
                        }`
                    );
                    return { success: true, blog, index };
                } catch (error) {
                    const errorMessage =
                        error instanceof Error
                            ? error.message
                            : "알 수 없는 오류";
                    await logger.error(
                        `❌ 블로그 ${
                            index + 1
                        } 서로이웃 추가 실패: ${errorMessage}`
                    );
                    return { success: false, blog, index, error: errorMessage };
                }
            });

            const results = await Promise.allSettled(promises);
            const successCount = results.filter(
                (r) => r.status === "fulfilled" && r.value.success
            ).length;
            const failCount = results.length - successCount;

            await logger.success(
                `🎉 서로이웃 추가 완료! 성공: ${successCount}개, 실패: ${failCount}개`
            );
        } catch (err) {
            const errorMessage =
                err instanceof Error
                    ? err.message
                    : "알 수 없는 오류가 발생했습니다.";
            setError(errorMessage);

            const logger = Logger.getInstance("friend-request");
            await logger.error(`❌ 서로이웃 추가 실패: ${errorMessage}`);
        } finally {
            setFriendRequestLoading(false);
        }
    };

    // 로그 폴링 함수
    const pollLogs = useCallback(async () => {
        try {
            const response = await fetch(`/api/logs?lastId=${lastLogId}`);
            const data = await response.json();

            if (data.logs && data.logs.length > 0) {
                setLogs((prev) => {
                    const existingIds = new Set(prev.map((log) => log.id));
                    const newLogs = data.logs.filter(
                        (log: LogEntry) => !existingIds.has(log.id)
                    );
                    const updatedLogs = [...newLogs, ...prev];
                    const sortedLogs = updatedLogs.sort(
                        (a, b) =>
                            new Date(b.timestamp).getTime() -
                            new Date(a.timestamp).getTime()
                    );
                    return sortedLogs.slice(0, 100);
                });
                setLastLogId(data.lastId);
            }
        } catch (error) {
            console.error("Failed to fetch logs:", error);
        }
    }, [lastLogId]);

    // 로그 폴링
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (searchLoading || loginTestLoading || friendRequestLoading) {
            interval = setInterval(pollLogs, 500);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [
        searchLoading,
        loginTestLoading,
        friendRequestLoading,
        lastLogId,
        pollLogs,
    ]);

    // 블로그 검색 함수
    const handleBlogSearch = async () => {
        if (!keyword.trim()) {
            setError("검색할 키워드를 입력해주세요.");
            return;
        }

        setSearchLoading(true);
        setError("");
        setSearchResults([]);

        try {
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
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "블로그 검색에 실패했습니다.");
            }
            console.log({ data });

            const results = data.results || [];
            setSearchResults(results);

            // 검색된 모든 블로그를 자동으로 서이추 목록에 추가
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

    // UTC to local time conversion function
    const formatLocalTime = (utcTimestamp: string) => {
        try {
            return dayjs(utcTimestamp)
                .locale("ko")
                .format("YYYY. MM. DD. HH:mm:ss");
        } catch {
            return utcTimestamp;
        }
    };

    // Clear all logs function
    const clearAllLogs = async () => {
        try {
            const response = await fetch("/api/logs?action=clear", {
                method: "DELETE",
            });
            const data = await response.json();

            if (data.success) {
                setLogs([]);
                setLastLogId("0");
            }
        } catch (error) {
            console.error("Failed to clear logs:", error);
        }
    };

    return (
        <div className="p-6">
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">
                    🕷️ 웹 크롤러
                </h2>
                <p className="text-gray-600 dark:text-gray-300">
                    URL을 입력하면 셀레니움으로 웹사이트를 크롤링합니다.
                    로그인이 필요한 사이트도 자동 로그인 가능합니다.
                </p>
            </div>

            {/* 블로그 검색 섹션 */}
            <div className="max-w-4xl mx-auto mb-8">
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
                    <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">
                        🔍 블로그 검색
                    </h3>

                    {/* 키워드 입력 및 페이지 설정 */}
                    <div className="mb-4">
                        <div className="flex gap-2 items-end">
                            <div className="flex-1">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    검색 키워드
                                </label>
                                <input
                                    type="text"
                                    value={keyword}
                                    onChange={(e) => setKeyword(e.target.value)}
                                    placeholder="검색할 키워드를 입력하세요"
                                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                                    disabled={searchLoading}
                                />
                            </div>
                            <div className="w-24">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    페이지 수
                                </label>
                                <input
                                    type="number"
                                    value={maxPage}
                                    onChange={(e) => {
                                        const value =
                                            parseInt(e.target.value) || 1;
                                        setMaxPage(
                                            Math.max(1, Math.min(20, value))
                                        ); // 1-20 범위로 제한
                                    }}
                                    min="1"
                                    max="20"
                                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                                    disabled={searchLoading}
                                />
                            </div>
                            <button
                                onClick={handleBlogSearch}
                                disabled={searchLoading || !keyword.trim()}
                                className="px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
                            >
                                {searchLoading ? "검색 중..." : "🔍 검색"}
                            </button>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            1부터 입력한 숫자까지의 페이지를 검색합니다. (예: 3
                            입력 시 1, 2, 3페이지 검색)
                        </p>
                    </div>

                    {/* 검색 결과 */}
                    <div className="mt-6">
                        {searchResults.length > 0 ? (
                            <>
                                <h4 className="text-lg font-semibold text-gray-800 dark:text-white mb-3">
                                    📋 검색 결과 ({searchResults.length}개)
                                </h4>
                                <div className="space-y-2">
                                    <h5 className="text-md font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        📝 검색된 블로그 목록
                                    </h5>
                                    <div className="max-h-96 overflow-y-auto space-y-2">
                                        {searchResults.map((result, index) => (
                                            <div
                                                key={index}
                                                className="p-3 rounded-lg border bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 relative group"
                                            >
                                                <button
                                                    onClick={() => {
                                                        if (
                                                            !friendRequestTargets.includes(
                                                                result
                                                            )
                                                        ) {
                                                            setFriendRequestTargets(
                                                                [
                                                                    ...friendRequestTargets,
                                                                    result,
                                                                ]
                                                            );
                                                        }
                                                    }}
                                                    disabled={friendRequestTargets.some(
                                                        (item) =>
                                                            item.url ===
                                                            result.url
                                                    )}
                                                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white text-xs px-2 py-1 rounded"
                                                    title={
                                                        friendRequestTargets.some(
                                                            (item) =>
                                                                item.url ===
                                                                result.url
                                                        )
                                                            ? "이미 추가됨"
                                                            : "서이추 목록에 추가"
                                                    }
                                                >
                                                    {friendRequestTargets.some(
                                                        (item) =>
                                                            item.url ===
                                                            result.url
                                                    )
                                                        ? "✓"
                                                        : "+"}
                                                </button>
                                                <div className="flex justify-between items-start pr-8">
                                                    <h6 className="font-medium text-gray-800 dark:text-white text-sm line-clamp-2">
                                                        {result.title ||
                                                            "제목 없음"}
                                                    </h6>
                                                    <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded ml-2 flex-shrink-0">
                                                        {result.platform ||
                                                            "블로그"}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                    👤{" "}
                                                    {result.author ||
                                                        "작성자 미상"}
                                                </p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                    🔗{" "}
                                                    <a
                                                        href={result.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-blue-600 dark:text-blue-400 hover:underline"
                                                    >
                                                        블로그 보기
                                                    </a>
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="text-center py-8">
                                <div className="text-4xl text-gray-400 mb-2">
                                    🔍
                                </div>
                                <p className="text-gray-500 dark:text-gray-400">
                                    검색 결과가 없습니다.
                                </p>
                                <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                                    다른 키워드로 검색해보세요.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* 서로이웃 추가 기능 */}
            <div className="max-w-4xl mx-auto mb-8">
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
                    <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">
                        🤝 서로이웃 추가
                    </h3>
                    <p className="text-gray-600 dark:text-gray-300 mb-6">
                        네이버 블로그에서 서로이웃 추가 요청을 보낼 수 있습니다.
                        먼저 위에서 블로그를 검색하고 선택한 후, 로그인 정보를
                        입력하여 서로이웃 추가를 진행하세요.
                    </p>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* 왼쪽: 로그인 정보 및 설정 */}
                        <div className="space-y-4">
                            <h4 className="text-lg font-medium text-gray-700 dark:text-gray-300">
                                🔐 로그인 정보
                            </h4>

                            {/* 네이버 로그인 정보 */}
                            <form className="space-y-3">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        네이버 아이디
                                    </label>
                                    <input
                                        type="text"
                                        name="username"
                                        value={username}
                                        onChange={(e) =>
                                            setUsername(e.target.value)
                                        }
                                        placeholder="네이버 아이디를 입력하세요"
                                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                                        disabled={friendRequestLoading}
                                        autoComplete="username"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        네이버 비밀번호
                                    </label>
                                    <input
                                        type="password"
                                        name="password"
                                        value={password}
                                        onChange={(e) =>
                                            setPassword(e.target.value)
                                        }
                                        placeholder="네이버 비밀번호를 입력하세요"
                                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                                        disabled={friendRequestLoading}
                                        autoComplete="current-password"
                                    />
                                </div>
                            </form>

                            {/* 실행 모드 설정 */}
                            <div className="pt-2">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    실행 모드
                                </label>
                                <div className="flex gap-2">
                                    <label className="flex-1 flex items-center space-x-2 p-3 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700">
                                        <input
                                            type="radio"
                                            name="headless"
                                            value="false"
                                            checked={!headless}
                                            onChange={() => setHeadless(false)}
                                            disabled={
                                                friendRequestLoading ||
                                                loginTestLoading
                                            }
                                            className="text-blue-600 focus:ring-blue-500"
                                        />
                                        <span className="text-sm text-gray-700 dark:text-gray-300">
                                            👁️ 브라우저 표시
                                        </span>
                                    </label>
                                    <label className="flex-1 flex items-center space-x-2 p-3 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700">
                                        <input
                                            type="radio"
                                            name="headless"
                                            value="true"
                                            checked={headless}
                                            onChange={() => setHeadless(true)}
                                            disabled={
                                                friendRequestLoading ||
                                                loginTestLoading
                                            }
                                            className="text-blue-600 focus:ring-blue-500"
                                        />
                                        <span className="text-sm text-gray-700 dark:text-gray-300">
                                            🚫 백그라운드 실행
                                        </span>
                                    </label>
                                </div>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    브라우저 표시: 실행 과정을 화면에서 확인할
                                    수 있습니다
                                </p>
                            </div>

                            {/* 로그인 테스트 버튼 */}
                            {/* <div className="pt-2">
                                <button
                                    onClick={handleLoginTest}
                                    disabled={
                                        loginTestLoading ||
                                        !username.trim() ||
                                        !password.trim()
                                    }
                                    className="w-full px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors text-sm"
                                >
                                    {loginTestLoading
                                        ? "로그인 테스트 중..."
                                        : "🔐 로그인 테스트"}
                                </button>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-center">
                                    {!username.trim() || !password.trim()
                                        ? "아이디와 비밀번호를 입력해주세요"
                                        : "네이버 로그인이 정상적으로 작동하는지 테스트합니다"}
                                </p>
                            </div> */}

                            {/* 서로이웃 추가 메시지 */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    서로이웃 추가 메시지
                                </label>

                                {/* 메시지 선택 드롭다운 */}
                                <select
                                    value={selectedMessageType}
                                    onChange={(e) =>
                                        handleMessageTypeChange(e.target.value)
                                    }
                                    disabled={friendRequestLoading}
                                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white mb-3"
                                >
                                    {Object.entries(messageSamples).map(
                                        ([key, message], index) => (
                                            <option key={key} value={key}>
                                                샘플 {index + 1}:{" "}
                                                {message.length > 30
                                                    ? message.substring(0, 30) +
                                                      "..."
                                                    : message}
                                            </option>
                                        )
                                    )}
                                    <option value="custom">
                                        기타 (직접 입력)
                                    </option>
                                </select>

                                {/* 메시지 입력/표시 */}
                                {selectedMessageType === "custom" ? (
                                    <textarea
                                        value={friendRequestMessage}
                                        onChange={(e) =>
                                            setFriendRequestMessage(
                                                e.target.value
                                            )
                                        }
                                        placeholder="서로이웃 추가 요청 시 보낼 메시지를 입력하세요"
                                        rows={3}
                                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white resize-none"
                                        disabled={friendRequestLoading}
                                    />
                                ) : (
                                    <div className="p-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg">
                                        <div className="text-sm text-gray-800 dark:text-white">
                                            {friendRequestMessage}
                                        </div>
                                    </div>
                                )}

                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    선택한 메시지가 모든 블로그에 전송됩니다.
                                </p>
                            </div>

                            {/* 서로이웃 추가 버튼 */}
                            <div className="pt-4">
                                <button
                                    onClick={handleFriendRequest}
                                    disabled={
                                        friendRequestLoading ||
                                        friendRequestTargets.length === 0 ||
                                        !username.trim() ||
                                        !password.trim()
                                    }
                                    className="w-full px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
                                >
                                    {friendRequestLoading
                                        ? "서로이웃 추가 중..."
                                        : "🤝 서로이웃 추가 요청"}
                                </button>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
                                    {friendRequestTargets.length === 0
                                        ? "먼저 블로그를 검색하고 추가해주세요"
                                        : !username.trim() || !password.trim()
                                        ? "로그인 정보를 입력해주세요"
                                        : `${friendRequestTargets.length}개 블로그에 서로이웃 추가 요청을 보낼 준비가 되었습니다`}
                                </p>
                            </div>
                        </div>

                        {/* 오른쪽: 대상 블로그 목록 및 상태 */}
                        <div className="space-y-4">
                            <h4 className="text-lg font-medium text-gray-700 dark:text-gray-300">
                                📋 서이추 블로그 목록
                            </h4>

                            {friendRequestTargets.length > 0 ? (
                                <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                                    <div className="mb-3">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                                총 {friendRequestTargets.length}
                                                개 블로그
                                            </span>
                                            <span className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-2 py-1 rounded text-xs">
                                                서로이웃 추가 대상
                                            </span>
                                        </div>
                                    </div>

                                    <div className="max-h-64 overflow-y-auto space-y-2">
                                        {friendRequestTargets.map(
                                            (blog, index) => (
                                                <div
                                                    key={index}
                                                    className="flex items-center space-x-3 p-2 bg-white dark:bg-gray-600 rounded border group relative"
                                                >
                                                    <button
                                                        onClick={() => {
                                                            setFriendRequestTargets(
                                                                friendRequestTargets.filter(
                                                                    (_, i) =>
                                                                        i !==
                                                                        index
                                                                )
                                                            );
                                                        }}
                                                        className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-red-500 hover:bg-red-600 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center"
                                                        title="제거"
                                                    >
                                                        ✕
                                                    </button>
                                                    <div className="flex-shrink-0">
                                                        <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                                                            <span className="text-blue-600 dark:text-blue-400 text-xs">
                                                                {index + 1}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <h6 className="text-xs font-medium text-gray-800 dark:text-white truncate">
                                                            {blog.title ||
                                                                "제목 없음"}
                                                        </h6>
                                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                                            👤{" "}
                                                            {blog.author ||
                                                                "작성자 미상"}
                                                        </p>
                                                    </div>
                                                    <div className="flex-shrink-0">
                                                        <span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-2 py-1 rounded">
                                                            대기
                                                        </span>
                                                    </div>
                                                </div>
                                            )
                                        )}
                                    </div>

                                    <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                                        <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
                                            위의 모든 블로그에 서로이웃 추가
                                            요청을 보냅니다
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-8 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 text-center">
                                    <div className="text-4xl text-gray-400 mb-2">
                                        🔍
                                    </div>
                                    <p className="text-gray-500 dark:text-gray-400 text-sm">
                                        먼저 위에서 블로그를 검색해주세요
                                    </p>
                                </div>
                            )}

                            {/* 진행 상태 */}
                            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                                <h5 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
                                    📊 진행 상태
                                </h5>
                                <div className="space-y-2 text-xs">
                                    <div className="flex items-center justify-between">
                                        <span className="text-blue-700 dark:text-blue-300">
                                            블로그 검색
                                        </span>
                                        <span
                                            className={`px-2 py-1 rounded ${
                                                searchResults.length > 0
                                                    ? "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200"
                                                    : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
                                            }`}
                                        >
                                            {searchResults.length > 0
                                                ? `${searchResults.length}개 완료`
                                                : "대기"}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-blue-700 dark:text-blue-300">
                                            로그인 정보
                                        </span>
                                        <span
                                            className={`px-2 py-1 rounded ${
                                                username.trim() &&
                                                password.trim()
                                                    ? "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200"
                                                    : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
                                            }`}
                                        >
                                            {username.trim() && password.trim()
                                                ? "완료"
                                                : "대기"}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-blue-700 dark:text-blue-300">
                                            서로이웃 추가 대상
                                        </span>
                                        <span
                                            className={`px-2 py-1 rounded ${
                                                friendRequestTargets.length > 0
                                                    ? "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200"
                                                    : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
                                            }`}
                                        >
                                            {friendRequestTargets.length > 0
                                                ? `${friendRequestTargets.length}개`
                                                : "대기"}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {error && (
                        <div className="mt-6 p-4 bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-200 rounded-lg">
                            {error}
                        </div>
                    )}
                </div>
            </div>

            {/* 실시간 로그 표시 */}
            <div className="max-w-4xl mx-auto">
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
        </div>
    );
}
