/* eslint-disable @typescript-eslint/no-explicit-any */
import { chromium, Browser, BrowserContext, Page } from "playwright";
import { nanoid } from "nanoid";
import { createLoginService } from "./loginService";
import { Logger } from "@/service/logger";
import { createFriendRequestService } from "./friendRequestService";
import { validateUrl } from "@/lib/utils/validation";
import { createCrawlService } from "./utils/crawlService";
import { DEFAULT_TIMEOUT, LOGIN_URL } from "@/const";
import {
    getChromeArgs,
    generateRandomUserAgent,
    getBotDetectionBypassScript,
} from "./utils/browserUtils";

export interface CrawlOptions {
    url: string;
    username?: string;
    password?: string;
    keepOpen?: boolean;
    headless?: boolean;
    friendRequest?: boolean;
    message?: string;
    sessionId?: string;
}

export interface CrawlResult {
    success: boolean;
    status?: "success" | "failed" | "already-friend" | "already-requesting";
    error?: string;
    data?: {
        browserKeptOpen: boolean;
    };
}

/**
 * 크롤링 실행 함수 (서버 사이드에서 직접 호출 가능)
 */
export async function executeCrawl(
    options: CrawlOptions
): Promise<CrawlResult> {
    const {
        url,
        username,
        password,
        keepOpen = false,
        headless = false,
        friendRequest = false,
        message = "",
        sessionId,
    } = options;

    // URL 유효성 검사
    const urlError = validateUrl(url);
    if (urlError) {
        return {
            success: false,
            error: urlError,
        };
    }

    // Logger 인스턴스 생성
    const loggerSessionId = sessionId || `server-${nanoid()}`;
    const logger = Logger.getInstance(loggerSessionId);

    let browser: Browser | null = null;
    let context: BrowserContext | null = null;
    let page: Page | null = null;
    let loginPage: Page | null = null;

    try {
        await logger.info(`크롤링 시작: ${url}`);

        // Playwright 브라우저 실행
        await logger.info(
            `브라우저 실행 중... (${
                headless ? "백그라운드" : "화면 표시"
            } 모드)`
        );
        const chromeArgs = getChromeArgs(headless);

        browser = await chromium.launch({
            headless: headless,
            slowMo: headless ? 0 : 1000,
            args: chromeArgs,
        });
        await logger.success(
            `브라우저 실행 완료 (${headless ? "백그라운드" : "화면 표시"} 모드)`
        );

        // 컨텍스트 생성 (세션 공유를 위해)
        const randomUserAgent = generateRandomUserAgent();
        await logger.info(`🔀 생성된 User-Agent: ${randomUserAgent}`);

        context = await browser.newContext({
            userAgent: randomUserAgent,
            viewport: { width: 1920, height: 1080 },
            locale: "ko-KR",
            timezoneId: "Asia/Seoul",
            permissions: ["geolocation"],
            extraHTTPHeaders: {
                "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
                Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
                "Accept-Encoding": "gzip, deflate, br",
                Connection: "keep-alive",
                "Upgrade-Insecure-Requests": "1",
                "Sec-Fetch-Dest": "document",
                "Sec-Fetch-Mode": "navigate",
                "Sec-Fetch-Site": "none",
                "Sec-Fetch-User": "?1",
                "Cache-Control": "max-age=0",
            },
        });

        // 컨텍스트 타임아웃 설정
        context.setDefaultTimeout(DEFAULT_TIMEOUT);
        context.setDefaultNavigationTimeout(DEFAULT_TIMEOUT);

        // WebDriver 탐지 우회를 위한 JavaScript 추가
        await context.addInitScript(getBotDetectionBypassScript());

        // 로그인 정보가 제공된 경우 먼저 로그인 수행 (서로이웃 추가 모드가 아닐 때만)
        if (username && password && !friendRequest) {
            await logger.info("🔐 로그인 수행 중...");

            loginPage = await context.newPage();
            const crawlService = createCrawlService(logger);

            await crawlService.navigateToPage(loginPage, LOGIN_URL, {
                headless,
                timeout: DEFAULT_TIMEOUT,
                retry: false,
            });

            const loginService = createLoginService(loginPage, logger);
            const loginResult = await loginService.execute({
                username,
                password,
            });

            if (!loginResult.success) {
                await logger.error(`로그인 실패: ${loginResult.message}`);
                return {
                    success: false,
                    error: loginResult.message,
                };
            }

            await logger.success("✅ 로그인 완료");
        }

        // 작업 페이지 생성 (로그인된 컨텍스트 사용)
        page = await context.newPage();

        // 페이지 로드 및 대기
        const crawlService = createCrawlService(logger);
        await crawlService.navigateToPage(page, url, {
            headless,
            timeout: DEFAULT_TIMEOUT,
            retry: false,
            waitUntil: headless ? "networkidle" : "domcontentloaded",
        });

        if (!friendRequest) {
            return {
                success: true,
                data: {
                    browserKeptOpen: keepOpen,
                },
            };
        }

        // 서로이웃 추가 모드인 경우
        let friendRequestStatus:
            | "success"
            | "already-friend"
            | "already-requesting"
            | "failed";
        let friendRequestError: string | undefined;

        try {
            const friendRequestService = createFriendRequestService(
                page,
                logger
            );
            friendRequestStatus = await friendRequestService.execute({
                username: username || "",
                password: password || "",
                message,
                originalUrl: url,
            });
        } catch (error) {
            friendRequestStatus = "failed";
            friendRequestError =
                error instanceof Error ? error.message : "알 수 없는 오류";
        }

        if (friendRequestStatus === "failed") {
            return {
                success: false,
                status: friendRequestStatus,
                error: friendRequestError || "서로이웃 추가에 실패했습니다.",
                data: {
                    browserKeptOpen: false,
                },
            };
        }

        return {
            success: true,
            status: friendRequestStatus,
            data: {
                browserKeptOpen: false,
            },
        };
    } catch (error) {
        await logger.error(
            `크롤링 오류: ${
                error instanceof Error ? error.message : "알 수 없는 오류"
            }`
        );

        // 에러 발생 시 에러 메시지가 포함된 결과 반환
        const errorMessage =
            error instanceof Error ? error.message : "알 수 없는 오류";

        // 페이지 로딩 실패인 경우 특별 처리
        if (
            errorMessage.includes("Timeout") ||
            errorMessage.includes("timeout")
        ) {
            return {
                success: false,
                error: `페이지 로딩 타임아웃: 페이지 로딩 시간(${DEFAULT_TIMEOUT}ms)을 초과했습니다.`,
            };
        }

        return {
            success: false,
            status: "failed",
            error: errorMessage,
        };
    } finally {
        // 리소스 정리: keepOpen이 false일 때만 브라우저를 닫음
        // keepOpen이 true인 경우 브라우저는 유지되어야 하므로 정리하지 않음
        if (!keepOpen && (browser || context || page || loginPage)) {
            try {
                // 페이지들 먼저 정리
                if (loginPage && !loginPage.isClosed()) {
                    await loginPage.close().catch((err) => {
                        logger
                            .error(`로그인 페이지 닫기 오류: ${err}`)
                            .catch(() => {});
                    });
                }

                if (page && !page.isClosed()) {
                    await page.close().catch((err) => {
                        logger
                            .error(`작업 페이지 닫기 오류: ${err}`)
                            .catch(() => {});
                    });
                }

                // 컨텍스트 정리
                if (context) {
                    await context.close().catch((err) => {
                        logger
                            .error(`컨텍스트 닫기 오류: ${err}`)
                            .catch(() => {});
                    });
                }

                // 브라우저 정리
                if (browser) {
                    await browser.close().catch((err) => {
                        logger
                            .error(`브라우저 닫기 오류: ${err}`)
                            .catch(() => {});
                    });
                    await logger.info("리소스 정리 완료").catch(() => {});
                }
            } catch (cleanupError) {
                await logger
                    .error(
                        `리소스 정리 중 오류 발생: ${
                            cleanupError instanceof Error
                                ? cleanupError.message
                                : "알 수 없는 오류"
                        }`
                    )
                    .catch(() => {});
            }
        } else if (keepOpen && browser) {
            // keepOpen이 true인 경우 로그만 남김
            await logger
                .info(
                    "keepOpen 옵션이 활성화되어 브라우저를 유지합니다. 수동으로 정리해야 합니다."
                )
                .catch(() => {});
        }
    }
}
