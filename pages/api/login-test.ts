import { NextApiRequest, NextApiResponse } from "next";
import { Server as HTTPServer } from "http";
import { chromium } from "playwright";
import { createLoginService } from "@/service/crawler/loginService";
import { Logger } from "@/service/logger";
import { initializeSocketServer } from "@/service/socket";
import { loginButtonSelectors } from "@/const/selectors";
import {
    DEFAULT_TIMEOUT,
    PAGE_LOAD_TIMEOUT,
    ACTION_DELAY,
    PAGE_NAVIGATION_DELAY,
    SELECTOR_WAIT_TIMEOUT,
} from "@/const";
import {
    generateRandomUserAgent,
    getChromeArgs,
    getBotDetectionBypassScript,
} from "@/service/crawler/utils/browserUtils";
import { findAndClick } from "@/service/crawler/utils/crawlService";
import { navigate } from "@/service/crawler/utils/navigationUtils";

type NextApiResponseWithSocket = NextApiResponse & {
    socket: {
        server: HTTPServer;
    };
};

// findAndClickLoginButton 함수는 crawlService의 findAndClick을 사용하도록 변경됨

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
        const { url, username, password, headless = false } = req.body;

        // 필수 파라미터 검증
        if (!url) {
            return res.status(400).json({ error: "URL is required" });
        }

        if (!username || !password) {
            return res
                .status(400)
                .json({ error: "Username and password are required" });
        }

        // URL 유효성 검사
        try {
            new URL(url);
        } catch {
            return res.status(400).json({ error: "Invalid URL format" });
        }

        await logger.info(`🔐 로그인 테스트 시작: ${url}`);

        // Playwright 브라우저 실행
        await logger.info(
            `브라우저 실행 중... (${
                headless ? "백그라운드" : "화면 표시"
            } 모드)`
        );

        // AWS 환경에서 봇 탐지 우회를 위한 Chrome 인자
        const chromeArgs = getChromeArgs(headless);

        browser = await chromium.launch({
            headless: headless,
            slowMo: headless ? 0 : 1000,
            args: chromeArgs,
        });
        await logger.success(
            `브라우저 실행 완료 (${headless ? "백그라운드" : "화면 표시"} 모드)`
        );

        // 컨텍스트 생성 및 타임아웃, User-Agent 설정 (랜덤 생성)
        const randomUserAgent = generateRandomUserAgent();
        await logger.info(`🔀 생성된 User-Agent: ${randomUserAgent}`);

        // 봇 탐지 우회를 위한 추가 설정
        const context = await browser.newContext({
            userAgent: randomUserAgent,
            viewport: { width: 1920, height: 1080 }, // 표준 뷰포트 크기
            locale: "ko-KR", // 한국어 로케일
            timezoneId: "Asia/Seoul", // 한국 시간대
            permissions: ["geolocation"], // 위치 권한
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

        context.setDefaultTimeout(PAGE_LOAD_TIMEOUT);
        context.setDefaultNavigationTimeout(PAGE_LOAD_TIMEOUT);

        // WebDriver 탐지 우회를 위한 JavaScript 추가
        await context.addInitScript(getBotDetectionBypassScript());

        // 새 탭 열기
        const page = await context.newPage();

        // 페이지 로드 및 대기
        await navigate(page, url, logger, {
            contextName: "페이지",
            timeout: DEFAULT_TIMEOUT,
            retry: false,
        });

        // 원래 페이지 URL 저장 (로그인 후 돌아올 페이지)
        const originalUrl = page.url();
        await logger.info(`원래 페이지 URL 저장: ${originalUrl}`);

        // 로그인 버튼 찾기 및 클릭 (블로그 페이지에서 로그인 페이지로 이동)
        await logger.info("🔍 로그인 버튼 검색 중...");

        // 페이지 로드 완료 후 약간의 대기 시간 (동적 콘텐츠 렌더링 대기)
        await page.waitForTimeout(ACTION_DELAY);

        let loginButtonClicked = false;

        try {
            // 먼저 iframe에서 찾기 (순차 처리)
            const frames = page.frames();
            await logger.info(`📋 발견된 iframe 개수: ${frames.length}`);

            // iframe을 순차적으로 검색 (먼저 찾으면 중단)
            for (let index = 0; index < frames.length; index++) {
                const frame = frames[index];
                await logger.info(`🔍 iframe ${index + 1}에서 검색 중...`);
                loginButtonClicked = await findAndClick(
                    frame,
                    loginButtonSelectors,
                    logger,
                    {
                        contextName: `iframe ${index + 1}의 로그인 버튼`,
                        useWaitForSelector: false,
                    }
                );

                // 버튼을 찾았으면 루프 종료
                if (loginButtonClicked) {
                    break;
                }
            }

            // iframe에서 못 찾으면 메인 페이지에서 찾기
            if (!loginButtonClicked) {
                loginButtonClicked = await findAndClick(
                    page,
                    loginButtonSelectors,
                    logger,
                    {
                        contextName: "메인 페이지의 로그인 버튼",
                        useWaitForSelector: false,
                    }
                );
            }
        } catch (iframeError) {
            await logger.error(`❌ 로그인 버튼 검색 실패: ${iframeError}`);
        }

        if (!loginButtonClicked) {
            throw new Error("로그인 버튼을 찾을 수 없습니다.");
        }

        // 로그인 버튼 클릭 후 로그인 페이지 로드 대기
        await logger.info("⏳ 로그인 페이지 로드 대기 중...");
        await page.waitForTimeout(PAGE_NAVIGATION_DELAY);

        // 로그인 페이지가 로드되었는지 확인 (input#id 필드가 나타날 때까지 대기)
        try {
            await page.waitForSelector("input#id", {
                timeout: SELECTOR_WAIT_TIMEOUT,
            });
            await logger.success("✅ 로그인 페이지 로드 완료");
        } catch (error) {
            await logger.error(`⚠️ 로그인 페이지 로드 확인 실패: ${error}`);
            // 계속 진행 (페이지가 로드되었을 수도 있음)
        }

        // 로그인 시도
        await logger.info("자동 로그인 시도 중...");
        const loginService = createLoginService(page, logger);
        const loginResult = await loginService.execute({
            username,
            password,
        });

        if (!loginResult.success) {
            await logger.error(`❌ 로그인 실패: ${loginResult.message}`);
            return res.status(400).json({
                success: false,
                error: loginResult.message,
            });
        }

        // 로그인 완료 후 대기 (리다이렉트 대기)
        await logger.info("⏳ 로그인 완료 및 페이지 리다이렉트 대기 중...");

        // 현재 URL 확인
        let currentUrl = page.url();
        await logger.info(`로그인 후 현재 URL: ${currentUrl}`);

        // 추가 대기 후 URL 재확인 (리다이렉트가 지연될 수 있음)
        let redirectAttempts = 0;
        const maxRedirectAttempts = 5;

        while (redirectAttempts < maxRedirectAttempts) {
            await page.waitForTimeout(ACTION_DELAY);
            currentUrl = page.url();

            // 원래 페이지로 돌아왔는지 확인
            if (
                currentUrl === originalUrl ||
                currentUrl.startsWith(originalUrl.split("?")[0])
            ) {
                await logger.success(`✅ 원래 페이지로 돌아옴: ${currentUrl}`);
                break;
            }

            // 자동문자 입력 방지 페이지인지 확인 (캡차 또는 보안 페이지)
            if (
                currentUrl.includes("captcha") ||
                currentUrl.includes("security") ||
                currentUrl.includes("verify") ||
                currentUrl.includes("challenge") ||
                currentUrl.includes("robot") ||
                currentUrl.includes("자동입력방지")
            ) {
                await logger.error(
                    `❌ 자동문자 입력 방지 페이지로 이동됨: ${currentUrl}`
                );
                return res.status(400).json({
                    success: false,
                    error: "자동문자 입력 방지 페이지로 이동했습니다. 로그인이 실패했습니다.",
                    currentUrl: currentUrl,
                });
            }

            redirectAttempts++;
            await logger.info(
                `리다이렉트 대기 중... (${redirectAttempts}/${maxRedirectAttempts})`
            );
        }

        // 최종 URL 확인
        currentUrl = page.url();
        await logger.info(`최종 URL: ${currentUrl}`);

        // 원래 페이지로 돌아왔는지 확인
        const isOriginalPage =
            currentUrl === originalUrl ||
            currentUrl.startsWith(originalUrl.split("?")[0]) ||
            (originalUrl.includes("blog.naver.com") &&
                currentUrl.includes("blog.naver.com"));

        if (!isOriginalPage) {
            // 자동문자 입력 방지 페이지인지 다시 확인
            if (
                currentUrl.includes("captcha") ||
                currentUrl.includes("security") ||
                currentUrl.includes("verify") ||
                currentUrl.includes("challenge") ||
                currentUrl.includes("robot") ||
                currentUrl.includes("자동입력방지") ||
                currentUrl.includes("nidlogin") ||
                !currentUrl.includes("blog.naver.com")
            ) {
                await logger.error(
                    `❌ 로그인 실패: 원래 페이지로 돌아오지 못했습니다. 현재 URL: ${currentUrl}`
                );
                return res.status(400).json({
                    success: false,
                    error: "로그인 후 원래 페이지로 돌아오지 못했습니다. 자동문자 입력 방지 페이지일 수 있습니다.",
                    currentUrl: currentUrl,
                    originalUrl: originalUrl,
                });
            }
        }

        await logger.success(`✅ 로그인 테스트 성공: 원래 페이지로 돌아옴`);
        return res.status(200).json({
            success: true,
            message: "로그인 성공 및 원래 페이지 복귀 완료",
            currentUrl: currentUrl,
            originalUrl: originalUrl,
        });
    } catch (error) {
        const errorMessage =
            error instanceof Error
                ? error.message
                : "알 수 없는 오류가 발생했습니다.";
        await logger.error(`❌ 로그인 테스트 오류: ${errorMessage}`);

        return res.status(500).json({
            success: false,
            error: errorMessage,
        });
    } finally {
        // 브라우저 종료
        if (browser) {
            try {
                await browser.close();
                await logger.info("브라우저 종료 완료");
            } catch (closeError) {
                await logger.error(
                    `브라우저 종료 중 오류: ${
                        closeError instanceof Error
                            ? closeError.message
                            : "알 수 없는 오류"
                    }`
                );
            }
        }
    }
}
