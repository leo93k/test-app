/* eslint-disable @typescript-eslint/no-explicit-any */
import { Page, ElementHandle, Frame } from "playwright";
import { Logger } from "@/service/logger";
import { SELECTOR_WAIT_TIMEOUT } from "@/const";

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
interface FindElementOptions {
    /** 로그에 표시할 컨텍스트 이름 (예: "아이디 입력 필드", "로그인 버튼") */
    contextName?: string;
    /** waitForSelector 타임아웃 (밀리초) */
    waitTimeout?: number;
    /** waitForSelector 사용 여부 */
    useWaitForSelector?: boolean;
}

/**
 * selector 배열을 순회하며 요소를 찾는 공통 함수
 * @param target - Page, Frame 또는 ElementHandle
 * @param selectors - 시도할 selector 배열
 * @param logger - Logger 인스턴스
 * @param options - 옵션
 * @returns 찾은 요소 또는 null
 */
export async function findElement(
    target: SelectableTarget,
    selectors: string[],
    logger: Logger,
    options: FindElementOptions = {}
): Promise<ElementHandle | null> {
    const {
        contextName = "요소",
        waitTimeout = SELECTOR_WAIT_TIMEOUT,
        useWaitForSelector = true,
    } = options;

    for (const selector of selectors) {
        try {
            await logger.info(`🔍 ${contextName} 찾기 시도: ${selector}`);

            // waitForSelector 사용 (headless 모드 대응)
            if (useWaitForSelector && target.waitForSelector) {
                try {
                    await target.waitForSelector(selector, {
                        timeout: waitTimeout,
                    });
                    await logger.info(`✅ 셀렉터 "${selector}"로 요소 발견됨`);
                } catch {
                    await logger.info(
                        `⏳ 셀렉터 "${selector}" 대기 시간 초과, 직접 찾기 시도`
                    );
                }
            }

            const element = await target.$(selector);
            if (element) {
                await logger.success(`✅ ${contextName} 발견: ${selector}`);
                return element;
            } else {
                await logger.info(
                    `❌ 셀렉터 "${selector}"로 요소를 찾을 수 없음`
                );
            }
        } catch (error) {
            await logger.info(
                `❌ 셀렉터 "${selector}" 시도 중 오류: ${
                    error instanceof Error ? error.message : String(error)
                }`
            );
            continue;
        }
    }

    await logger.info(`⚠️ ${contextName} 찾기 실패: 모든 셀렉터 시도 완료`);
    return null;
}

/**
 * 요소를 찾고 클릭하는 공통 함수
 * @param target - Page, Frame 또는 ElementHandle
 * @param selectors - 시도할 selector 배열
 * @param logger - Logger 인스턴스
 * @param options - 옵션
 * @param clickOptions - 클릭 옵션 (force 등)
 * @returns 클릭 성공 여부
 */
export async function findAndClick(
    target: SelectableTarget,
    selectors: string[],
    logger: Logger,
    options: FindElementOptions = {},
    clickOptions: { force?: boolean } = {}
): Promise<boolean> {
    const contextName = options.contextName || "버튼";
    const element = await findElement(target, selectors, logger, options);

    if (!element) {
        await logger.info(
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
            await logger.success(`✅ ${contextName} 클릭 완료 (force)`);
        } else {
            await element.click();
            await logger.success(`✅ ${contextName} 클릭 완료`);
        }
        return true;
    } catch (error) {
        await logger.error(
            `❌ ${contextName} 클릭 중 오류: ${
                error instanceof Error ? error.message : String(error)
            }`
        );
        return false;
    }
}

/**
 * 요소를 찾고 값을 입력하는 공통 함수
 * @param target - Page, Frame 또는 ElementHandle
 * @param selectors - 시도할 selector 배열
 * @param value - 입력할 값
 * @param logger - Logger 인스턴스
 * @param options - 옵션
 * @returns 입력 성공 여부
 */
export async function findAndFill(
    target: SelectableTarget,
    selectors: string[],
    value: string,
    logger: Logger,
    options: FindElementOptions = {}
): Promise<boolean> {
    const contextName = options.contextName || "입력 필드";
    const element = await findElement(target, selectors, logger, options);

    if (!element) {
        await logger.info(
            `⚠️ ${contextName}을 찾을 수 없어 입력할 수 없습니다.`
        );
        return false;
    }

    try {
        await element.fill(value);
        await logger.success(`✅ ${contextName} 입력 완료`);
        return true;
    } catch (error) {
        await logger.error(
            `❌ ${contextName} 입력 중 오류: ${
                error instanceof Error ? error.message : String(error)
            }`
        );
        return false;
    }
}

/**
 * 요소를 찾고 type으로 입력하는 공통 함수 (인간적인 타이핑 시뮬레이션)
 * @param target - Page, Frame 또는 ElementHandle
 * @param selectors - 시도할 selector 배열
 * @param value - 입력할 값
 * @param logger - Logger 인스턴스
 * @param options - 옵션
 * @param typeOptions - type 옵션 (delay 등)
 * @returns 입력 성공 여부
 */
export async function findAndType(
    target: SelectableTarget,
    selectors: string[],
    value: string,
    logger: Logger,
    options: FindElementOptions = {},
    typeOptions: { delay?: number } = {}
): Promise<boolean> {
    const contextName = options.contextName || "입력 필드";
    const element = await findElement(target, selectors, logger, options);

    if (!element) {
        await logger.info(
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
                await (target as any).waitForTimeout(200 + Math.random() * 300);
            }
        }

        await logger.success(`✅ ${contextName} 입력 완료 (타이핑 시뮬레이션)`);
        return true;
    } catch (error) {
        await logger.error(
            `❌ ${contextName} 입력 중 오류: ${
                error instanceof Error ? error.message : String(error)
            }`
        );
        return false;
    }
}

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

/**
 * 로그와 함께 대기하는 함수
 * @param target - Page 또는 Frame (waitForTimeout 메서드가 있는 객체)
 * @param logger - Logger 인스턴스
 * @param message - 로그 메시지
 * @param timeout - 대기 시간 (밀리초)
 */
export async function waitWithLog(
    target: Page | Frame,
    logger: Logger,
    message: string,
    timeout: number
): Promise<void> {
    await logger.info(message);
    await target.waitForTimeout(timeout);
}
