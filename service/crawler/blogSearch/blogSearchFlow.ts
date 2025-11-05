import { Page, BrowserContext } from "playwright";
import { Logger } from "@/service/logger";
import type { BlogSearchResult } from "./types";
import {
    buildBlogSearchUrl,
    navigateToBlogSearchPage,
    extractBlogSearchResults,
    logSearchResults,
} from "./blogSearchService";

/**
 * 단일 페이지 검색 수행
 */
export async function searchBlogPage(
    context: BrowserContext,
    keyword: string,
    pageNo: number,
    logger: Logger,
    isAborted: () => boolean
): Promise<BlogSearchResult[]> {
    await logger.info(`페이지 ${pageNo} 검색 시작`);

    // 중지되었는지 확인
    if (isAborted()) {
        await logger.info(
            `검색이 중지되어 페이지 ${pageNo} 처리를 건너뜁니다.`
        );
        return [];
    }

    const page = await context.newPage();

    try {
        // URL 생성
        const naverUrl = buildBlogSearchUrl(keyword, pageNo);

        // 중지되었는지 확인
        if (isAborted()) {
            await page.close();
            await logger.info(
                `검색이 중지되어 페이지 ${pageNo} 처리를 중단합니다.`
            );
            return [];
        }

        // 블로그 페이지로 이동
        await navigateToBlogSearchPage(page, naverUrl, pageNo, logger);

        // 중지되었는지 다시 확인
        if (isAborted()) {
            await page.close();
            await logger.info(
                `검색이 중지되어 페이지 ${pageNo} 처리를 중단합니다.`
            );
            return [];
        }

        // 검색 결과 추출
        const evaluateResult = await extractBlogSearchResults(
            page,
            pageNo,
            logger
        );

        const results = evaluateResult.results;
        const debugInfo = evaluateResult.debugInfo;

        // 결과 로깅
        await logSearchResults(results, debugInfo, pageNo, logger);

        if (results.length > 0) {
            await logger.success(
                `페이지 ${pageNo}에서 ${results.length}개 결과 수집`
            );
        }

        return results;
    } catch (error) {
        await logger.error(
            `네이버 검색 페이지 ${pageNo} 오류: ${
                error instanceof Error ? error.message : String(error)
            }`
        );
        return [];
    } finally {
        await page.close();
    }
}

/**
 * 여러 페이지 병렬 검색 수행
 */
export async function searchBlogPages(
    context: BrowserContext,
    keyword: string,
    pageNumbers: number[],
    logger: Logger,
    isAborted: () => boolean
): Promise<BlogSearchResult[]> {
    await logger.info(
        `네이버 블로그 검색 시작: "${keyword}" - ${pageNumbers.length}개 페이지 병렬 처리`
    );

    const searchPromises = pageNumbers.map((pageNo) =>
        searchBlogPage(context, keyword, pageNo, logger, isAborted)
    );

    // 모든 페이지 검색 완료 대기
    const allResults = await Promise.all(searchPromises);

    return allResults.flat();
}
