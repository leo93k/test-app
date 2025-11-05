import { NextApiRequest, NextApiResponse } from "next";
import { Server as HTTPServer } from "http";
import { chromium } from "playwright";
import { createLoginService } from "@/service/crawler/loginService";
import { Logger } from "@/service/logger";
import { initializeSocketServer } from "@/service/socket";
import { createFriendRequestService } from "@/service/crawler/friendRequestService";
import { validateUrl, sendValidationError } from "@/lib/utils/validation";
import { createCrawlService } from "@/service/crawler/utils/crawlService";
import { DEFAULT_TIMEOUT, LOGIN_URL } from "@/const";
import {
    getChromeArgs,
    generateRandomUserAgent,
    getBotDetectionBypassScript,
} from "@/service/crawler/utils/browserUtils";

type NextApiResponseWithSocket = NextApiResponse & {
    socket: {
        server: HTTPServer;
    };
};

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponseWithSocket
) {
    // POST 메서드만 허용
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    // Socket.io 서버 초기화 (로깅을 위해)
    await initializeSocketServer(res.socket.server);

    let browser = null;
    // 클라이언트에서 전송한 sessionId 사용, 없으면 생성
    const sessionId =
        req.body.sessionId ||
        `server-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const logger = Logger.getInstance(sessionId);

    try {
        const {
            url,
            username,
            password,
            keepOpen = false,
            headless = false,
            friendRequest = false,
            message = "",
        } = req.body;

        // URL 유효성 검사
        const urlError = validateUrl(url);
        if (urlError) {
            return sendValidationError(res, urlError);
        }

        await logger.info(`크롤링 시작: ${url}`);

        // Playwright 브라우저 실행
        await logger.info(
            `브라우저 실행 중... (${
                headless ? "백그라운드" : "화면 표시"
            } 모드)`
        );
        // 봇 탐지 우회를 위한 Chrome 인자
        const chromeArgs = getChromeArgs(headless);

        browser = await chromium.launch({
            headless: headless, // 백그라운드 실행 여부
            slowMo: headless ? 0 : 1000, // 백그라운드 모드에서는 대기 시간 없음
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

            // 로그인 페이지 생성
            const loginPage = await context.newPage();
            const crawlService = createCrawlService(logger);

            try {
                // 로그인 페이지로 이동
                await crawlService.navigateToPage(loginPage, LOGIN_URL, {
                    headless,
                    timeout: DEFAULT_TIMEOUT,
                    retry: false,
                });

                // 로그인 수행
                const loginService = createLoginService(loginPage, logger);
                const loginResult = await loginService.execute({
                    username,
                    password,
                });

                if (!loginResult.success) {
                    await logger.error(`로그인 실패: ${loginResult.message}`);
                    await loginPage.close();
                    await browser.close();
                    return res.status(400).json({
                        success: false,
                        error: loginResult.message,
                    });
                }

                await logger.success("✅ 로그인 완료");
                await loginPage.close(); // 로그인 페이지는 닫기
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
            // 타임아웃 또는 네비게이션 에러 처리
            const errorMessage =
                gotoError instanceof Error
                    ? gotoError.message
                    : String(gotoError);
            await logger.error(`페이지 로딩 실패: ${errorMessage}`);

            // 브라우저 정리
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

            // 타임아웃 에러인 경우 명확한 메시지 반환
            if (
                errorMessage.includes("Timeout") ||
                errorMessage.includes("timeout")
            ) {
                return res.status(500).json({
                    success: false,
                    status: "failed",
                    error: "페이지 로딩 타임아웃",
                    details: `페이지 로딩 시간(${DEFAULT_TIMEOUT}ms)을 초과했습니다. 네트워크 상태를 확인하거나 URL을 다시 확인해주세요.`,
                });
            }

            // 기타 네비게이션 에러
            return res.status(500).json({
                success: false,
                status: "failed",
                error: "페이지 로딩 실패",
                details: errorMessage,
            });
        }

        // 이미 컨텍스트에서 로그인을 수행했으므로, 여기서는 작업만 수행

        if (!friendRequest) {
            return res.status(200).json({
                success: true,
                data: {
                    browserKeptOpen: keepOpen,
                },
            });
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
                username,
                password,
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

        // status가 "failed"인 경우 에러 메시지와 함께 반환
        if (friendRequestStatus === "failed") {
            return res.status(200).json({
                success: false,
                status: friendRequestStatus,
                error: friendRequestError || "서로이웃 추가에 실패했습니다.",
                data: {
                    browserKeptOpen: false,
                },
            });
        }

        return res.status(200).json({
            success: true,
            status: friendRequestStatus, // "success" | "already-friend" | "already-requesting"
            data: {
                browserKeptOpen: false,
            },
        });
    } catch (error) {
        await logger.error(
            `크롤링 오류: ${
                error instanceof Error ? error.message : "알 수 없는 오류"
            }`
        );

        // 브라우저가 열려있다면 닫기
        if (browser) {
            try {
                await logger.info("오류로 인해 브라우저 강제 닫기 시작...");
                await browser.close();
                await logger.success("오류로 인해 브라우저를 닫았습니다");
            } catch (closeError) {
                await logger.error(`브라우저 닫기 오류: ${closeError}`);
            }
        }

        return res.status(500).json({
            success: false,
            status: "failed",
            error: "Failed to crawl the website",
            details: error instanceof Error ? error.message : "Unknown error",
        });
    }
}
