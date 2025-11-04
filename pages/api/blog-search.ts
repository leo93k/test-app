import { NextApiRequest, NextApiResponse } from "next";
import { Server as HTTPServer } from "http";
import { chromium } from "playwright";
import { Logger } from "@/service/logger";
import { initializeSocketServer } from "@/service/socket";
import {
    blogItemContainerSelectors,
    blogTitleSelectors,
    blogDescriptionSelectors,
    blogAuthorSelectors,
} from "@/const/selectors";

interface BlogSearchResult {
    title: string;
    url: string;
    description: string;
    author: string;
    date: string;
    platform: string;
}

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

    try {
        const { keyword, pageNumbers = [1, 2, 3, 4, 5], sessionId } = req.body;

        if (!keyword) {
            return res.status(400).json({ error: "키워드가 필요합니다." });
        }

        // Logger 인스턴스 생성 (클라이언트에서 전송한 sessionId 사용, 없으면 생성)
        const loggerSessionId =
            sessionId || `blog-search-${keyword}-${Date.now()}`;
        const logger = Logger.getInstance(loggerSessionId);

        const browser = await chromium.launch({
            headless: true,
        });

        const context = await browser.newContext({
            userAgent:
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        });

        try {
            const allResults: BlogSearchResult[] = [];

            await logger.info(
                `네이버 블로그 검색 시작: "${keyword}" - ${pageNumbers.length}개 페이지 병렬 처리`
            );

            const blogUrl = `https://section.blog.naver.com/Search/Blog.naver`;

            const searchPromises = pageNumbers.map(async (pageNo: number) => {
                try {
                    const page = await context.newPage();

                    const query: Record<string, string> = {};
                    query.pageNo = pageNo.toString();
                    query.rangeType = "ALL";
                    query.orderBy = "sim";
                    query.keyword = keyword;

                    const naverUrl = `${blogUrl}?${new URLSearchParams(
                        query
                    ).toString()}`;

                    await page.goto(naverUrl, { waitUntil: "networkidle" });

                    // 디버깅을 위해 페이지 제목과 URL 확인
                    const pageTitle = await page.title();
                    const currentUrl = page.url();
                    await logger.info(
                        `네이버 블로그 검색 페이지 ${pageNo}: ${pageTitle} (${currentUrl})`
                    );

                    const naverResults = await page.evaluate(
                        (selectors: {
                            container: string[];
                            title: string[];
                            description: string[];
                            author: string[];
                        }): BlogSearchResult[] => {
                            // 다양한 가능한 셀렉터 시도
                            const possibleSelectors = selectors.container;

                            let blogItems: NodeListOf<Element> | null = null;
                            let usedSelector = "";

                            for (const selector of possibleSelectors) {
                                const items =
                                    document.querySelectorAll(selector);
                                if (items.length > 0) {
                                    blogItems = items;
                                    usedSelector = selector;
                                    break;
                                }
                            }

                            if (!blogItems) {
                                return [];
                            }

                            const searchResults: BlogSearchResult[] = [];

                            blogItems.forEach((item, index) => {
                                if (index >= 10) return; // 페이지당 최대 10개

                                // 다양한 가능한 셀렉터 시도
                                const titleSelectors = selectors.title;
                                const descSelectors = selectors.description;
                                const authorSelectors = selectors.author;

                                let titleElement: Element | null = null;
                                let descriptionElement: Element | null = null;
                                let authorElement: Element | null = null;
                                let blogUrlElement: Element | null = null;

                                // 제목 찾기
                                for (const selector of titleSelectors) {
                                    const el = item.querySelector(selector);
                                    if (el && el.textContent?.trim()) {
                                        titleElement = el;
                                        break;
                                    }
                                }

                                // URL 찾기
                                blogUrlElement =
                                    item.querySelector(
                                        'a[href*="blog.naver.com"]'
                                    ) || titleElement;

                                // 설명 찾기
                                for (const selector of descSelectors) {
                                    const el = item.querySelector(selector);
                                    if (el && el.textContent?.trim()) {
                                        descriptionElement = el;
                                        break;
                                    }
                                }

                                // 작성자 찾기
                                for (const selector of authorSelectors) {
                                    const el = item.querySelector(selector);
                                    if (el && el.textContent?.trim()) {
                                        authorElement = el;
                                        break;
                                    }
                                }

                                if (titleElement && blogUrlElement) {
                                    const title =
                                        titleElement.textContent?.trim() || "";
                                    const url =
                                        blogUrlElement.getAttribute("href") ||
                                        "";
                                    const description =
                                        descriptionElement?.textContent?.trim() ||
                                        "";
                                    const author =
                                        authorElement?.textContent?.trim() ||
                                        "";

                                    searchResults.push({
                                        title,
                                        url: url.startsWith("http")
                                            ? url
                                            : `https://blog.naver.com${url}`,
                                        description,
                                        author,
                                        date: "", // 네이버 블로그 검색에서는 날짜 정보가 없음
                                        platform: "네이버 블로그",
                                    });
                                }
                            });

                            return searchResults;
                        },
                        {
                            container: blogItemContainerSelectors,
                            title: blogTitleSelectors,
                            description: blogDescriptionSelectors,
                            author: blogAuthorSelectors,
                        }
                    );

                    await page.close();
                    await logger.success(
                        `페이지 ${pageNo}에서 ${naverResults.length}개 결과 수집`
                    );

                    return naverResults;
                } catch (error) {
                    await logger.error(
                        `네이버 검색 페이지 ${pageNo} 오류: ${
                            error instanceof Error
                                ? error.message
                                : String(error)
                        }`
                    );
                    return [];
                }
            });

            // 모든 페이지 검색 완료 대기
            const allNaverResults = await Promise.all(searchPromises);
            allResults.push(...allNaverResults.flat());
            await browser.close();

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
        // 에러 발생 시에도 Logger 사용 시도 (세션이 없을 수 있음)
        try {
            const sessionId = `blog-search-error-${Date.now()}`;
            const logger = Logger.getInstance(sessionId);
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
