/* eslint-disable @typescript-eslint/no-explicit-any */
// 클라이언트 사이드 브라우저 큐 래퍼 (서버 사이드 큐 API 호출)
import { MAX_CONCURRENT } from "@/const/queue";

interface QueueStatus {
    queueLength: number;
    runningCount: number;
    maxConcurrent: number;
}

class BrowserQueue {
    /**
     * 서버 사이드 큐에 작업 추가
     */
    async add(
        url: string,
        headless: boolean,
        options?: {
            username?: string;
            password?: string;
            sessionId?: string;
        }
    ): Promise<{ url: string; queueId: string }> {
        try {
            const response = await fetch("/api/queue/add", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    url,
                    headless,
                    username: options?.username || "",
                    password: options?.password || "",
                    sessionId: options?.sessionId,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(
                    errorData?.error ||
                        `큐에 작업 추가 실패 (${response.status})`
                );
            }

            const data = await response.json();
            return {
                url,
                queueId: data.queueId,
            };
        } catch (error) {
            // 네트워크 오류나 기타 오류 처리
            if (error instanceof TypeError && error.message.includes("fetch")) {
                throw new Error("네트워크 오류: 서버에 연결할 수 없습니다");
            }
            throw error;
        }
    }

    /**
     * 서버 사이드 큐 상태 조회
     */
    async getQueueStatus(): Promise<QueueStatus> {
        try {
            const response = await fetch("/api/queue/status", {
                method: "GET",
            });

            if (!response.ok) {
                throw new Error(`큐 상태 조회 실패 (${response.status})`);
            }

            const data = await response.json();
            return {
                queueLength: data.queueLength || 0,
                runningCount: data.runningCount || 0,
                maxConcurrent: data.maxConcurrent || MAX_CONCURRENT,
            };
        } catch (error) {
            console.error("Queue status fetch error:", error);
            // 기본값 반환
            return {
                queueLength: 0,
                runningCount: 0,
                maxConcurrent: MAX_CONCURRENT,
            };
        }
    }
}

// 전역 큐 인스턴스
export const browserQueue = new BrowserQueue();
