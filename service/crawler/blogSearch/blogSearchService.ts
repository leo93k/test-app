import { Page } from "playwright";
import { Logger } from "@/service/logger";
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
import type {
    BlogSearchResult,
    BlogSearchEvaluateResult,
    BlogSearchDebugInfo,
} from "./types";
import { parseStructuredBlogItems } from "./parser";

/**
 * 블로그 검색 URL 생성
 */
export function buildBlogSearchUrl(keyword: string, pageNo: number): string {
    const query: Record<string, string> = {
        pageNo: pageNo.toString(),
        rangeType: "ALL",
        orderBy: "sim",
        keyword: keyword,
    };

    return `${NAVER_BLOG_SEARCH_URL}?${new URLSearchParams(query).toString()}`;
}

/**
 * 블로그 검색 페이지로 이동 (재시도 로직 포함)
 */
export async function navigateToBlogSearchPage(
    page: Page,
    url: string,
    pageNo: number,
    logger: Logger
): Promise<void> {
    try {
        await logger.info(`페이지 이동! ${url}`);
        await page.goto(url, {
            timeout: PAGE_LOAD_TIMEOUT,
        });
    } catch (e) {
        await logger.error(`페이지 ${pageNo} 로드 실패: ${e}`);
        // networkidle 타임아웃 시 load 상태로 재시도
        await logger.info(
            `네트워크 유휴 상태 대기 실패, load 상태로 재시도 중... (페이지 ${pageNo})`
        );
        try {
            await page.goto(url, {
                waitUntil: "load",
                timeout: PAGE_LOAD_TIMEOUT,
            });
            await logger.info(`페이지 ${pageNo} 로드 완료 (load 상태)`);
        } catch {
            // load도 실패하면 domcontentloaded로 재시도
            await logger.info(
                `load 상태 대기 실패, domcontentloaded로 재시도 중... (페이지 ${pageNo})`
            );
            await page.goto(url, {
                waitUntil: "domcontentloaded",
                timeout: PAGE_LOAD_TIMEOUT,
            });
            await logger.info(
                `페이지 ${pageNo} 로드 완료 (domcontentloaded 상태)`
            );
        }
    }
}

/**
 * 블로그 검색 결과 파싱 함수 (브라우저 컨텍스트에서 실행할 문자열)
 */
export function getBlogSearchEvaluateFunctionCode(): string {
    return `
        function parseStructuredBlogItems(blogItems, selectors) {
            const searchResults = [];

            blogItems.forEach((item, index) => {
                if (index >= 10) return; // 페이지당 최대 10개

                const titleSelectors = selectors.title;
                const descSelectors = selectors.description;
                const authorSelectors = selectors.author;

                let titleElement = null;
                let descriptionElement = null;
                let authorElement = null;
                let blogUrlElement = null;

                // 제목 찾기
                for (const selector of titleSelectors) {
                    const el = item.querySelector(selector);
                    if (el && el.textContent?.trim()) {
                        titleElement = el;
                        break;
                    }
                }

                // URL 찾기
                blogUrlElement = item.querySelector('a[href*="blog.naver.com"]') || titleElement;

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
                        url: url.startsWith("http") ? url : "https://blog.naver.com" + url,
                        description,
                        author,
                        date: "",
                        platform: "네이버 블로그",
                    });
                }
            });

            return searchResults;
        }
    `;
}

/**
 * 블로그 검색 페이지에서 결과 추출
 */
export async function extractBlogSearchResults(
    page: Page,
    pageNo: number,
    logger: Logger
): Promise<BlogSearchEvaluateResult> {
    // 디버깅을 위해 페이지 제목과 URL 확인
    const pageTitle = await page.title();
    const currentUrl = page.url();
    await logger.info(
        `네이버 블로그 검색 페이지 ${pageNo}: ${pageTitle} (${currentUrl})`
    );

    // 검색 결과가 렌더링될 때까지 대기
    await logger.info(`페이지 ${pageNo} 검색 결과 렌더링 대기 중...`);
    await page.waitForTimeout(PAGE_NAVIGATION_DELAY);

    // 함수를 문자열로 변환하여 브라우저 컨텍스트에 전달
    const parseFunctionsCode = getBlogSearchEvaluateFunctionCode();

    const evaluateResult = await page.evaluate(
        (args: {
            selectors: {
                container: string[];
                title: string[];
                description: string[];
                author: string[];
            };
            functionsCode: string;
        }): BlogSearchEvaluateResult => {
            // 함수 코드를 실행하여 함수들을 정의
            eval(args.functionsCode);

            // 디버깅 정보 수집
            const debugInfo = {
                containerSelectors: [] as {
                    selector: string;
                    found: boolean;
                    count: number;
                }[],
                pageTitle: document.title,
                url: window.location.href,
                bodyContent: document.body?.innerText?.substring(0, 500) || "",
                sampleHTML: document.body?.innerHTML?.substring(0, 1000) || "",
            };

            // 다양한 가능한 셀렉터 시도
            const possibleSelectors = args.selectors.container;

            let blogItems: NodeListOf<Element> | null = null;

            // 다양한 셀렉터 시도 및 디버깅 정보 수집
            for (const selector of possibleSelectors) {
                const items = document.querySelectorAll(selector);
                const found = items.length > 0;

                debugInfo.containerSelectors.push({
                    selector,
                    found,
                    count: items.length,
                });

                if (found && !blogItems) {
                    blogItems = items;
                    break;
                }
            }

            // 셀렉터로 블로그 아이템을 찾지 못한 경우
            if (!blogItems) {
                return {
                    results: [],
                    debugInfo,
                };
            }

            // 정상 방법: 구조화된 블로그 아이템 파싱
            const results = parseStructuredBlogItems(blogItems, {
                title: args.selectors.title,
                description: args.selectors.description,
                author: args.selectors.author,
            });

            return {
                results,
                debugInfo,
            };
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

    return evaluateResult;
}

/**
 * 검색 결과 로깅 및 에러 처리
 */
export async function logSearchResults(
    results: BlogSearchResult[],
    debugInfo: BlogSearchDebugInfo,
    pageNo: number,
    logger: Logger
): Promise<void> {
    // 결과 로깅
    if (results.length > 0) {
        await logger.info(
            `✅ [페이지 ${pageNo}] 정상 방법: ${results.length}개 블로그 아이템 파싱 완료`
        );
    } else {
        // 결과가 없을 때 상세한 디버깅 정보 추가
        const foundSelectors = debugInfo.containerSelectors.filter(
            (s) => s.found
        );

        const reasons: string[] = [];

        if (foundSelectors.length === 0) {
            reasons.push(
                `❌ 컨테이너 셀렉터 실패: 시도한 모든 셀렉터(${blogItemContainerSelectors.length}개)에서 요소를 찾지 못했습니다.`
            );
            reasons.push(
                `시도한 셀렉터: ${blogItemContainerSelectors.join(", ")}`
            );
        } else {
            reasons.push(
                `⚠️ 컨테이너는 찾았지만 결과 파싱 실패: ${foundSelectors.length}개 셀렉터에서 요소를 찾았지만 블로그 아이템을 파싱하지 못했습니다.`
            );
            reasons.push(
                `성공한 셀렉터: ${foundSelectors
                    .map((s) => `${s.selector} (${s.count}개)`)
                    .join(", ")}`
            );
        }

        // 페이지 정보 추가
        reasons.push(`페이지 제목: ${debugInfo.pageTitle}`);
        reasons.push(`페이지 URL: ${debugInfo.url}`);

        // 페이지 내용 샘플 (보안을 위해 제한)
        if (debugInfo.bodyContent) {
            reasons.push(
                `페이지 내용 샘플: ${debugInfo.bodyContent.substring(
                    0,
                    200
                )}...`
            );
        }

        const failureReason = reasons.join("\n");

        await logger.error(
            `⚠️ 페이지 ${pageNo}에서 결과를 찾을 수 없습니다.\n${failureReason}`
        );
    }
}
