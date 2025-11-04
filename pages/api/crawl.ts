import { NextApiRequest, NextApiResponse } from "next";
import { Server as HTTPServer } from "http";
import { chromium } from "playwright";
import { AutoLoginService } from "@/service/loginService";
import { Logger } from "@/service/logger";
import { initializeSocketServer } from "@/service/socket";
import { executeFriendRequestProcess } from "@/service/crawler/friendRequestFlow";
import { DEFAULT_TIMEOUT } from "@/const";

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

        if (!url) {
            return res.status(400).json({ error: "URL is required" });
        }

        // URL 유효성 검사
        try {
            new URL(url);
        } catch {
            return res.status(400).json({ error: "Invalid URL format" });
        }

        await logger.info(`크롤링 시작: ${url}`);

        // Playwright 브라우저 실행
        await logger.info(
            `브라우저 실행 중... (${
                headless ? "백그라운드" : "화면 표시"
            } 모드)`
        );
        browser = await chromium.launch({
            headless: headless, // 백그라운드 실행 여부
            slowMo: headless ? 0 : 1000, // 백그라운드 모드에서는 대기 시간 없음
            args: [
                "--no-sandbox",
                "--disable-setuid-sandbox",
                ...(headless ? [] : ["--start-maximized"]), // 백그라운드 모드가 아닐 때만 최대화
            ],
        });
        await logger.success(
            `브라우저 실행 완료 (${headless ? "백그라운드" : "화면 표시"} 모드)`
        );

        const page = await browser.newPage();

        // 타임아웃 설정
        page.setDefaultTimeout(DEFAULT_TIMEOUT);
        page.setDefaultNavigationTimeout(DEFAULT_TIMEOUT);

        // User-Agent 설정
        await page.setExtraHTTPHeaders({
            "User-Agent":
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        });

        // headless 모드에서는 뷰포트 크기 설정
        if (headless) {
            await page.setViewportSize({ width: 1920, height: 1080 });
        }

        // 페이지 로드 및 대기
        await logger.info(`페이지 로딩 시작: ${url}`);
        await page.goto(url, {
            waitUntil: headless ? "networkidle" : "domcontentloaded",
            timeout: DEFAULT_TIMEOUT,
        });
        await logger.success(`페이지 로딩 완료: ${url}`);

        // 페이지 제목을 로그에 출력
        const title = await page.title();
        await logger.success(`페이지 로드 완료: ${title}`);

        // 로그인 정보가 제공된 경우 자동 로그인 시도 (서로이웃 추가 모드가 아닐 때만)
        if (username && password && !friendRequest) {
            await logger.info("자동 로그인 시도 중...");
            const loginService = new AutoLoginService(page, logger);
            const loginResult = await loginService.attemptLogin({
                username,
                password,
            });
            await logger.info(`로그인 결과: ${loginResult.message}`);
        }

        if (!friendRequest) {
            return res.status(200).json({
                success: true,
                data: {
                    browserKeptOpen: keepOpen,
                },
            });
        }

        // 서로이웃 추가 모드인 경우
        await executeFriendRequestProcess(
            page,
            logger,
            username,
            password,
            message,
            url
        );

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

        return res.status(200).json({
            success: true,
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
            error: "Failed to crawl the website",
            details: error instanceof Error ? error.message : "Unknown error",
        });
    }
}
