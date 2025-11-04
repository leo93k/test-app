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
import {
    NAVER_BLOG_SEARCH_URL,
    PAGE_LOAD_TIMEOUT,
    PAGE_NAVIGATION_DELAY,
} from "@/const";

interface BlogSearchResult {
    title: string;
    url: string;
    description: string;
    author: string;
    date: string;
    platform: string;
}

/**
 * 정상 방법: 구조화된 블로그 아이템을 파싱하여 결과 생성
 * 셀렉터로 블로그 아이템을 찾았을 때 사용
 */
function parseStructuredBlogItems(
    blogItems: NodeListOf<Element>,
    selectors: {
        title: string[];
        description: string[];
        author: string[];
    }
): BlogSearchResult[] {
    const searchResults: BlogSearchResult[] = [];

    blogItems.forEach((item, index) => {
        if (index >= 10) return; // 페이지당 최대 10개

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
            item.querySelector('a[href*="blog.naver.com"]') || titleElement;

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
            const title = titleElement.textContent?.trim() || "";
            const url = blogUrlElement.getAttribute("href") || "";
            const description = descriptionElement?.textContent?.trim() || "";
            const author = authorElement?.textContent?.trim() || "";

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

        const context = await browser.newContext({
            userAgent:
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        });

        try {
            const allResults: BlogSearchResult[] = [];

            await logger.info(
                `네이버 블로그 검색 시작: "${keyword}" - ${pageNumbers.length}개 페이지 병렬 처리`
            );

            const searchPromises = pageNumbers.map(async (pageNo: number) => {
                await logger.info(`페이지 ${pageNo} 검색 시작`);

                // 중지되었는지 확인
                if (isAborted) {
                    await logger.info(
                        `검색이 중지되어 페이지 ${pageNo} 처리를 건너뜁니다.`
                    );
                    return [];
                }

                try {
                    const page = await context.newPage();
                    const query: Record<string, string> = {};
                    query.pageNo = pageNo.toString();
                    query.rangeType = "ALL";
                    query.orderBy = "sim";
                    query.keyword = keyword;

                    const naverUrl = `${NAVER_BLOG_SEARCH_URL}?${new URLSearchParams(
                        query
                    ).toString()}`;

                    // 중지되었는지 확인
                    if (isAborted) {
                        await page.close();
                        await logger.info(
                            `검색이 중지되어 페이지 ${pageNo} 처리를 중단합니다.`
                        );
                        return [];
                    }

                    // 블로그 페이지 이동
                    try {
                        await logger.info(`페이지 이동! ${naverUrl}`);
                        await page.goto(naverUrl, {
                            timeout: PAGE_LOAD_TIMEOUT,
                        });
                    } catch (e) {
                        await logger.error(`페이지 ${pageNo} 로드 실패: ${e}`);
                        // networkidle 타임아웃 시 load 상태로 재시도
                        await logger.info(
                            `네트워크 유휴 상태 대기 실패, load 상태로 재시도 중... (페이지 ${pageNo})`
                        );
                        try {
                            await page.goto(naverUrl, {
                                waitUntil: "load",
                                timeout: PAGE_LOAD_TIMEOUT,
                            });
                            await logger.info(
                                `페이지 ${pageNo} 로드 완료 (load 상태)`
                            );
                        } catch {
                            // load도 실패하면 domcontentloaded로 재시도
                            await logger.info(
                                `load 상태 대기 실패, domcontentloaded로 재시도 중... (페이지 ${pageNo})`
                            );
                            await page.goto(naverUrl, {
                                waitUntil: "domcontentloaded",
                                timeout: PAGE_LOAD_TIMEOUT,
                            });
                            await logger.info(
                                `페이지 ${pageNo} 로드 완료 (domcontentloaded 상태)`
                            );
                        }
                    }

                    // 중지되었는지 다시 확인
                    if (isAborted) {
                        await page.close();
                        await logger.info(
                            `검색이 중지되어 페이지 ${pageNo} 처리를 중단합니다.`
                        );
                        return [];
                    }

                    // 디버깅을 위해 페이지 제목과 URL 확인
                    const pageTitle = await page.title();
                    const currentUrl = page.url();
                    await logger.info(
                        `네이버 블로그 검색 페이지 ${pageNo}: ${pageTitle} (${currentUrl})`
                    );

                    // 검색 결과가 렌더링될 때까지 대기
                    await logger.info(
                        `페이지 ${pageNo} 검색 결과 렌더링 대기 중...`
                    );
                    await page.waitForTimeout(PAGE_NAVIGATION_DELAY);

                    // 함수를 문자열로 변환하여 브라우저 컨텍스트에 전달
                    const parseFunctionsCode = `
                        ${parseStructuredBlogItems.toString()}
                    `;

                    const naverResults = await page.evaluate(
                        (args: {
                            selectors: {
                                container: string[];
                                title: string[];
                                description: string[];
                                author: string[];
                            };
                            functionsCode: string;
                        }): BlogSearchResult[] => {
                            // 함수 코드를 실행하여 함수들을 정의
                            eval(args.functionsCode);

                            // 다양한 가능한 셀렉터 시도
                            const possibleSelectors = args.selectors.container;

                            let blogItems: NodeListOf<Element> | null = null;

                            // 다양한 셀렉터 시도
                            for (const selector of possibleSelectors) {
                                const items =
                                    document.querySelectorAll(selector);
                                if (items.length > 0) {
                                    blogItems = items;
                                    break;
                                }
                            }

                            // 셀렉터로 블로그 아이템을 찾지 못한 경우
                            if (!blogItems) {
                                return [];
                            }

                            // 정상 방법: 구조화된 블로그 아이템 파싱
                            return parseStructuredBlogItems(blogItems, {
                                title: args.selectors.title,
                                description: args.selectors.description,
                                author: args.selectors.author,
                            });
                        },
                        {
                            selectors: {
                                container: blogItemContainerSelectors,
                                title: blogTitleSelectors,
                                description: blogDescriptionSelectors,
                                author: blogAuthorSelectors,
                            },
                            functionsCode: parseFunctionsCode,
                        }
                    );

                    // 결과 로깅
                    if (naverResults.length > 0) {
                        await logger.info(
                            `✅ [페이지 ${pageNo}] 정상 방법: ${naverResults.length}개 블로그 아이템 파싱 완료`
                        );
                    }

                    await page.close();

                    // 결과가 없을 때 디버깅 정보 추가
                    if (naverResults.length === 0) {
                        await logger.error(
                            `⚠️ 페이지 ${pageNo}에서 결과를 찾을 수 없습니다. 다시 시도해주세요.`
                        );
                    } else {
                        await logger.success(
                            `페이지 ${pageNo}에서 ${naverResults.length}개 결과 수집`
                        );
                    }

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
            const errorSessionId =
                req.body.sessionId ||
                `error-${Date.now()}-${Math.random()
                    .toString(36)
                    .substr(2, 9)}`;
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
