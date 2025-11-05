import type { BlogSearchResult } from "./types";

/**
 * 정상 방법: 구조화된 블로그 아이템을 파싱하여 결과 생성
 * 셀렉터로 블로그 아이템을 찾았을 때 사용
 */
export function parseStructuredBlogItems(
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
