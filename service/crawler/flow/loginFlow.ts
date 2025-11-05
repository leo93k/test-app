import { Page } from "playwright";
import { Logger } from "@/service/logger";
import {
    loginButtonSelectors,
    idSelectors,
    pwSelectors,
    loginSubmitSelectors,
} from "@/const/selectors";
import {
    SELECTOR_WAIT_TIMEOUT,
    DEFAULT_TIMEOUT,
    PAGE_NAVIGATION_DELAY,
} from "@/const";
import { createCrawlService } from "../utils/crawlService";

/**
 * iframe 또는 메인 페이지에서 로그인 버튼 찾기 및 클릭
 */
export async function clickLoginButton(
    page: Page,
    logger: Logger
): Promise<boolean> {
    await logger.info("🔍 로그인 버튼 검색 중...");
    const crawlService = createCrawlService(logger);
    let loginButtonClicked = false;

    try {
        // 먼저 iframe에서 찾기
        const frames = page.frames();
        await logger.info(`📋 발견된 iframe 개수: ${frames.length}`);

        for (let i = 0; i < frames.length; i++) {
            const frame = frames[i];
            await logger.info(`🔍 iframe ${i + 1}에서 검색 중...`);

            loginButtonClicked = await crawlService.findAndClick(
                frame,
                loginButtonSelectors,
                {
                    contextName: `iframe ${i + 1}의 로그인 버튼`,
                    useWaitForSelector: false,
                }
            );

            if (loginButtonClicked) break;
        }

        // iframe에서 못 찾으면 메인 페이지에서 찾기
        if (!loginButtonClicked) {
            loginButtonClicked = await crawlService.findAndClick(
                page,
                loginButtonSelectors,
                {
                    contextName: "로그인 버튼",
                    useWaitForSelector: false,
                }
            );
        }
    } catch (iframeError) {
        await logger.error(`❌ 로그인 버튼 검색 실패: ${iframeError}`);
    }

    return loginButtonClicked;
}

/**
 * 로그인 폼에 아이디/비밀번호 입력 및 제출
 */
export async function fillAndSubmitLoginForm(
    page: Page,
    logger: Logger,
    username: string,
    password: string
): Promise<void> {
    await logger.info("📝 로그인 폼에 정보 입력 중...");
    const crawlService = createCrawlService(logger);

    // 아이디 입력
    // headless 모드에서 요소가 로드될 때까지 대기
    await crawlService.waitWithLog(
        page,
        "⏳ 로그인 폼이 로드될 때까지 대기 중...",
        500
    );

    const idInputted = await crawlService.findAndFill(
        page,
        idSelectors,
        username,
        {
            contextName: "아이디 입력 필드",
            useWaitForSelector: true,
            waitTimeout: SELECTOR_WAIT_TIMEOUT,
        }
    );

    if (!idInputted) {
        const currentUrl = page.url();
        await logger.error(
            `❌ 아이디 입력 필드를 찾을 수 없습니다. 현재 페이지 URL: ${currentUrl}`
        );
        await logger.error(`❌ 시도한 셀렉터 목록: ${idSelectors.join(", ")}`);
        throw new Error(
            `아이디 입력 필드를 찾을 수 없습니다. 현재 페이지: ${currentUrl}, 시도한 셀렉터: ${idSelectors.join(
                ", "
            )}`
        );
    }

    // 비밀번호 입력
    // 아이디 입력 후 비밀번호 필드가 로드될 때까지 짧은 대기
    await page.waitForTimeout(200);

    const pwInputted = await crawlService.findAndFill(
        page,
        pwSelectors,
        password,
        {
            contextName: "비밀번호 입력 필드",
            useWaitForSelector: true,
            waitTimeout: SELECTOR_WAIT_TIMEOUT,
        }
    );

    if (!pwInputted) {
        const currentUrl = page.url();
        await logger.error(
            `❌ 비밀번호 입력 필드를 찾을 수 없습니다. 현재 페이지 URL: ${currentUrl}`
        );
        await logger.error(`❌ 시도한 셀렉터 목록: ${pwSelectors.join(", ")}`);
        throw new Error(
            `비밀번호 입력 필드를 찾을 수 없습니다. 현재 페이지: ${currentUrl}, 시도한 셀렉터: ${pwSelectors.join(
                ", "
            )}`
        );
    }

    // 로그인 버튼 클릭
    await logger.info("🔘 로그인 버튼 클릭 중...");

    // 비밀번호 입력 후 제출 버튼이 로드될 때까지 짧은 대기
    await page.waitForTimeout(200);

    const loginSubmitted = await crawlService.findAndClick(
        page,
        loginSubmitSelectors,
        {
            contextName: "로그인 제출 버튼",
            useWaitForSelector: true,
            waitTimeout: SELECTOR_WAIT_TIMEOUT,
        }
    );

    if (!loginSubmitted) {
        const currentUrl = page.url();
        await logger.error(
            `❌ 로그인 제출 버튼을 찾을 수 없습니다. 현재 페이지 URL: ${currentUrl}`
        );
        await logger.error(
            `❌ 시도한 셀렉터 목록: ${loginSubmitSelectors.join(", ")}`
        );
        throw new Error(
            `로그인 제출 버튼을 찾을 수 없습니다. 현재 페이지: ${currentUrl}, 시도한 셀렉터: ${loginSubmitSelectors.join(
                ", "
            )}`
        );
    }

    // 로그인 완료 대기
    await crawlService.waitWithLog(
        page,
        "⏳ 로그인 완료 대기 중...",
        PAGE_NAVIGATION_DELAY
    );
}

/**
 * 원래 블로그 페이지로 돌아가기
 */
export async function navigateBackToBlog(
    page: Page,
    logger: Logger,
    originalUrl: string
): Promise<void> {
    const currentUrl = page.url();
    await logger.info(`현재 URL: ${currentUrl}`);

    // 로그인 제출 후 다시 로그인 페이지로 돌아온 경우 오류 처리
    if (currentUrl.includes("nidlogin.login")) {
        await logger.error(
            "❌ 로그인 제출 후 다시 로그인 페이지로 돌아왔습니다."
        );

        // 페이지 내용 확인하여 오류 원인 파악
        try {
            const pageContent = await page.evaluate(() => {
                const bodyText = document.body?.textContent || "";
                const errorText =
                    document.querySelector(".error_message")?.textContent || "";
                const captchaText =
                    document.querySelector(".captcha")?.textContent || "";
                return bodyText + " " + errorText + " " + captchaText;
            });

            await logger.info(
                `📋 로그인 페이지 내용 확인: ${pageContent.substring(
                    0,
                    200
                )}...`
            );

            let errorReason = "";

            // 자동문자방지(CAPTCHA) 확인
            if (
                pageContent.includes("자동입력 방지") ||
                pageContent.includes("자동입력방지") ||
                pageContent.includes("captcha") ||
                pageContent.includes("CAPTCHA") ||
                pageContent.includes("보안 문자") ||
                pageContent.includes("보안문자") ||
                pageContent.includes("자동 등록 방지") ||
                pageContent.includes("이미지 인증")
            ) {
                errorReason = "자동문자방지(CAPTCHA)가 발생했습니다.";
                await logger.error(`❌ 로그인 실패 사유: ${errorReason}`);
            }
            // 비밀번호 오류 확인
            else if (
                pageContent.includes("비밀번호") ||
                pageContent.includes("틀렸습니다") ||
                pageContent.includes("일치하지 않습니다") ||
                pageContent.includes("잘못되었습니다") ||
                pageContent.includes("아이디 또는 비밀번호")
            ) {
                errorReason =
                    "비밀번호가 틀렸거나 아이디/비밀번호가 일치하지 않습니다.";
                await logger.error(`❌ 로그인 실패 사유: ${errorReason}`);
            }
            // 기타 오류
            else {
                errorReason = "로그인에 실패했습니다. (원인 불명)";
                await logger.error(`❌ 로그인 실패 사유: ${errorReason}`);
                await logger.error(
                    `페이지 내용: ${pageContent.substring(0, 500)}...`
                );
            }

            throw new Error(`로그인 실패: ${errorReason}`);
        } catch (error) {
            // 이미 에러를 throw한 경우 재throw
            if (
                error instanceof Error &&
                error.message.includes("로그인 실패")
            ) {
                throw error;
            }
            // 페이지 내용 확인 실패 시에도 로그인 실패로 처리
            await logger.error("❌ 로그인 실패: 페이지 내용 확인 중 오류 발생");
            throw new Error("로그인 실패: 로그인 페이지로 다시 돌아왔습니다.");
        }
    }

    if (!currentUrl.includes("blog.naver.com")) {
        await logger.info("🔄 원래 블로그 페이지로 돌아가는 중...");

        const blogIdMatch = originalUrl.match(/blog\.naver\.com\/([^\/]+)/);

        if (blogIdMatch) {
            const blogId = blogIdMatch[1];
            const blogUrl = `https://blog.naver.com/${blogId}`;

            const crawlService = createCrawlService(logger);
            await crawlService.navigate(page, blogUrl, {
                contextName: "원래 블로그 페이지",
                timeout: DEFAULT_TIMEOUT,
                retry: false,
            });

            await page.waitForTimeout(PAGE_NAVIGATION_DELAY);
        } else {
            await logger.error(
                "⚠️ 블로그 ID를 추출할 수 없습니다. 현재 페이지에서 계속 진행합니다."
            );
        }
    } else {
        await logger.info("✅ 이미 블로그 페이지에 있습니다.");
    }
}
