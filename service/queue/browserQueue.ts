// 서버 사이드 큐 관리 시스템
import { nanoid } from "nanoid";
import { MAX_CONCURRENT, QUEUE_ID_PREFIX } from "@/const/queue";

// Socket.io 타입 정의
interface ServerSocket {
    id: string;
    data: {
        sessionId?: string;
    };
    emit: (event: string, ...args: unknown[]) => void;
}

interface SocketIOServer {
    fetchSockets: () => Promise<ServerSocket[]>;
}

interface QueueItem {
    id: string;
    url: string;
    headless: boolean;
    username?: string;
    password?: string;
    sessionId?: string;
    friendRequest?: boolean;
    message?: string;
    createdAt: number;
}

interface QueueStatus {
    queueLength: number;
    runningCount: number;
    maxConcurrent: number;
}

class ServerQueue {
    private queue: QueueItem[] = [];
    private running: Map<string, QueueItem> = new Map();
    private maxConcurrent: number = MAX_CONCURRENT;
    private isProcessing: boolean = false; // Race Condition 방지용 플래그

    /**
     * 큐에 작업 추가
     */
    async add(item: Omit<QueueItem, "id" | "createdAt">): Promise<string> {
        const id = `${QUEUE_ID_PREFIX}-${nanoid()}`;
        const queueItem: QueueItem = {
            ...item,
            id,
            createdAt: Date.now(),
        };

        this.queue.push(queueItem);
        console.log(
            `[Queue] 작업 추가: ${id}, 큐 길이: ${this.queue.length}, 실행 중: ${this.running.size}`
        );
        // 큐 처리 (비동기이지만 에러 처리)
        void this.processQueue().catch((error) => {
            console.error(`[Queue] 작업 추가 후 큐 처리 오류:`, error);
        });

        return id;
    }

    /**
     * 큐 처리 (비동기)
     * Race Condition 방지를 위해 동시 실행을 방지합니다.
     */
    private async processQueue(): Promise<void> {
        // 이미 처리 중이면 중복 실행 방지
        if (this.isProcessing) {
            return;
        }

        // 실행 한도 도달 또는 큐가 비어있으면 종료
        if (
            this.running.size >= this.maxConcurrent ||
            this.queue.length === 0
        ) {
            if (this.queue.length > 0) {
                console.log(
                    `[Queue] 대기 중: 실행 한도 도달 (${this.running.size}/${this.maxConcurrent}), 큐 길이: ${this.queue.length}`
                );
            }
            return;
        }

        // 처리 시작
        this.isProcessing = true;

        try {
            // 큐에서 아이템 가져오기 (원자적 연산)
            const item = this.queue.shift();
            if (!item) {
                this.isProcessing = false;
                return;
            }

            // 실행 중인 작업에 추가 (원자적 연산)
            this.running.set(item.id, item);
            console.log(
                `[Queue] 작업 시작: ${item.id}, 큐 길이: ${this.queue.length}, 실행 중: ${this.running.size}`
            );

            // 처리 플래그 해제 (다음 항목 처리 가능)
            this.isProcessing = false;

            // 비동기로 실행 (await하지 않음)
            this.executeBrowser(item)
                .then(() => {
                    console.log(
                        `[Queue] 작업 완료: ${item.id}, 실행 중: ${this.running.size}`
                    );
                    this.running.delete(item.id);
                    // 다음 아이템 처리
                    setTimeout(() => this.processQueue(), 100);
                })
                .catch((error) => {
                    console.error(`[Queue] 작업 실패: ${item.id}`, error);
                    this.running.delete(item.id);
                    // 다음 아이템 처리
                    setTimeout(() => this.processQueue(), 100);
                });
        } catch (error) {
            // 오류 발생 시 처리 플래그 해제
            this.isProcessing = false;
            console.error(`[Queue] 큐 처리 중 오류:`, error);
        }
    }

    /**
     * 브라우저 실행 (내부 함수)
     */
    private async executeBrowser(item: QueueItem): Promise<void> {
        try {
            // 크롤링 실행 서비스 직접 호출
            const { executeCrawl } = await import("../crawler/crawlExecutor");
            const result = await executeCrawl({
                url: item.url,
                username: item.username,
                password: item.password,
                keepOpen: false,
                headless: item.headless,
                friendRequest: item.friendRequest || false,
                message: item.message || "",
                sessionId: item.sessionId,
            });

            // 작업 완료 결과를 소켓으로 전송
            if (item.sessionId) {
                try {
                    const { getSocketServer } = await import("../socket");
                    const { SOCKET_EVENTS } = await import(
                        "@/const/socketEvents"
                    );
                    const io = await getSocketServer();

                    if (io) {
                        // 해당 세션의 클라이언트에만 결과 전송
                        const sockets = await io.fetchSockets();
                        const sessionSockets = sockets.filter(
                            (socket: ServerSocket) =>
                                socket.data.sessionId === item.sessionId
                        );

                        const resultData = {
                            url: item.url,
                            success: result.success,
                            status:
                                result.status ||
                                (result.success ? "success" : "failed"),
                            error: result.error,
                        };

                        for (const socket of sessionSockets) {
                            socket.emit(SOCKET_EVENTS.QUEUE_RESULT, resultData);
                        }

                        console.log(
                            `[Queue] 작업 결과 전송: ${item.id}, 상태: ${resultData.status}, 세션: ${item.sessionId}`
                        );
                    }
                } catch (socketError) {
                    console.error(
                        `[Queue] 소켓 결과 전송 오류: ${socketError}`
                    );
                }
            }

            if (!result.success) {
                throw new Error(result.error || "크롤링 실행 실패");
            }
        } catch (error) {
            console.error(`[Queue] 작업 실행 오류: ${item.id}`, error);

            // 에러도 소켓으로 전송
            if (item.sessionId) {
                try {
                    const { getSocketServer } = await import("../socket");
                    const { SOCKET_EVENTS } = await import(
                        "@/const/socketEvents"
                    );
                    const io = await getSocketServer();

                    if (io) {
                        const sockets = await io.fetchSockets();
                        const sessionSockets = sockets.filter(
                            (socket: ServerSocket) =>
                                socket.data.sessionId === item.sessionId
                        );

                        const errorData = {
                            url: item.url,
                            success: false,
                            status: "failed" as const,
                            error:
                                error instanceof Error
                                    ? error.message
                                    : "알 수 없는 오류",
                        };

                        for (const socket of sessionSockets) {
                            socket.emit(SOCKET_EVENTS.QUEUE_RESULT, errorData);
                        }
                    }
                } catch (socketError) {
                    console.error(
                        `[Queue] 소켓 에러 전송 오류: ${socketError}`
                    );
                }
            }

            throw error;
        }
    }

    /**
     * 큐 상태 조회
     */
    getQueueStatus(): QueueStatus {
        return {
            queueLength: this.queue.length,
            runningCount: this.running.size,
            maxConcurrent: this.maxConcurrent,
        };
    }

    /**
     * 실행 중인 작업 목록 조회
     */
    getRunningItems(): QueueItem[] {
        return Array.from(this.running.values());
    }

    /**
     * 대기 중인 작업 목록 조회
     */
    getWaitingItems(): QueueItem[] {
        return [...this.queue];
    }

    /**
     * 특정 작업 조회
     */
    getItem(id: string): QueueItem | null {
        // 실행 중인 작업에서 찾기
        const runningItem = this.running.get(id);
        if (runningItem) return runningItem;

        // 대기 중인 작업에서 찾기
        return this.queue.find((item) => item.id === id) || null;
    }

    /**
     * 작업 제거 (대기 중인 작업만)
     */
    removeItem(id: string): boolean {
        const index = this.queue.findIndex((item) => item.id === id);
        if (index !== -1) {
            this.queue.splice(index, 1);
            return true;
        }
        return false;
    }

    /**
     * 최대 동시 실행 수 설정 (고정값 5)
     * @deprecated 최대 동시 실행 수는 5로 고정되어 있습니다.
     */
    setMaxConcurrent(max: number): void {
        // 최대 동시 실행 수는 MAX_CONCURRENT로 고정
        this.maxConcurrent = MAX_CONCURRENT;
        // 설정 변경 시 큐 처리 재시도 (비동기이지만 에러 처리)
        void this.processQueue().catch((error) => {
            console.error(`[Queue] setMaxConcurrent 후 큐 처리 오류:`, error);
        });
    }
}

// 전역 서버 사이드 큐 인스턴스 (싱글톤)
let serverQueueInstance: ServerQueue | null = null;

export function getServerQueue(): ServerQueue {
    if (!serverQueueInstance) {
        serverQueueInstance = new ServerQueue();
    }
    return serverQueueInstance;
}
