import { BrowserContext } from "playwright";
import { Logger } from "@/service/logger";
import type { BlogSearchResult } from "./blogSearchServiceType";
import {
    buildBlogSearchUrl,
    navigateToBlogSearchPage,
    extractBlogSearchResults,
    logSearchResults,
} from "../flow";

export interface BlogSearchOptions {
    keyword: string;
    pageNumbers: number[];
    isAborted?: () => boolean;
}

export interface BlogSearchResultData {
    success: boolean;
    results: BlogSearchResult[];
    keyword: string;
    totalCount: number;
}

/**
 * 블로그 검색 서비스
 */
export class BlogSearchService {
    private context: BrowserContext;
    private logger: Logger;

    constructor(context: BrowserContext, logger: Logger) {
        this.context = context;
        this.logger = logger;
    }

    /**
     * 블로그 검색 수행
     */
    async execute(options: BlogSearchOptions): Promise<BlogSearchResult[]> {
        const { keyword, pageNumbers, isAborted = () => false } = options;

        await this.logger.info(
            `네이버 블로그 검색 시작: "${keyword}" - ${pageNumbers.length}개 페이지 병렬 처리`
        );

        const allResults: BlogSearchResult[] = [];

        const searchPromises = pageNumbers.map(async (pageNo: number) => {
            if (isAborted()) {
                return [];
            }
            return this.searchPage(keyword, pageNo, isAborted);
        });

        const resultsFromPages = await Promise.all(searchPromises);
        allResults.push(...resultsFromPages.flat());

        return allResults;
    }

    /**
     * 단일 페이지 검색 수행
     */
    private async searchPage(
        keyword: string,
        pageNo: number,
        isAborted: () => boolean
    ): Promise<BlogSearchResult[]> {
        await this.logger.info(`페이지 ${pageNo} 검색 시작`);

        if (isAborted()) {
            await this.logger.info(
                `검색이 중지되어 페이지 ${pageNo} 처리를 건너뜁니다.`
            );
            return [];
        }

        const page = await this.context.newPage();

        try {
            // URL 생성
            const naverUrl = buildBlogSearchUrl(keyword, pageNo);

            if (isAborted()) {
                await page.close();
                await this.logger.info(
                    `검색이 중지되어 페이지 ${pageNo} 처리를 중단합니다.`
                );
                return [];
            }

            // 블로그 페이지로 이동
            await navigateToBlogSearchPage(page, naverUrl, pageNo, this.logger);

            if (isAborted()) {
                await page.close();
                await this.logger.info(
                    `검색이 중지되어 페이지 ${pageNo} 처리를 중단합니다.`
                );
                return [];
            }

            // 검색 결과 추출
            const evaluateResult = await extractBlogSearchResults(
                page,
                pageNo,
                this.logger
            );

            const results = evaluateResult.results;
            const debugInfo = evaluateResult.debugInfo;

            // 결과 로깅
            await logSearchResults(results, debugInfo, pageNo, this.logger);

            if (results.length > 0) {
                await this.logger.success(
                    `페이지 ${pageNo}에서 ${results.length}개 결과 수집`
                );
            }

            return results;
        } catch (error) {
            await this.logger.error(
                `네이버 검색 페이지 ${pageNo} 오류: ${
                    error instanceof Error ? error.message : String(error)
                }`
            );
            return [];
        } finally {
            await page.close();
        }
    }
}

/**
 * 블로그 검색 서비스 인스턴스 생성
 */
export function createBlogSearchService(
    context: BrowserContext,
    logger: Logger
): BlogSearchService {
    return new BlogSearchService(context, logger);
}
