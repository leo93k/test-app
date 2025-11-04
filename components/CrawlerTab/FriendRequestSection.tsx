"use client";
import { useState, useRef } from "react";
import { Logger } from "@/service/logger";
import { useSocket } from "@/lib/hooks/useSocket";
import type { BlogSearchResult } from "./types";

interface FriendRequestSectionProps {
    username: string;
    password: string;
    headless: boolean;
    friendRequestTargets: BlogSearchResult[];
    searchResults: BlogSearchResult[];
    onUsernameChange: (username: string) => void;
    onPasswordChange: (password: string) => void;
    onHeadlessChange: (headless: boolean) => void;
    onTargetsChange: (targets: BlogSearchResult[]) => void;
    onError: (error: string) => void;
    onLoadingChange: (loading: boolean) => void;
}

const messageSamples = {
    sample1: "안녕하세요! 좋은 글 잘 보고 있습니다. 서로이웃 신청드려요! 😊",
    sample2: "블로그 글 정말 유익하네요! 서로이웃으로 소통해요~",
    sample3: "관심있는 주제의 글을 많이 보고 있어요. 서로이웃 신청합니다!",
    sample4:
        "좋은 정보 공유 감사합니다. 서로이웃으로 지속적인 소통 부탁드려요!",
    sample5: "블로그 운영 화이팅! 서로이웃 신청드립니다. 함께 성장해요! 🚀",
};

const isProduction = process.env.NODE_ENV === "production";

export default function FriendRequestSection({
    username,
    password,
    headless,
    friendRequestTargets,
    searchResults,
    onUsernameChange,
    onPasswordChange,
    onHeadlessChange,
    onTargetsChange,
    onError,
    onLoadingChange,
}: FriendRequestSectionProps) {
    // Socket.io 연결 상태 및 sessionId 가져오기
    const { isConnected, sessionId } = useSocket();

    // 프로덕션 환경에서는 headless를 true로 고정
    const effectiveHeadless = isProduction ? true : headless;
    const [selectedMessageType, setSelectedMessageType] = useState("sample1");
    const [friendRequestMessage, setFriendRequestMessage] = useState(
        messageSamples.sample1
    );
    const [friendRequestLoading, setFriendRequestLoading] = useState(false);
    const [loginTestLoading, setLoginTestLoading] = useState(false);
    const abortControllerRef = useRef<AbortController | null>(null);
    const ongoingRequestsRef = useRef<
        Promise<{
            success: boolean;
            blog: BlogSearchResult;
            index: number;
            error?: string;
        }>[]
    >([]);

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

    const handleLoginTest = async () => {
        if (!username.trim() || !password.trim()) {
            onError("아이디와 비밀번호를 모두 입력해주세요.");
            return;
        }

        if (friendRequestTargets.length === 0) {
            onError("먼저 블로그를 검색하고 서이추 목록에 추가해주세요.");
            return;
        }

        // 기존 요청 중지
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }

        // 새 AbortController 생성
        abortControllerRef.current = new AbortController();
        const signal = abortControllerRef.current.signal;

        setLoginTestLoading(true);
        onLoadingChange(true);
        onError("");

        try {
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

            const logger = Logger.getInstance(sessionId);
            const testBlog = friendRequestTargets[0];

            await logger.info(`🔐 로그인 테스트 시작: ${testBlog.title}`);

            const response = await fetch("/api/login-test", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    url: testBlog.url,
                    username: username.trim(),
                    password: password.trim(),
                    headless: effectiveHeadless,
                    sessionId: sessionId, // useSocket에서 가져온 sessionId 사용
                }),
                signal,
            });

            // 중지되었는지 확인
            if (signal.aborted) {
                return;
            }

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.error || "로그인 테스트에 실패했습니다.");
            }

            await logger.success(`✅ 로그인 테스트 성공: ${testBlog.title}`);
        } catch (err) {
            // 중지된 경우에는 에러 표시하지 않음
            if (signal.aborted) {
                if (sessionId) {
                    const logger = Logger.getInstance(sessionId);
                    await logger.info("⏸️ 로그인 테스트가 중지되었습니다.");
                }
                return;
            }

            const errorMessage =
                err instanceof Error
                    ? err.message
                    : "알 수 없는 오류가 발생했습니다.";
            onError(errorMessage);

            if (sessionId) {
                const logger = Logger.getInstance(sessionId);
                await logger.error(`❌ 로그인 테스트 실패: ${errorMessage}`);
            }
        } finally {
            if (!signal.aborted) {
                setLoginTestLoading(false);
                onLoadingChange(false);
            }
        }
    };

    const handleFriendRequest = async () => {
        if (!username.trim() || !password.trim()) {
            onError("아이디와 비밀번호를 모두 입력해주세요.");
            return;
        }

        if (friendRequestTargets.length === 0) {
            onError("먼저 블로그를 검색하고 서이추 목록에 추가해주세요.");
            return;
        }

        // 기존 요청 중지
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }

        // 새 AbortController 생성
        abortControllerRef.current = new AbortController();
        const signal = abortControllerRef.current.signal;

        setFriendRequestLoading(true);
        onLoadingChange(true);
        onError("");

        try {
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

            const logger = Logger.getInstance(sessionId);
            await logger.info(
                `🤝 ${friendRequestTargets.length}개 블로그에 서로이웃 추가 요청을 시작합니다...`
            );

            const promises = friendRequestTargets.map(async (blog, index) => {
                // 중지되었는지 확인
                if (signal.aborted) {
                    return { success: false, blog, index, error: "중지됨" };
                }

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
                            headless: effectiveHeadless,
                            friendRequest: true,
                            sessionId: sessionId, // 클라이언트 sessionId 전송
                        }),
                        signal,
                    });

                    // 중지되었는지 확인
                    if (signal.aborted) {
                        return { success: false, blog, index, error: "중지됨" };
                    }

                    const data = await response.json();

                    if (!response.ok) {
                        // 더 구체적인 에러 메시지가 있으면 사용
                        const errorMessage = data.details
                            ? `${data.error}: ${data.details}`
                            : data.error ||
                              "서로이웃 추가 요청에 실패했습니다.";
                        throw new Error(errorMessage);
                    }

                    await logger.success(
                        `✅ 블로그 ${index + 1} 서로이웃 추가 완료: ${
                            blog.title
                        }`
                    );
                    return { success: true, blog, index };
                } catch (error) {
                    // 중지된 경우
                    if (signal.aborted || error instanceof DOMException) {
                        await logger.info(
                            `⏸️ 블로그 ${index + 1} 처리 중지: ${blog.title}`
                        );
                        return { success: false, blog, index, error: "중지됨" };
                    }

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

            ongoingRequestsRef.current = promises;

            const results = await Promise.allSettled(promises);

            // 중지되었는지 확인
            if (signal.aborted) {
                const logger = Logger.getInstance("friend-request");
                await logger.info("⏸️ 서로이웃 추가 요청이 중지되었습니다.");
                return;
            }

            // 성공/실패 분리
            const successResults = results.filter(
                (r) => r.status === "fulfilled" && r.value.success
            );
            const failResults = results.filter(
                (r) => r.status === "rejected" || !r.value?.success
            );

            const successCount = successResults.length;
            const failCount = failResults.length;

            // 성공한 블로그 리스트
            const successList = successResults
                .map((r) => {
                    if (r.status === "fulfilled" && r.value.success) {
                        return r.value.blog?.title || "알 수 없음";
                    }
                    return null;
                })
                .filter((title) => title !== null)
                .join(", ");

            // 실패한 블로그 리스트
            const failList = failResults
                .map((r) => {
                    if (r.status === "fulfilled" && r.value) {
                        return `${r.value.blog?.title || "알 수 없음"} (${
                            r.value.error || "알 수 없는 오류"
                        })`;
                    } else if (r.status === "rejected") {
                        return `알 수 없음 (${
                            r.reason?.message || "알 수 없는 오류"
                        })`;
                    }
                    return null;
                })
                .filter((item) => item !== null)
                .join(", ");

            await logger.success(
                `🎉 서로이웃 추가 완료! 성공: ${successCount}개, 실패: ${failCount}개`
            );

            // 성공한 블로그 리스트 출력
            if (successList) {
                await logger.success(`✅ 성공한 블로그: ${successList}`);
            }

            // 실패한 블로그 리스트 출력
            if (failList) {
                await logger.error(`❌ 실패한 블로그: ${failList}`);
            }
        } catch (err) {
            // 중지된 경우에는 에러 표시하지 않음
            if (signal.aborted) {
                const logger = Logger.getInstance("friend-request");
                await logger.info("⏸️ 서로이웃 추가 요청이 중지되었습니다.");
                return;
            }

            const errorMessage =
                err instanceof Error
                    ? err.message
                    : "알 수 없는 오류가 발생했습니다.";
            onError(errorMessage);

            const logger = Logger.getInstance("friend-request");
            await logger.error(`❌ 서로이웃 추가 실패: ${errorMessage}`);
        } finally {
            if (!signal.aborted) {
                setFriendRequestLoading(false);
                onLoadingChange(false);
            }
            ongoingRequestsRef.current = [];
        }
    };

    const handleStop = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }

        setFriendRequestLoading(false);
        setLoginTestLoading(false);
        onLoadingChange(false);

        const logger = Logger.getInstance("friend-request");
        logger.info("⏸️ 모든 요청이 중지되었습니다.");
    };

    return (
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
                                        onUsernameChange(e.target.value)
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
                                        onPasswordChange(e.target.value)
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
                                <label
                                    className={`flex-1 flex items-center space-x-2 p-3 border border-gray-300 dark:border-gray-600 rounded-lg ${
                                        isProduction
                                            ? "opacity-50 cursor-not-allowed"
                                            : "cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700"
                                    }`}
                                >
                                    <input
                                        type="radio"
                                        name="headless"
                                        value="false"
                                        checked={!effectiveHeadless}
                                        onChange={() => onHeadlessChange(false)}
                                        disabled={
                                            friendRequestLoading || isProduction
                                        }
                                        className="text-blue-600 focus:ring-blue-500"
                                    />
                                    <span className="text-sm text-gray-700 dark:text-gray-300">
                                        👁️ 브라우저 표시
                                    </span>
                                </label>
                                <label
                                    className={`flex-1 flex items-center space-x-2 p-3 border border-gray-300 dark:border-gray-600 rounded-lg ${
                                        isProduction
                                            ? "opacity-50 cursor-not-allowed bg-gray-100 dark:bg-gray-700"
                                            : "cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700"
                                    }`}
                                >
                                    <input
                                        type="radio"
                                        name="headless"
                                        value="true"
                                        checked={effectiveHeadless}
                                        onChange={() => onHeadlessChange(true)}
                                        disabled={
                                            friendRequestLoading || isProduction
                                        }
                                        className="text-blue-600 focus:ring-blue-500"
                                    />
                                    <span className="text-sm text-gray-700 dark:text-gray-300">
                                        🚫 백그라운드 실행
                                    </span>
                                </label>
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                {isProduction ? (
                                    <span className="text-orange-600 dark:text-orange-400">
                                        운영 환경에서는 백그라운드 실행 모드만
                                        사용됩니다.
                                    </span>
                                ) : (
                                    "브라우저 표시: 실행 과정을 화면에서 확인할 수 있습니다"
                                )}
                            </p>
                        </div>

                        {/* 서로이웃 추가 메시지 */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                서로이웃 추가 메시지
                            </label>

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
                                <option value="custom">기타 (직접 입력)</option>
                            </select>

                            {selectedMessageType === "custom" ? (
                                <textarea
                                    value={friendRequestMessage}
                                    onChange={(e) =>
                                        setFriendRequestMessage(e.target.value)
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

                        {/* 로그인 테스트 및 서로이웃 추가 버튼 */}
                        <div className="pt-4 space-y-3">
                            <button
                                onClick={handleLoginTest}
                                disabled={
                                    loginTestLoading ||
                                    friendRequestLoading ||
                                    friendRequestTargets.length === 0 ||
                                    !username.trim() ||
                                    !password.trim()
                                }
                                className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
                            >
                                {loginTestLoading
                                    ? "로그인 테스트 중..."
                                    : "🔐 로그인 테스트"}
                            </button>
                            <div className="flex gap-2">
                                <button
                                    onClick={handleFriendRequest}
                                    disabled={
                                        friendRequestLoading ||
                                        loginTestLoading ||
                                        friendRequestTargets.length === 0 ||
                                        !username.trim() ||
                                        !password.trim()
                                    }
                                    className="flex-1 px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
                                >
                                    {friendRequestLoading
                                        ? "서로이웃 추가 중..."
                                        : "🤝 서로이웃 추가 요청"}
                                </button>
                                {(friendRequestLoading || loginTestLoading) && (
                                    <button
                                        onClick={handleStop}
                                        className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
                                    >
                                        ⏸️ 중지
                                    </button>
                                )}
                            </div>
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
                                            총 {friendRequestTargets.length}개
                                            블로그
                                        </span>
                                        <span className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-2 py-1 rounded text-xs">
                                            서로이웃 추가 대상
                                        </span>
                                    </div>
                                </div>

                                <div className="max-h-64 overflow-y-auto space-y-2">
                                    {friendRequestTargets.map((blog, index) => (
                                        <div
                                            key={index}
                                            className="flex items-center space-x-3 p-2 bg-white dark:bg-gray-600 rounded border group relative"
                                        >
                                            <button
                                                onClick={() => {
                                                    onTargetsChange(
                                                        friendRequestTargets.filter(
                                                            (_, i) =>
                                                                i !== index
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
                                                <a
                                                    href={blog.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="block hover:opacity-80 transition-opacity"
                                                    onClick={(e) =>
                                                        e.stopPropagation()
                                                    }
                                                >
                                                    <h6 className="text-xs font-medium text-gray-800 dark:text-white truncate hover:text-blue-600 dark:hover:text-blue-400">
                                                        {blog.title ||
                                                            "제목 없음"}
                                                    </h6>
                                                </a>
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
                                    ))}
                                </div>

                                <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                                    <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
                                        위의 모든 블로그에 서로이웃 추가 요청을
                                        보냅니다
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
                                            username.trim() && password.trim()
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
            </div>
        </div>
    );
}
