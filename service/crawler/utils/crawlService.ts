/* eslint-disable @typescript-eslint/no-explicit-any */
import { Page, ElementHandle, Frame } from "playwright";
import { Logger } from "@/service/logger";
import {
    SELECTOR_WAIT_TIMEOUT,
    PAGE_LOAD_TIMEOUT,
    DEFAULT_TIMEOUT,
} from "@/const";

/**
 * selector를 찾을 수 있는 타겟 인터페이스
 * Page, Frame, ElementHandle 등에서 공통으로 사용 가능
 */
interface SelectableTarget {
    $(selector: string): Promise<ElementHandle | null>;
    waitForSelector?(
        selector: string,
        options?: { timeout?: number }
    ): Promise<ElementHandle | null>;
}

/**
 * 요소를 찾는 옵션
 */
export interface FindElementOptions {
    /** 로그에 표시할 컨텍스트 이름 (예: "아이디 입력 필드", "로그인 버튼") */
    contextName?: string;
    /** waitForSelector 타임아웃 (밀리초) */
    waitTimeout?: number;
    /** waitForSelector 사용 여부 */
    useWaitForSelector?: boolean;
}

/**
 * 페이지 네비게이션 옵션
 */
export interface NavigateOptions {
    /** 로그에 표시할 컨텍스트 이름 (예: "블로그 페이지", "로그인 페이지") */
    contextName?: string;
    /** 타임아웃 시간 (밀리초) */
    timeout?: number;
    /** 재시도 로직 사용 여부 */
    retry?: boolean;
    /** waitUntil 옵션 ("load" | "domcontentloaded" | "networkidle") */
    waitUntil?: "load" | "domcontentloaded" | "networkidle";
}

/**
 * 크롤링 서비스 클래스
 */
export class CrawlService {
    private logger: Logger;

    constructor(logger: Logger) {
        this.logger = logger;
    }

    /**
     * selector 배열을 순회하며 요소를 찾는 공통 메서드
     */
    async findElement(
        target: SelectableTarget,
        selectors: string[],
        options: FindElementOptions = {}
    ): Promise<ElementHandle | null> {
        const {
            contextName = "요소",
            waitTimeout = SELECTOR_WAIT_TIMEOUT,
            useWaitForSelector = true,
        } = options;

        for (const selector of selectors) {
            try {
                await this.logger.info(
                    `🔍 ${contextName} 찾기 시도: ${selector}`
                );

                // waitForSelector 사용 (headless 모드 대응)
                if (useWaitForSelector && target.waitForSelector) {
                    try {
                        await target.waitForSelector(selector, {
                            timeout: waitTimeout,
                        });
                        await this.logger.info(
                            `✅ 셀렉터 "${selector}"로 요소 발견됨`
                        );
                    } catch {
                        await this.logger.info(
                            `⏳ 셀렉터 "${selector}" 대기 시간 초과, 직접 찾기 시도`
                        );
                    }
                }

                const element = await target.$(selector);
                if (element) {
                    await this.logger.success(
                        `✅ ${contextName} 발견: ${selector}`
                    );
                    return element;
                } else {
                    await this.logger.info(
                        `❌ 셀렉터 "${selector}"로 요소를 찾을 수 없음`
                    );
                }
            } catch (error) {
                await this.logger.info(
                    `❌ 셀렉터 "${selector}" 시도 중 오류: ${
                        error instanceof Error ? error.message : String(error)
                    }`
                );
                continue;
            }
        }

        await this.logger.info(
            `⚠️ ${contextName} 찾기 실패: 모든 셀렉터 시도 완료`
        );
        return null;
    }

    /**
     * 요소를 찾고 클릭하는 공통 메서드
     */
    async findAndClick(
        target: SelectableTarget,
        selectors: string[],
        options: FindElementOptions = {},
        clickOptions: { force?: boolean } = {}
    ): Promise<boolean> {
        const contextName = options.contextName || "버튼";
        const element = await this.findElement(target, selectors, options);

        if (!element) {
            await this.logger.info(
                `⚠️ ${contextName}을 찾을 수 없어 클릭할 수 없습니다.`
            );
            return false;
        }

        try {
            // force 옵션이 있고 Page나 Frame인 경우 직접 click 사용
            if (
                clickOptions.force &&
                "click" in target &&
                typeof (target as any).click === "function"
            ) {
                const foundSelector = selectors.find(() => true) || "";
                await (target as any).click(foundSelector, { force: true });
                await this.logger.success(
                    `✅ ${contextName} 클릭 완료 (force)`
                );
            } else {
                await element.click();
                await this.logger.success(`✅ ${contextName} 클릭 완료`);
            }
            return true;
        } catch (error) {
            await this.logger.error(
                `❌ ${contextName} 클릭 중 오류: ${
                    error instanceof Error ? error.message : String(error)
                }`
            );
            return false;
        }
    }

    /**
     * 요소를 찾고 값을 입력하는 공통 메서드
     */
    async findAndFill(
        target: SelectableTarget,
        selectors: string[],
        value: string,
        options: FindElementOptions = {}
    ): Promise<boolean> {
        const contextName = options.contextName || "입력 필드";
        const element = await this.findElement(target, selectors, options);

        if (!element) {
            await this.logger.info(
                `⚠️ ${contextName}을 찾을 수 없어 입력할 수 없습니다.`
            );
            return false;
        }

        try {
            await element.fill(value);
            await this.logger.success(`✅ ${contextName} 입력 완료`);
            return true;
        } catch (error) {
            await this.logger.error(
                `❌ ${contextName} 입력 중 오류: ${
                    error instanceof Error ? error.message : String(error)
                }`
            );
            return false;
        }
    }

    /**
     * 요소를 찾고 type으로 입력하는 공통 메서드 (인간적인 타이핑 시뮬레이션)
     */
    async findAndType(
        target: SelectableTarget,
        selectors: string[],
        value: string,
        options: FindElementOptions = {},
        typeOptions: { delay?: number } = {}
    ): Promise<boolean> {
        const contextName = options.contextName || "입력 필드";
        const element = await this.findElement(target, selectors, options);

        if (!element) {
            await this.logger.info(
                `⚠️ ${contextName}을 찾을 수 없어 입력할 수 없습니다.`
            );
            return false;
        }

        try {
            // 기존 내용 지우기
            await element.fill("");

            // 각 문자를 개별적으로 입력
            for (let i = 0; i < value.length; i++) {
                const char = value[i];
                await element.type(char, {
                    delay: typeOptions.delay || 50 + Math.random() * 100, // 50-150ms 사이의 랜덤 딜레이
                });

                // 가끔씩 더 긴 딜레이 (사용자가 생각하는 것처럼)
                if (
                    Math.random() < 0.1 &&
                    i > 0 &&
                    (target as any).waitForTimeout
                ) {
                    await (target as any).waitForTimeout(
                        200 + Math.random() * 300
                    );
                }
            }

            await this.logger.success(
                `✅ ${contextName} 입력 완료 (타이핑 시뮬레이션)`
            );
            return true;
        } catch (error) {
            await this.logger.error(
                `❌ ${contextName} 입력 중 오류: ${
                    error instanceof Error ? error.message : String(error)
                }`
            );
            return false;
        }
    }

    /**
     * 로그와 함께 대기하는 메서드
     */
    async waitWithLog(
        target: Page | Frame,
        message: string,
        timeout: number
    ): Promise<void> {
        await this.logger.info(message);
        await target.waitForTimeout(timeout);
    }

    /**
     * 페이지로 이동 (재시도 로직 포함)
     */
    async navigateWithRetry(
        page: Page,
        url: string,
        options: NavigateOptions = {}
    ): Promise<void> {
        const {
            contextName = "페이지",
            timeout = PAGE_LOAD_TIMEOUT,
            retry = true,
            waitUntil,
        } = options;

        try {
            await this.logger.info(`페이지 이동! ${url}`);
            await page.goto(url, {
                waitUntil,
                timeout,
            });
            await this.logger.success(`${contextName} 이동 완료`);
        } catch (e) {
            await this.logger.error(`${contextName} 로드 실패: ${e}`);

            if (!retry) {
                throw e;
            }

            // networkidle 타임아웃 시 load 상태로 재시도
            await this.logger.info(
                `네트워크 유휴 상태 대기 실패, load 상태로 재시도 중...`
            );
            try {
                await page.goto(url, {
                    waitUntil: "load",
                    timeout,
                });
                await this.logger.success(
                    `${contextName} 로드 완료 (load 상태)`
                );
            } catch {
                // load도 실패하면 domcontentloaded로 재시도
                await this.logger.info(
                    `load 상태 대기 실패, domcontentloaded로 재시도 중...`
                );
                await page.goto(url, {
                    waitUntil: "domcontentloaded",
                    timeout,
                });
                await this.logger.success(
                    `${contextName} 로드 완료 (domcontentloaded 상태)`
                );
            }
        }
    }

    /**
     * 페이지로 이동 (간단한 버전)
     */
    async navigate(
        page: Page,
        url: string,
        options: NavigateOptions = {}
    ): Promise<void> {
        const {
            contextName = "페이지",
            timeout = DEFAULT_TIMEOUT,
            retry = false,
            waitUntil,
        } = options;

        if (retry) {
            return this.navigateWithRetry(page, url, {
                contextName,
                timeout,
                waitUntil,
            });
        }

        await this.logger.info(`페이지 로딩 시작: ${url}`);
        await page.goto(url, {
            waitUntil,
            timeout,
        });
        await this.logger.success(`페이지 로딩 완료: ${url}`);
    }

    /**
     * 페이지로 이동 및 로드 완료 확인 (제목 로깅 포함)
     */
    async navigateToPage(
        page: Page,
        url: string,
        options: {
            headless?: boolean;
            timeout?: number;
            retry?: boolean;
            waitUntil?: "load" | "domcontentloaded" | "networkidle";
        } = {}
    ): Promise<void> {
        const {
            headless = true,
            timeout = DEFAULT_TIMEOUT,
            retry = false,
            waitUntil,
        } = options;

        const navigateOptions: NavigateOptions = {
            contextName: "페이지",
            timeout,
            retry,
            waitUntil:
                waitUntil || (headless ? "networkidle" : "domcontentloaded"),
        };

        try {
            await this.navigate(page, url, navigateOptions);

            // 페이지 제목을 로그에 출력
            try {
                const title = await page.title();
                await this.logger.success(`페이지 로드 완료: ${title}`);
            } catch (titleError) {
                await this.logger.info(
                    `페이지 제목을 가져올 수 없습니다: ${titleError}`
                );
            }
        } catch (error) {
            // 타임아웃 또는 네비게이션 에러 처리
            const errorMessage =
                error instanceof Error ? error.message : String(error);
            await this.logger.error(`페이지 로딩 실패: ${errorMessage}`);
            throw error;
        }
    }
}

/**
 * 크롤링 서비스 인스턴스 생성
 */
export function createCrawlService(logger: Logger): CrawlService {
    return new CrawlService(logger);
}

// ==================== 유틸리티 함수 ====================

/**
 * Page 타입 가드
 */
export function isPage(target: any): target is Page {
    return target && typeof target.url === "function";
}

/**
 * Frame 타입 가드
 */
export function isFrame(target: any): target is Frame {
    return target && typeof target.url === "function" && !target.browser;
}
