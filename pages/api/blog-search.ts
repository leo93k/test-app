import { NextApiRequest, NextApiResponse } from "next";
import { Server as HTTPServer } from "http";
import { chromium } from "playwright";
import { Logger } from "@/service/logger";
import { initializeSocketServer } from "@/service/socket";
import { generateRandomUserAgent } from "@/service/crawler/utils/browserUtils";
import { createBlogSearchService } from "@/service/crawler/blogSearchService/blogSearchService";

type NextApiResponseWithSocket = NextApiResponse & {
    socket: {
        server: HTTPServer;
    };
};

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponseWithSocket
) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    // Socket.io 서버 초기화 (로그 전송을 위해)
    await initializeSocketServer(res.socket.server);

    // 요청이 중단되었는지 확인하는 플래그
    let isAborted = false;

    // 요청 중단 감지 (클라이언트가 연결을 끊으면 req.destroyed가 true가 됨)
    req.on("close", () => {
        isAborted = true;
    });

    try {
        const { keyword, pageNumbers = [1, 2, 3, 4, 5], sessionId } = req.body;

        if (!keyword) {
            return res.status(400).json({ error: "키워드가 필요합니다." });
        }

        // Logger 인스턴스 생성 (클라이언트에서 전송한 sessionId 필수 사용)
        if (!sessionId) {
            return res.status(400).json({
                error: "sessionId가 필요합니다. 클라이언트에서 sessionId를 전송해주세요.",
            });
        }
        const logger = Logger.getInstance(sessionId);

        const browser = await chromium.launch({
            headless: true,
        });

        // User-Agent 랜덤 생성 (자동로그인 방지 우회)
        const randomUserAgent = generateRandomUserAgent();
        await logger.info(`🔀 생성된 User-Agent: ${randomUserAgent}`);
        const context = await browser.newContext({
            userAgent: randomUserAgent,
        });

        try {
            // 블로그 검색 수행
            const blogSearchService = createBlogSearchService(context, logger);
            const allResults = await blogSearchService.execute({
                keyword,
                pageNumbers,
                isAborted: () => isAborted,
            });
            await browser.close();

            // 중지되었는지 확인
            if (isAborted) {
                await logger.info("검색이 중지되었습니다.");
                return res.status(499).json({
                    success: false,
                    error: "검색이 중지되었습니다.",
                    results: allResults,
                    keyword,
                    totalCount: allResults.length,
                });
            }

            await logger.success(
                `블로그 검색 완료: 총 ${allResults.length}개 결과 수집 (키워드: ${keyword})`
            );

            return res.status(200).json({
                success: true,
                results: allResults,
                keyword,
                totalCount: allResults.length,
            });
        } catch (error) {
            await browser.close();
            throw error;
        }
    } catch (error) {
        // 에러 발생 시에도 Logger 사용 시도 (sessionId가 있으면 사용)
        try {
            const { nanoid } = await import("nanoid");
            const errorSessionId = req.body.sessionId || `error-${nanoid()}`;
            const logger = Logger.getInstance(errorSessionId);
            await logger.error(
                `블로그 검색 오류: ${
                    error instanceof Error ? error.message : String(error)
                }`
            );
        } catch {
            // Logger 초기화 실패 시 기본 console.error 사용
            console.error("Blog search error:", error);
        }

        return res.status(500).json({
            error: "블로그 검색 중 오류가 발생했습니다.",
            details: error instanceof Error ? error.message : "Unknown error",
        });
    }
}
