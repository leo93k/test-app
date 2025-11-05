"use client";
import { useState, useRef, useEffect, useMemo } from "react";
import { Logger } from "@/service/logger";
import { useSocket } from "@/lib/hooks/useSocket";
import { useAppSelector } from "@/lib/hooks";
import type { BlogSearchResult } from "./types";
import { socketClient } from "@/lib/socket";
import { SOCKET_EVENTS } from "@/const/socketEvents";
import { Progress } from "@/components/ui/progress";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

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

    // 큐 작업 결과 수신을 위한 소켓 리스너
    useEffect(() => {
        if (!sessionId) return;

        const handleQueueResult = (data: {
            url: string;
            success: boolean;
            status:
                | "success"
                | "already-friend"
                | "already-requesting"
                | "failed";
            error?: string;
        }) => {
            // URL로 해당 블로그 찾기
            const blog = friendRequestTargets.find((b) => b.url === data.url);
            if (!blog) return;

            // 상태 업데이트
            setBlogStatuses((prev) => {
                const newStatuses = new Map(prev);
                newStatuses.set(blog.url, data.status);
                return newStatuses;
            });

            // 에러 메시지 설정
            if (data.status === "failed" && data.error) {
                setBlogErrors((prev) => {
                    const newErrors = new Map(prev);
                    newErrors.set(blog.url, data.error || "알 수 없는 오류");
                    return newErrors;
                });
            }

            // 로그 메시지
            const logger = Logger.getInstance(sessionId);
            if (data.status === "success") {
                logger.success(`✅ 서로이웃 추가 완료: ${blog.title}`);
            } else if (data.status === "already-friend") {
                logger.info(`ℹ️ 이미 이웃 상태: ${blog.title}`);
            } else if (data.status === "already-requesting") {
                logger.info(`ℹ️ 이미 신청 중: ${blog.title}`);
            } else {
                logger.error(
                    `❌ 서로이웃 추가 실패: ${blog.title} - ${
                        data.error || "알 수 없는 오류"
                    }`
                );
            }
        };

        const setupListener = (): (() => void) | null => {
            const socket = socketClient.getSocket();
            if (!socket) return null;

            socket.on(SOCKET_EVENTS.QUEUE_RESULT, handleQueueResult);

            return () => {
                socket.off(SOCKET_EVENTS.QUEUE_RESULT, handleQueueResult);
            };
        };

        // 먼저 소켓이 있는지 확인
        let cleanup: (() => void) | null = setupListener();

        // 소켓이 없으면 주기적으로 확인
        if (!cleanup) {
            const checkInterval = setInterval(() => {
                const newCleanup = setupListener();
                if (newCleanup) {
                    cleanup = newCleanup;
                    clearInterval(checkInterval);
                }
            }, 1000);

            return () => {
                clearInterval(checkInterval);
                if (cleanup) cleanup();
            };
        }

        return () => {
            if (cleanup) cleanup();
        };
    }, [sessionId, friendRequestTargets]);

    // Redux에서 최대 동시 실행 브라우저 수 가져오기
    const maxConcurrent = useAppSelector(
        (state) => state.settings.maxConcurrent
    );

    // 프로덕션 환경에서도 headless 선택 가능 (임시로 풀어둠)
    // const effectiveHeadless = isProduction ? true : headless;
    const effectiveHeadless = headless;
    const [selectedMessageType, setSelectedMessageType] = useState("sample1");
    const [friendRequestMessage, setFriendRequestMessage] = useState(
        messageSamples.sample1
    );
    const [friendRequestLoading, setFriendRequestLoading] = useState(false);
    const [loginTestLoading, setLoginTestLoading] = useState(false);
    const [loginTestModalOpen, setLoginTestModalOpen] = useState(false);
    const [loginTestModalTitle, setLoginTestModalTitle] = useState("");
    const [loginTestModalMessage, setLoginTestModalMessage] = useState("");
    const [loginTestModalType, setLoginTestModalType] = useState<
        "success" | "error"
    >("success");
    const abortControllerRef = useRef<AbortController | null>(null);
    const ongoingRequestsRef = useRef<
        Promise<{
            success: boolean;
            blog: BlogSearchResult;
            index: number;
            error?: string;
            status?:
                | "success"
                | "already-friend"
                | "already-requesting"
                | "failed";
        }>[]
    >([]);

    // 컴포넌트 언마운트 시 진행 중인 요청 모두 취소
    useEffect(() => {
        return () => {
            // AbortController로 진행 중인 요청 취소
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
                abortControllerRef.current = null;
            }

            // 진행 중인 Promise들 취소 (가능한 경우)
            ongoingRequestsRef.current = [];

            // 로딩 상태 초기화 (setState는 cleanup에서 안전하게 호출 가능)
            try {
                setFriendRequestLoading(false);
                setLoginTestLoading(false);
                onLoadingChange(false);
            } catch (error) {
                // 컴포넌트가 이미 언마운트된 경우 무시
                console.warn("Cleanup: Component already unmounted", error);
            }
        };
    }, [onLoadingChange]);

    // 각 블로그의 상태 추적
    type BlogStatus =
        | "pending"
        | "processing"
        | "success"
        | "already-friend"
        | "already-requesting"
        | "failed"
        | "queued";
    const [blogStatuses, setBlogStatuses] = useState<Map<string, BlogStatus>>(
        new Map()
    );
    // 각 블로그의 에러 메시지 추적
    const [blogErrors, setBlogErrors] = useState<Map<string, string>>(
        new Map()
    );

    // friendRequestTargets가 변경될 때 상태 초기화
    useEffect(() => {
        if (friendRequestTargets.length === 0) {
            setBlogStatuses(new Map());
            setBlogErrors(new Map());
        }
    }, [friendRequestTargets.length]);

    // 진행률 계산
    const progressPercentage = useMemo(() => {
        if (friendRequestTargets.length === 0) return 0;
        const statuses = Array.from(blogStatuses.values());
        const completedCount = statuses.filter(
            (status) =>
                status === "success" ||
                status === "already-friend" ||
                status === "already-requesting" ||
                status === "failed"
        ).length;
        return Math.round((completedCount / friendRequestTargets.length) * 100);
    }, [blogStatuses, friendRequestTargets.length]);

    // 상태별 블로그 리스트
    const blogsByStatus = useMemo(() => {
        const result: {
            success: BlogSearchResult[];
            "already-friend": BlogSearchResult[];
            "already-requesting": BlogSearchResult[];
            failed: BlogSearchResult[];
        } = {
            success: [],
            "already-friend": [],
            "already-requesting": [],
            failed: [],
        };

        friendRequestTargets.forEach((blog) => {
            const status = blogStatuses.get(blog.url);
            if (status && status in result) {
                result[status as keyof typeof result].push(blog);
            }
        });

        return result;
    }, [friendRequestTargets, blogStatuses]);

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
            setLoginTestModalTitle("입력 오류");
            setLoginTestModalMessage("아이디와 비밀번호를 모두 입력해주세요.");
            setLoginTestModalType("error");
            setLoginTestModalOpen(true);
            return;
        }

        if (friendRequestTargets.length === 0) {
            setLoginTestModalTitle("입력 오류");
            setLoginTestModalMessage(
                "먼저 블로그를 검색하고 서이추 목록에 추가해주세요."
            );
            setLoginTestModalType("error");
            setLoginTestModalOpen(true);
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

            // 성공 모달 표시
            setLoginTestModalTitle("로그인 테스트 성공");
            setLoginTestModalMessage(
                `✅ 로그인 테스트가 성공적으로 완료되었습니다.\n블로그: ${testBlog.title}`
            );
            setLoginTestModalType("success");
            setLoginTestModalOpen(true);
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

            // 실패 모달 표시
            setLoginTestModalTitle("로그인 테스트 실패");
            setLoginTestModalMessage(
                `❌ 로그인 테스트에 실패했습니다.\n\n${errorMessage}`
            );
            setLoginTestModalType("error");
            setLoginTestModalOpen(true);
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

            // 소켓 초기화 (없으면 생성, 있으면 재사용)
            const { ensureSocketInitialized } = await import(
                "@/lib/utils/socketInit"
            );
            const socketInitialized = await ensureSocketInitialized(sessionId);
            if (!socketInitialized) {
                console.warn("소켓 초기화 실패, 계속 진행...");
            }

            const logger = Logger.getInstance(sessionId);
            await logger.info(
                `🤝 ${friendRequestTargets.length}개 블로그에 서로이웃 추가 요청을 시작합니다...`
            );

            // 결과 상태 초기화: 모든 블로그를 "pending"으로 설정
            setBlogStatuses(() => {
                const newStatuses = new Map<string, BlogStatus>();
                friendRequestTargets.forEach((blog) => {
                    newStatuses.set(blog.url, "pending");
                });
                return newStatuses;
            });

            // 큐 시스템: 최대 동시 실행 수만큼만 병렬 처리
            const results: Array<{
                status: "fulfilled" | "rejected";
                value?: {
                    success: boolean;
                    blog: BlogSearchResult;
                    index: number;
                    error?: string;
                    status?:
                        | "success"
                        | "already-friend"
                        | "already-requesting"
                        | "failed";
                };
                reason?: Error | unknown;
            }> = [];

            let runningCount = 0;
            let currentIndex = 0;

            // 큐 처리 함수
            const processQueue = async () => {
                while (
                    currentIndex < friendRequestTargets.length &&
                    !signal.aborted
                ) {
                    // 중지되었는지 확인
                    if (signal.aborted) {
                        // 남은 모든 블로그를 실패 처리
                        while (currentIndex < friendRequestTargets.length) {
                            const blog = friendRequestTargets[currentIndex];
                            setBlogStatuses((prev) => {
                                const newStatuses = new Map(prev);
                                newStatuses.set(blog.url, "failed");
                                return newStatuses;
                            });
                            setBlogErrors((prev) => {
                                const newErrors = new Map(prev);
                                newErrors.set(blog.url, "중지됨");
                                return newErrors;
                            });
                            results.push({
                                status: "fulfilled",
                                value: {
                                    success: false,
                                    blog,
                                    index: currentIndex,
                                    error: "중지됨",
                                    status: "failed",
                                },
                            });
                            currentIndex++;
                        }
                        break;
                    }

                    // 최대 동시 실행 수에 도달하면 대기 (중지되었으면 즉시 종료)
                    if (runningCount >= maxConcurrent) {
                        await new Promise((resolve) =>
                            setTimeout(resolve, 100)
                        );
                        // 대기 중에도 중지되었는지 확인
                        if (signal.aborted) {
                            break;
                        }
                        continue;
                    }

                    // 다음 블로그 처리 시작
                    const blog = friendRequestTargets[currentIndex];
                    const index = currentIndex;
                    currentIndex++;

                    // 초기 상태를 "pending"으로 설정 (아직 처리 시작 전)
                    setBlogStatuses((prev) => {
                        const newStatuses = new Map(prev);
                        if (!newStatuses.has(blog.url)) {
                            newStatuses.set(blog.url, "pending");
                        }
                        return newStatuses;
                    });
                    runningCount++;

                    // 블로그 처리 함수
                    const processBlog = async () => {
                        try {
                            // 중지되었는지 확인
                            if (signal.aborted) {
                                setBlogStatuses((prev) => {
                                    const newStatuses = new Map(prev);
                                    newStatuses.set(blog.url, "failed");
                                    return newStatuses;
                                });
                                setBlogErrors((prev) => {
                                    const newErrors = new Map(prev);
                                    newErrors.set(blog.url, "중지됨");
                                    return newErrors;
                                });
                                return {
                                    success: false,
                                    blog,
                                    index,
                                    error: "중지됨",
                                    status: "failed" as const,
                                };
                            }

                            // 상태를 "processing"으로 변경
                            setBlogStatuses((prev) => {
                                const newStatuses = new Map(prev);
                                newStatuses.set(blog.url, "processing");
                                return newStatuses;
                            });

                            await logger.info(
                                `📝 블로그 ${index + 1} 처리 시작: ${
                                    blog.title
                                }`
                            );

                            // 중지되었는지 확인 (큐에 추가하기 전에)
                            if (signal.aborted) {
                                setBlogStatuses((prev) => {
                                    const newStatuses = new Map(prev);
                                    newStatuses.set(blog.url, "failed");
                                    return newStatuses;
                                });
                                setBlogErrors((prev) => {
                                    const newErrors = new Map(prev);
                                    newErrors.set(blog.url, "중지됨");
                                    return newErrors;
                                });
                                return {
                                    success: false,
                                    blog,
                                    index,
                                    error: "중지됨",
                                    status: "failed" as const,
                                };
                            }

                            // 큐에 작업 추가
                            const addResponse = await fetch("/api/queue/add", {
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
                                    sessionId: sessionId,
                                }),
                                signal,
                            });

                            if (!addResponse.ok) {
                                const errorData = await addResponse
                                    .json()
                                    .catch(() => ({}));
                                throw new Error(
                                    errorData?.error ||
                                        `큐에 작업 추가 실패 (${addResponse.status})`
                                );
                            }

                            const queueData = await addResponse.json();

                            // 큐에 추가 완료 - "queued" 상태로 이미 설정됨

                            // 중지되었는지 확인
                            if (signal.aborted) {
                                setBlogStatuses((prev) => {
                                    const newStatuses = new Map(prev);
                                    newStatuses.set(blog.url, "failed");
                                    return newStatuses;
                                });
                                setBlogErrors((prev) => {
                                    const newErrors = new Map(prev);
                                    newErrors.set(blog.url, "중지됨");
                                    return newErrors;
                                });
                                return {
                                    success: false,
                                    blog,
                                    index,
                                    error: "중지됨",
                                    status: "failed" as const,
                                };
                            }

                            // 큐에 추가된 경우 즉시 처리 완료 상태로 표시
                            // 실제 작업은 서버에서 비동기로 처리되며, 결과는 소켓 로그로 전달됨
                            await logger.info(
                                `✅ 큐에 작업 추가 완료: ${blog.title} (Queue ID: ${queueData.queueId})`
                            );

                            setBlogStatuses((prev) => {
                                const newStatuses = new Map(prev);
                                newStatuses.set(blog.url, "queued");
                                return newStatuses;
                            });

                            // 큐에 추가된 것으로 처리 (실제 결과는 서버에서 비동기로 처리됨)
                            // Note: 실제 결과는 서버에서 비동기로 처리되며, 소켓 로그로 전달됨
                            return {
                                success: true,
                                blog,
                                index,
                                status: "success" as const, // 큐에 추가된 것으로 성공 처리
                            };
                        } catch (error) {
                            if (
                                signal.aborted ||
                                error instanceof DOMException
                            ) {
                                await logger.info(
                                    `⏸️ 블로그 ${index + 1} 처리 중지: ${
                                        blog.title
                                    }`
                                );
                                setBlogStatuses((prev) => {
                                    const newStatuses = new Map(prev);
                                    newStatuses.set(blog.url, "failed");
                                    return newStatuses;
                                });
                                setBlogErrors((prev) => {
                                    const newErrors = new Map(prev);
                                    newErrors.set(blog.url, "중지됨");
                                    return newErrors;
                                });
                                return {
                                    success: false,
                                    blog,
                                    index,
                                    error: "중지됨",
                                    status: "failed" as const,
                                };
                            }

                            const errorMessage =
                                error instanceof Error
                                    ? error.message
                                    : "알 수 없는 오류";
                            setBlogStatuses((prev) => {
                                const newStatuses = new Map(prev);
                                newStatuses.set(blog.url, "failed");
                                return newStatuses;
                            });
                            setBlogErrors((prev) => {
                                const newErrors = new Map(prev);
                                newErrors.set(blog.url, errorMessage);
                                return newErrors;
                            });
                            await logger.error(
                                `❌ 블로그 ${
                                    index + 1
                                } 서로이웃 추가 실패: ${errorMessage}`
                            );
                            return {
                                success: false,
                                blog,
                                index,
                                error: errorMessage,
                                status: "failed" as const,
                            };
                        } finally {
                            runningCount--;
                        }
                    };

                    // 블로그 처리 시작 (비동기로 실행)
                    processBlog()
                        .then((result) => {
                            results.push({
                                status: "fulfilled",
                                value: result,
                            });
                        })
                        .catch((error) => {
                            results.push({
                                status: "rejected",
                                reason: error,
                            });
                        });
                }

                // 모든 작업이 완료될 때까지 대기 (중지되었으면 즉시 종료)
                while (runningCount > 0 && !signal.aborted) {
                    await new Promise((resolve) => setTimeout(resolve, 100));
                }

                // 중지되었으면 남은 작업들도 즉시 종료
                if (signal.aborted) {
                    // 진행 중이었던 블로그들을 실패 처리
                    friendRequestTargets.forEach((blog) => {
                        const currentStatus = blogStatuses.get(blog.url);
                        if (
                            currentStatus === "pending" ||
                            currentStatus === "processing" ||
                            currentStatus === "queued"
                        ) {
                            setBlogStatuses((prev) => {
                                const newStatuses = new Map(prev);
                                newStatuses.set(blog.url, "failed");
                                return newStatuses;
                            });
                            setBlogErrors((prev) => {
                                const newErrors = new Map(prev);
                                newErrors.set(blog.url, "중지됨");
                                return newErrors;
                            });
                        }
                    });
                }
            };

            // 큐 처리 시작
            await processQueue();

            // 중지되었는지 확인
            if (signal.aborted) {
                const logger = Logger.getInstance("friend-request");
                await logger.info("⏸️ 서로이웃 추가 요청이 중지되었습니다.");
                return;
            }

            // 성공/실패 분리
            const successResults = results.filter(
                (r) => r.status === "fulfilled" && r.value?.success
            );
            const failResults = results.filter(
                (r) =>
                    r.status === "rejected" ||
                    (r.status === "fulfilled" && !r.value?.success)
            );

            const successCount = successResults.length;
            const failCount = failResults.length;

            // 성공한 블로그 리스트
            const successList = successResults
                .map((r) => {
                    if (r.status === "fulfilled" && r.value?.success) {
                        return r.value.blog?.title || "알 수 없음";
                    }
                    return null;
                })
                .filter((title): title is string => title !== null)
                .join(", ");

            await logger.info(
                `🎉 서로이웃 추가 완료! 성공: ${successCount}개, 실패: ${failCount}개`
            );

            // 성공한 블로그 리스트 출력
            if (successList) {
                await logger.success(`✅ 성공한 블로그: ${successList}`);
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

                                <div className="h-64 overflow-y-auto space-y-2">
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
                            <h5 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-4">
                                📊 서이추 진행 상태
                            </h5>
                            {/* 선형 프로그레스 바 */}
                            <div className="mb-4">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs text-gray-600 dark:text-gray-400">
                                        전체 진행률
                                    </span>
                                    <span className="text-xs font-medium text-blue-800 dark:text-blue-200">
                                        {progressPercentage}%
                                    </span>
                                </div>
                                <Progress
                                    value={progressPercentage}
                                    className="h-2"
                                />
                            </div>
                            <div className="space-y-3 text-xs">
                                {/* 첫 번째 줄: 블로그 갯수 | 그래프 */}
                                <div className="flex items-center justify-between">
                                    {/* 블로그 대상 수 */}
                                    <div className="flex-1">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-blue-700 dark:text-blue-300 font-medium">
                                                블로그 갯수
                                            </span>
                                            <span className="px-2 py-1 rounded bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                                                {friendRequestTargets.length}개
                                            </span>
                                        </div>
                                        <div className="space-y-1.5">
                                            <div className="flex items-center justify-between pl-2">
                                                <span className="text-gray-600 dark:text-gray-400">
                                                    대기중/큐:
                                                </span>
                                                <span className="px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                                                    {
                                                        Array.from(
                                                            blogStatuses.values()
                                                        ).filter(
                                                            (status) =>
                                                                status ===
                                                                    "pending" ||
                                                                status ===
                                                                    "queued"
                                                        ).length
                                                    }
                                                    개
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between pl-2">
                                                <span className="text-gray-600 dark:text-gray-400">
                                                    진행중:
                                                </span>
                                                <span className="px-2 py-0.5 rounded bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200">
                                                    {
                                                        Array.from(
                                                            blogStatuses.values()
                                                        ).filter(
                                                            (status) =>
                                                                status ===
                                                                    "processing" ||
                                                                status ===
                                                                    "queued"
                                                        ).length
                                                    }
                                                    개
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    {/* 원형 프로그레스 (RadialBarChart) */}
                                </div>

                                {/* 두 번째 줄: 결과 */}
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-blue-700 dark:text-blue-300 font-medium">
                                            결과
                                        </span>
                                    </div>
                                    <div className="space-y-1.5">
                                        <div className="flex items-center justify-between pl-2">
                                            <span className="text-gray-600 dark:text-gray-400">
                                                서이추 성공
                                            </span>
                                            <span className="px-2 py-0.5 rounded bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
                                                {
                                                    Array.from(
                                                        blogStatuses.values()
                                                    ).filter(
                                                        (status) =>
                                                            status === "success"
                                                    ).length
                                                }
                                                개
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between pl-2">
                                            <span className="text-gray-600 dark:text-gray-400">
                                                이미 이웃입니다.
                                            </span>
                                            <span className="px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                                                {
                                                    Array.from(
                                                        blogStatuses.values()
                                                    ).filter(
                                                        (status) =>
                                                            status ===
                                                            "already-friend"
                                                    ).length
                                                }
                                                개
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between pl-2">
                                            <span className="text-gray-600 dark:text-gray-400">
                                                신청중입니다.
                                            </span>
                                            <span className="px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200">
                                                {
                                                    Array.from(
                                                        blogStatuses.values()
                                                    ).filter(
                                                        (status) =>
                                                            status ===
                                                            "already-requesting"
                                                    ).length
                                                }
                                                개
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between pl-2">
                                            <span className="text-gray-600 dark:text-gray-400">
                                                실패입니다.
                                            </span>
                                            <span className="px-2 py-0.5 rounded bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200">
                                                {
                                                    Array.from(
                                                        blogStatuses.values()
                                                    ).filter(
                                                        (status) =>
                                                            status === "failed"
                                                    ).length
                                                }
                                                개
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* 세 번째 줄: 결과 상세 */}
                                <div>
                                    <div className="mb-2">
                                        <span className="text-blue-700 dark:text-blue-300 font-medium">
                                            결과 상세
                                        </span>
                                    </div>
                                    <Accordion
                                        type="single"
                                        collapsible
                                        className="w-full"
                                    >
                                        {/* 서이추 성공 */}
                                        {blogsByStatus.success.length > 0 && (
                                            <AccordionItem value="success">
                                                <AccordionTrigger className="text-xs py-2">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-green-600 dark:text-green-400 font-medium">
                                                            서이추 성공
                                                        </span>
                                                        <span className="px-2 py-0.5 rounded bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 text-xs">
                                                            {
                                                                blogsByStatus
                                                                    .success
                                                                    .length
                                                            }
                                                            개
                                                        </span>
                                                    </div>
                                                </AccordionTrigger>
                                                <AccordionContent>
                                                    <div className="max-h-48 overflow-y-auto space-y-1.5 pr-2">
                                                        {blogsByStatus.success.map(
                                                            (blog, index) => (
                                                                <div
                                                                    key={index}
                                                                    className="flex items-center justify-between p-2 rounded bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800"
                                                                >
                                                                    <a
                                                                        href={
                                                                            blog.url
                                                                        }
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="text-xs text-green-700 dark:text-green-300 hover:underline truncate flex-1"
                                                                        title={
                                                                            blog.title
                                                                        }
                                                                    >
                                                                        {
                                                                            blog.title
                                                                        }
                                                                    </a>
                                                                </div>
                                                            )
                                                        )}
                                                    </div>
                                                </AccordionContent>
                                            </AccordionItem>
                                        )}

                                        {/* 이미 이웃 */}
                                        {blogsByStatus["already-friend"]
                                            .length > 0 && (
                                            <AccordionItem value="already-friend">
                                                <AccordionTrigger className="text-xs py-2">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-blue-600 dark:text-blue-400 font-medium">
                                                            이미 이웃입니다.
                                                        </span>
                                                        <span className="px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs">
                                                            {
                                                                blogsByStatus[
                                                                    "already-friend"
                                                                ].length
                                                            }
                                                            개
                                                        </span>
                                                    </div>
                                                </AccordionTrigger>
                                                <AccordionContent>
                                                    <div className="max-h-48 overflow-y-auto space-y-1.5 pr-2">
                                                        {blogsByStatus[
                                                            "already-friend"
                                                        ].map((blog, index) => (
                                                            <div
                                                                key={index}
                                                                className="flex items-center justify-between p-2 rounded bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800"
                                                            >
                                                                <a
                                                                    href={
                                                                        blog.url
                                                                    }
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="text-xs text-blue-700 dark:text-blue-300 hover:underline truncate flex-1"
                                                                    title={
                                                                        blog.title
                                                                    }
                                                                >
                                                                    {blog.title}
                                                                </a>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </AccordionContent>
                                            </AccordionItem>
                                        )}

                                        {/* 신청중 */}
                                        {blogsByStatus["already-requesting"]
                                            .length > 0 && (
                                            <AccordionItem value="already-requesting">
                                                <AccordionTrigger className="text-xs py-2">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-purple-600 dark:text-purple-400 font-medium">
                                                            신청중입니다.
                                                        </span>
                                                        <span className="px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 text-xs">
                                                            {
                                                                blogsByStatus[
                                                                    "already-requesting"
                                                                ].length
                                                            }
                                                            개
                                                        </span>
                                                    </div>
                                                </AccordionTrigger>
                                                <AccordionContent>
                                                    <div className="max-h-48 overflow-y-auto space-y-1.5 pr-2">
                                                        {blogsByStatus[
                                                            "already-requesting"
                                                        ].map((blog, index) => (
                                                            <div
                                                                key={index}
                                                                className="flex items-center justify-between p-2 rounded bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800"
                                                            >
                                                                <a
                                                                    href={
                                                                        blog.url
                                                                    }
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="text-xs text-purple-700 dark:text-purple-300 hover:underline truncate flex-1"
                                                                    title={
                                                                        blog.title
                                                                    }
                                                                >
                                                                    {blog.title}
                                                                </a>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </AccordionContent>
                                            </AccordionItem>
                                        )}

                                        {/* 실패 */}
                                        {blogsByStatus.failed.length > 0 && (
                                            <AccordionItem value="failed">
                                                <AccordionTrigger className="text-xs py-2">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-red-600 dark:text-red-400 font-medium">
                                                            실패입니다.
                                                        </span>
                                                        <span className="px-2 py-0.5 rounded bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 text-xs">
                                                            {
                                                                blogsByStatus
                                                                    .failed
                                                                    .length
                                                            }
                                                            개
                                                        </span>
                                                    </div>
                                                </AccordionTrigger>
                                                <AccordionContent>
                                                    <div className="max-h-48 overflow-y-auto space-y-1.5 pr-2">
                                                        {blogsByStatus.failed.map(
                                                            (blog, index) => {
                                                                const errorMessage =
                                                                    blogErrors.get(
                                                                        blog.url
                                                                    ) ||
                                                                    "알 수 없는 오류";
                                                                return (
                                                                    <div
                                                                        key={
                                                                            index
                                                                        }
                                                                        className="flex flex-col gap-1 p-2 rounded bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
                                                                    >
                                                                        <a
                                                                            href={
                                                                                blog.url
                                                                            }
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            className="text-xs text-red-700 dark:text-red-300 hover:underline truncate"
                                                                            title={
                                                                                blog.title
                                                                            }
                                                                        >
                                                                            {
                                                                                blog.title
                                                                            }
                                                                        </a>
                                                                        <div className="text-xs text-red-600 dark:text-red-400 opacity-75 line-clamp-2">
                                                                            {
                                                                                errorMessage
                                                                            }
                                                                        </div>
                                                                    </div>
                                                                );
                                                            }
                                                        )}
                                                    </div>
                                                </AccordionContent>
                                            </AccordionItem>
                                        )}
                                    </Accordion>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 로그인 테스트 결과 모달 */}
            <Dialog
                open={loginTestModalOpen}
                onOpenChange={setLoginTestModalOpen}
            >
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle
                            className={
                                loginTestModalType === "success"
                                    ? "text-green-600 dark:text-green-400"
                                    : "text-red-600 dark:text-red-400"
                            }
                        >
                            {loginTestModalTitle}
                        </DialogTitle>
                        <DialogDescription className="whitespace-pre-line pt-2 text-sm">
                            {loginTestModalMessage}
                        </DialogDescription>
                    </DialogHeader>
                </DialogContent>
            </Dialog>
        </div>
    );
}
