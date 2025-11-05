import { NextApiRequest, NextApiResponse } from "next";
import { Server as HTTPServer } from "http";
import { chromium } from "playwright";
import { createLoginService } from "@/service/crawler/loginService";
import { Logger } from "@/service/logger";
import { initializeSocketServer } from "@/service/socket";
import { createFriendRequestService } from "@/service/crawler/friendRequestService";
import { DEFAULT_TIMEOUT } from "@/const";
import {
    getChromeArgs,
    generateRandomUserAgent,
} from "@/service/crawler/utils/browserUtils";
import { navigate } from "@/service/crawler/utils/navigationUtils";

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

        const page = await browser.newPage();

        // 타임아웃 설정
        page.setDefaultTimeout(DEFAULT_TIMEOUT);
        page.setDefaultNavigationTimeout(DEFAULT_TIMEOUT);

        // User-Agent 설정 (랜덤 생성)
        const randomUserAgent = generateRandomUserAgent();
        await logger.info(`🔀 생성된 User-Agent: ${randomUserAgent}`);
        await page.setExtraHTTPHeaders({
            "User-Agent": randomUserAgent,
        });

        // headless 모드에서는 뷰포트 크기 설정
        if (headless) {
            await page.setViewportSize({ width: 1920, height: 1080 });
        }

        // 페이지 로드 및 대기
        try {
            await navigate(page, url, logger, {
                contextName: "페이지",
                timeout: DEFAULT_TIMEOUT,
                retry: false,
                waitUntil: headless ? "networkidle" : "domcontentloaded",
            });

            // 페이지 제목을 로그에 출력
            try {
                const title = await page.title();
                await logger.success(`페이지 로드 완료: ${title}`);
            } catch (titleError) {
                await logger.info(
                    `페이지 제목을 가져올 수 없습니다: ${titleError}`
                );
            }
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

        // 로그인 정보가 제공된 경우 자동 로그인 시도 (서로이웃 추가 모드가 아닐 때만)
        if (username && password && !friendRequest) {
            await logger.info("자동 로그인 시도 중...");
            const loginService = createLoginService(page, logger);
            const loginResult = await loginService.execute({
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
