/* eslint-disable @typescript-eslint/no-explicit-any */
import { chromium, Browser, BrowserContext, Page } from "playwright";
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
    const loggerSessionId =
        sessionId ||
        `server-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const logger = Logger.getInstance(loggerSessionId);

    let browser: Browser | null = null;

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

        const context = await browser.newContext({
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

            const loginPage = await context.newPage();
            const crawlService = createCrawlService(logger);

            try {
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
                    await loginPage.close();
                    await browser.close();
                    return {
                        success: false,
                        error: loginResult.message,
                    };
                }

                await logger.success("✅ 로그인 완료");
                await loginPage.close();
            } catch (error) {
                await loginPage.close();
                await browser.close();
                throw error;
            }
        }

        // 작업 페이지 생성 (로그인된 컨텍스트 사용)
        const page = await context.newPage();

        // 페이지 로드 및 대기
        try {
            const crawlService = createCrawlService(logger);
            await crawlService.navigateToPage(page, url, {
                headless,
                timeout: DEFAULT_TIMEOUT,
                retry: false,
                waitUntil: headless ? "networkidle" : "domcontentloaded",
            });
        } catch (gotoError) {
            const errorMessage =
                gotoError instanceof Error
                    ? gotoError.message
                    : String(gotoError);
            await logger.error(`페이지 로딩 실패: ${errorMessage}`);

            if (browser) {
                try {
                    await browser.close();
                    await logger.info(
                        "타임아웃으로 인해 브라우저를 닫았습니다"
                    );
                } catch (closeError) {
                    await logger.error(`브라우저 닫기 오류: ${closeError}`);
                }
            }

            return {
                success: false,
                error: errorMessage.includes("Timeout")
                    ? `페이지 로딩 타임아웃: 페이지 로딩 시간(${DEFAULT_TIMEOUT}ms)을 초과했습니다.`
                    : `페이지 로딩 실패: ${errorMessage}`,
            };
        }

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

        // 성공하면 브라우저 닫기
        if (browser) {
            try {
                await logger.info("서로이웃 추가 완료. 브라우저를 닫습니다...");
                await browser.close();
                await logger.success("브라우저를 닫았습니다");
            } catch (closeError) {
                await logger.error(`브라우저 닫기 오류: ${closeError}`);
            }
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

        if (browser) {
            try {
                await logger.info("오류로 인해 브라우저 강제 닫기 시작...");
                await browser.close();
                await logger.success("오류로 인해 브라우저를 닫았습니다");
            } catch (closeError) {
                await logger.error(`브라우저 닫기 오류: ${closeError}`);
            }
        }

        return {
            success: false,
            status: "failed",
            error:
                error instanceof Error
                    ? error.message
                    : "Failed to crawl the website",
        };
    }
}
