/* eslint-disable @typescript-eslint/no-explicit-any */
// 브라우저 실행 큐 관리 시스템

import { store } from "./store";

// 설정값을 가져오는 함수
const getSettings = () => {
    try {
        // Redux store에서 설정값 가져오기
        const state = store.getState();
        const { maxConcurrent, autoCloseDelay } = state.settings;

        return {
            maxConcurrent,
            autoCloseDelay,
        };
    } catch (error) {
        console.error("설정 로드 실패:", error);
        // 기본값 반환
        return {
            maxConcurrent: 10,
            autoCloseDelay: 0.5,
        };
    }
};

interface QueueItem {
    id: string;
    url: string;
    headless: boolean;
    resolve: (value: any) => void;
    reject: (error: any) => void;
}

class BrowserQueue {
    private queue: QueueItem[] = [];
    private running: Set<string> = new Set();

    async add(url: string, headless: boolean): Promise<any> {
        return new Promise((resolve, reject) => {
            const id =
                Date.now().toString() + Math.random().toString(36).substr(2, 9);

            const queueItem: QueueItem = {
                id,
                url,
                headless,
                resolve,
                reject,
            };

            this.queue.push(queueItem);
            this.processQueue();
        });
    }

    private async processQueue() {
        const settings = getSettings();
        const maxConcurrent = settings.maxConcurrent;

        if (this.running.size >= maxConcurrent || this.queue.length === 0) {
            return;
        }

        const item = this.queue.shift();
        if (!item) return;

        this.running.add(item.id);

        try {
            const result = await this.executeBrowser(item);
            item.resolve(result);
        } catch (error) {
            item.reject(error);
        } finally {
            this.running.delete(item.id);
            // 다음 아이템 처리
            setTimeout(() => this.processQueue(), 100);
        }
    }

    private async executeBrowser(item: QueueItem): Promise<any> {
        const settings = getSettings();

        try {
            const response = await fetch("/api/crawl", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    url: item.url,
                    username: "",
                    password: "",
                    keepOpen: false,
                    autoCloseDelay: settings.autoCloseDelay,
                    headless: item.headless,
                }),
            });

            // 응답 본문 읽기 (한 번만 읽을 수 있음)
            const text = await response.text();

            // 빈 응답 확인
            if (!text || text.trim() === "") {
                throw new Error("서버가 빈 응답을 반환했습니다");
            }

            // JSON 파싱 시도
            let data;
            try {
                data = JSON.parse(text);
            } catch (parseError) {
                throw new Error(
                    `응답 파싱 실패: ${
                        parseError instanceof Error
                            ? parseError.message
                            : "알 수 없는 오류"
                    }. 응답 내용: ${text.substring(0, 200)}`
                );
            }

            if (!response.ok) {
                throw new Error(
                    data?.error ||
                        data?.details ||
                        `브라우저 실행 실패 (${response.status})`
                );
            }

            return { url: item.url, id: item.id };
        } catch (error) {
            // 네트워크 오류나 기타 오류 처리
            if (error instanceof TypeError && error.message.includes("fetch")) {
                throw new Error("네트워크 오류: 서버에 연결할 수 없습니다");
            }
            throw error;
        }
    }

    getQueueStatus() {
        const settings = getSettings();
        return {
            queueLength: this.queue.length,
            runningCount: this.running.size,
            maxConcurrent: settings.maxConcurrent,
        };
    }
}

// 전역 큐 인스턴스
export const browserQueue = new BrowserQueue();
