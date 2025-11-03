import { NextRequest } from "next/server";
import { chromium } from "playwright";

interface BlogSearchResult {
    title: string;
    url: string;
    description: string;
    author: string;
    date: string;
    platform: string;
}

export async function POST(request: NextRequest) {
    try {
        const { keyword, pageNumbers = [1, 2, 3, 4, 5] } = await request.json();

        if (!keyword) {
            return new Response(
                JSON.stringify({ error: "키워드가 필요합니다." }),
                {
                    status: 400,
                    headers: { "Content-Type": "application/json" },
                }
            );
        }

        const browser = await chromium.launch({
            headless: true,
        });

        const context = await browser.newContext({
            userAgent:
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        });

        const page = await context.newPage();

        try {
            const allResults: BlogSearchResult[] = [];

            // 네이버 블로그 검색

            // 네이버 블로그 검색 - 병렬 처리
            console.log(
                `네이버 블로그 검색 시작: ${pageNumbers.length}개 페이지 병렬 처리`
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
                    console.log(`네이버 블로그 검색 페이지 ${pageNo}:`, {
                        pageTitle,
                        currentUrl,
                    });

                    const naverResults = await page.evaluate(
                        (): BlogSearchResult[] => {
                            // 디버깅을 위해 페이지 구조 확인
                            console.log(
                                "페이지 HTML 길이:",
                                document.documentElement.outerHTML.length
                            );
                            console.log("페이지 제목:", document.title);

                            // 다양한 가능한 셀렉터 시도
                            const possibleSelectors = [
                                ".list_search_blog",
                                ".area_list_search .list_search_blog",
                                ".search_list li",
                                ".blog_item",
                                ".post_item",
                                "li[ng-repeat]",
                                ".item",
                            ];

                            let blogItems: NodeListOf<Element> | null = null;
                            let usedSelector = "";

                            for (const selector of possibleSelectors) {
                                const items =
                                    document.querySelectorAll(selector);
                                if (items.length > 0) {
                                    blogItems = items;
                                    usedSelector = selector;
                                    console.log(
                                        `셀렉터 "${selector}"로 ${items.length}개 아이템 발견`
                                    );
                                    break;
                                }
                            }

                            if (!blogItems) {
                                console.log(
                                    "블로그 아이템을 찾을 수 없습니다. 페이지 구조를 확인합니다."
                                );
                                // 페이지의 모든 클래스 출력
                                const allClasses = Array.from(
                                    document.querySelectorAll("*")
                                )
                                    .map((el) => el.className)
                                    .filter((c) => c && typeof c === "string")
                                    .slice(0, 20);
                                console.log("페이지의 클래스들:", allClasses);
                                return [];
                            }

                            const searchResults: BlogSearchResult[] = [];
                            console.log(
                                `"${usedSelector}" 셀렉터로 ${blogItems.length}개 아이템 처리 시작`
                            );

                            blogItems.forEach((item, index) => {
                                if (index >= 10) return; // 페이지당 최대 10개

                                // 다양한 가능한 셀렉터 시도
                                const titleSelectors = [
                                    ".name_blog .text_blog",
                                    ".text_blog",
                                    ".name_blog",
                                    ".title",
                                    ".blog_title",
                                    "a[href*='blog.naver.com']",
                                ];

                                const descSelectors = [
                                    ".blog_intro",
                                    ".desc",
                                    ".description",
                                    ".content",
                                ];

                                const authorSelectors = [
                                    ".name_author",
                                    ".author",
                                    ".writer",
                                    ".blogger",
                                ];

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

                                    console.log(`블로그 ${index + 1}:`, {
                                        title: title.substring(0, 50) + "...",
                                        url,
                                        author,
                                        hasDescription: !!description,
                                    });

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
                                } else {
                                    console.log(
                                        `아이템 ${
                                            index + 1
                                        }에서 제목 또는 URL을 찾을 수 없음`
                                    );
                                }
                            });

                            console.log(
                                `총 ${searchResults.length}개 결과 추출 완료`
                            );
                            return searchResults;
                        }
                    );

                    console.log({ naverResults });

                    await page.close();
                    console.log(
                        `페이지 ${pageNo}에서 ${naverResults.length}개 결과 수집`
                    );

                    return naverResults;
                } catch (error) {
                    console.error(`네이버 검색 페이지 ${pageNo} 오류:`, error);
                    return [];
                }
            });

            // 모든 페이지 검색 완료 대기
            const allNaverResults = await Promise.all(searchPromises);
            allResults.push(...allNaverResults.flat());

            // 티스토리 검색
            try {
                const tistoryUrl = `https://search.naver.com/search.naver?where=blog&query=${encodeURIComponent(
                    keyword
                )}%20site:tistory.com`;
                await page.goto(tistoryUrl, { waitUntil: "networkidle" });

                const tistoryResults = await page.evaluate(
                    (): BlogSearchResult[] => {
                        const blogItems =
                            document.querySelectorAll(".blog_item");
                        const searchResults: BlogSearchResult[] = [];

                        blogItems.forEach((item, index) => {
                            if (index >= 5) return; // 최대 5개만

                            const titleElement =
                                item.querySelector(".title_link");
                            const descriptionElement =
                                item.querySelector(".dsc_txt");
                            const authorElement =
                                item.querySelector(".info .name");
                            const dateElement =
                                item.querySelector(".info .date");

                            if (titleElement) {
                                const title =
                                    titleElement.textContent?.trim() || "";
                                const url =
                                    titleElement.getAttribute("href") || "";
                                const description =
                                    descriptionElement?.textContent?.trim() ||
                                    "";
                                const author =
                                    authorElement?.textContent?.trim() || "";
                                const date =
                                    dateElement?.textContent?.trim() || "";

                                searchResults.push({
                                    title,
                                    url,
                                    description,
                                    author,
                                    date,
                                    platform: "티스토리",
                                });
                            }
                        });

                        return searchResults;
                    }
                );

                allResults.push(...tistoryResults);
            } catch (error) {
                console.error("티스토리 검색 오류:", error);
            }

            await browser.close();

            return new Response(
                JSON.stringify({
                    success: true,
                    results: allResults,
                    keyword,
                    totalCount: allResults.length,
                }),
                {
                    headers: { "Content-Type": "application/json" },
                }
            );
        } catch (error) {
            await browser.close();
            throw error;
        }
    } catch (error) {
        console.error("Blog search error:", error);
        return new Response(
            JSON.stringify({
                error: "블로그 검색 중 오류가 발생했습니다.",
                details:
                    error instanceof Error ? error.message : "Unknown error",
            }),
            {
                status: 500,
                headers: { "Content-Type": "application/json" },
            }
        );
    }
}
