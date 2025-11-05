import { Page } from "playwright";
import { Logger } from "@/service/logger";
import { PAGE_LOAD_TIMEOUT, DEFAULT_TIMEOUT } from "@/const";

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
 * 페이지로 이동 (재시도 로직 포함)
 * networkidle 타임아웃 시 load 상태로 재시도, load도 실패하면 domcontentloaded로 재시도
 */
export async function navigateWithRetry(
    page: Page,
    url: string,
    logger: Logger,
    options: NavigateOptions = {}
): Promise<void> {
    const {
        contextName = "페이지",
        timeout = PAGE_LOAD_TIMEOUT,
        retry = true,
        waitUntil,
    } = options;

    try {
        await logger.info(`페이지 이동! ${url}`);
        await page.goto(url, {
            waitUntil,
            timeout,
        });
        await logger.success(`${contextName} 이동 완료`);
    } catch (e) {
        await logger.error(`${contextName} 로드 실패: ${e}`);

        if (!retry) {
            throw e;
        }

        // networkidle 타임아웃 시 load 상태로 재시도
        await logger.info(
            `네트워크 유휴 상태 대기 실패, load 상태로 재시도 중...`
        );
        try {
            await page.goto(url, {
                waitUntil: "load",
                timeout,
            });
            await logger.success(`${contextName} 로드 완료 (load 상태)`);
        } catch {
            // load도 실패하면 domcontentloaded로 재시도
            await logger.info(
                `load 상태 대기 실패, domcontentloaded로 재시도 중...`
            );
            await page.goto(url, {
                waitUntil: "domcontentloaded",
                timeout,
            });
            await logger.success(
                `${contextName} 로드 완료 (domcontentloaded 상태)`
            );
        }
    }
}

/**
 * 페이지로 이동 (간단한 버전)
 */
export async function navigate(
    page: Page,
    url: string,
    logger: Logger,
    options: NavigateOptions = {}
): Promise<void> {
    const {
        contextName = "페이지",
        timeout = DEFAULT_TIMEOUT,
        retry = false,
        waitUntil,
    } = options;

    if (retry) {
        return navigateWithRetry(page, url, logger, {
            contextName,
            timeout,
            waitUntil,
        });
    }

    await logger.info(`페이지 로딩 시작: ${url}`);
    await page.goto(url, {
        waitUntil,
        timeout,
    });
    await logger.success(`페이지 로딩 완료: ${url}`);
}
