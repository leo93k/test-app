import { Page } from "playwright";
import { Logger } from "@/service/logger";
import {
    loginButtonSelectors,
    idSelectors,
    pwSelectors,
    loginSubmitSelectors,
} from "@/const/selectors";

const PAGE_NAVIGATION_DELAY = 300;
const LOGIN_COMPLETE_DELAY = 1000;

/**
 * iframe 또는 메인 페이지에서 로그인 버튼 찾기 및 클릭
 */
export async function clickLoginButton(
    page: Page,
    logger: Logger
): Promise<boolean> {
    await logger.info("🔍 로그인 버튼 검색 중...");
    let loginButtonClicked = false;

    try {
        // 먼저 iframe에서 찾기
        const frames = page.frames();
        await logger.info(`📋 발견된 iframe 개수: ${frames.length}`);

        for (let i = 0; i < frames.length; i++) {
            const frame = frames[i];
            await logger.info(`🔍 iframe ${i + 1}에서 검색 중...`);

            for (const selector of loginButtonSelectors) {
                try {
                    const loginButton = await frame.$(selector);
                    if (loginButton) {
                        await logger.info(
                            `🔘 iframe ${
                                i + 1
                            }에서 로그인 버튼 발견: ${selector}`
                        );
                        await loginButton.click();
                        await logger.success(
                            `✅ iframe 내 로그인 버튼 클릭 완료 (선택자: ${selector})`
                        );
                        loginButtonClicked = true;
                        break;
                    }
                } catch {
                    continue;
                }
            }

            if (loginButtonClicked) break;
        }

        // iframe에서 못 찾으면 메인 페이지에서 찾기
        if (!loginButtonClicked) {
            for (const selector of loginButtonSelectors) {
                try {
                    const loginButton = await page.$(selector);
                    if (loginButton) {
                        await logger.info(
                            `🔘 메인 페이지에서 로그인 버튼 발견: ${selector}`
                        );
                        await loginButton.click();
                        await logger.success(
                            `✅ 로그인 버튼 클릭 완료 (선택자: ${selector})`
                        );
                        loginButtonClicked = true;
                        break;
                    }
                } catch {
                    continue;
                }
            }
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

    // 아이디 입력
    let idInputted = false;
    const triedSelectors: string[] = [];

    // headless 모드에서 요소가 로드될 때까지 대기
    await logger.info("⏳ 로그인 폼이 로드될 때까지 대기 중...");
    await page.waitForTimeout(500);

    for (const selector of idSelectors) {
        try {
            triedSelectors.push(selector);
            await logger.info(`🔍 아이디 입력 필드 찾기 시도: ${selector}`);

            // waitForSelector로 요소가 나타날 때까지 대기 (headless 모드 대응)
            try {
                await page.waitForSelector(selector, { timeout: 5000 });
                await logger.info(`✅ 셀렉터 "${selector}"로 요소 발견됨`);
            } catch {
                await logger.info(
                    `⏳ 셀렉터 "${selector}" 대기 시간 초과, 직접 찾기 시도`
                );
            }

            const idInput = await page.$(selector);
            if (idInput) {
                await idInput.fill(username);
                await logger.success(
                    `✅ 아이디 입력 완료 (셀렉터: ${selector})`
                );
                idInputted = true;
                break;
            } else {
                await logger.info(
                    `❌ 셀렉터 "${selector}"로 요소를 찾을 수 없음`
                );
            }
        } catch (error) {
            await logger.info(
                `❌ 셀렉터 "${selector}" 시도 중 오류: ${
                    error instanceof Error ? error.message : String(error)
                }`
            );
            continue;
        }
    }

    if (!idInputted) {
        const currentUrl = page.url();
        await logger.error(
            `❌ 아이디 입력 필드를 찾을 수 없습니다. 현재 페이지 URL: ${currentUrl}`
        );
        await logger.error(
            `❌ 시도한 셀렉터 목록: ${triedSelectors.join(", ")}`
        );
        throw new Error(
            `아이디 입력 필드를 찾을 수 없습니다. 현재 페이지: ${currentUrl}, 시도한 셀렉터: ${triedSelectors.join(
                ", "
            )}`
        );
    }

    // 비밀번호 입력
    let pwInputted = false;
    const triedPwSelectors: string[] = [];

    // 아이디 입력 후 비밀번호 필드가 로드될 때까지 짧은 대기
    await page.waitForTimeout(200);

    for (const selector of pwSelectors) {
        try {
            triedPwSelectors.push(selector);
            await logger.info(`🔍 비밀번호 입력 필드 찾기 시도: ${selector}`);

            // waitForSelector로 요소가 나타날 때까지 대기 (headless 모드 대응)
            try {
                await page.waitForSelector(selector, { timeout: 5000 });
                await logger.info(`✅ 셀렉터 "${selector}"로 요소 발견됨`);
            } catch {
                await logger.info(
                    `⏳ 셀렉터 "${selector}" 대기 시간 초과, 직접 찾기 시도`
                );
            }

            const pwInput = await page.$(selector);
            if (pwInput) {
                await pwInput.fill(password);
                await logger.success(
                    `✅ 비밀번호 입력 완료 (셀렉터: ${selector})`
                );
                pwInputted = true;
                break;
            } else {
                await logger.info(
                    `❌ 셀렉터 "${selector}"로 요소를 찾을 수 없음`
                );
            }
        } catch (error) {
            await logger.info(
                `❌ 셀렉터 "${selector}" 시도 중 오류: ${
                    error instanceof Error ? error.message : String(error)
                }`
            );
            continue;
        }
    }

    if (!pwInputted) {
        const currentUrl = page.url();
        await logger.error(
            `❌ 비밀번호 입력 필드를 찾을 수 없습니다. 현재 페이지 URL: ${currentUrl}`
        );
        await logger.error(
            `❌ 시도한 셀렉터 목록: ${triedPwSelectors.join(", ")}`
        );
        throw new Error(
            `비밀번호 입력 필드를 찾을 수 없습니다. 현재 페이지: ${currentUrl}, 시도한 셀렉터: ${triedPwSelectors.join(
                ", "
            )}`
        );
    }

    // 로그인 버튼 클릭
    await logger.info("🔘 로그인 버튼 클릭 중...");

    let loginSubmitted = false;
    const triedSubmitSelectors: string[] = [];

    // 비밀번호 입력 후 제출 버튼이 로드될 때까지 짧은 대기
    await page.waitForTimeout(200);

    for (const selector of loginSubmitSelectors) {
        try {
            triedSubmitSelectors.push(selector);
            await logger.info(`🔍 로그인 제출 버튼 찾기 시도: ${selector}`);

            // waitForSelector로 요소가 나타날 때까지 대기 (headless 모드 대응)
            try {
                await page.waitForSelector(selector, { timeout: 5000 });
                await logger.info(`✅ 셀렉터 "${selector}"로 요소 발견됨`);
            } catch {
                await logger.info(
                    `⏳ 셀렉터 "${selector}" 대기 시간 초과, 직접 찾기 시도`
                );
            }

            const submitButton = await page.$(selector);
            if (submitButton) {
                await submitButton.click();
                await logger.success(
                    `✅ 로그인 제출 완료 (셀렉터: ${selector})`
                );
                loginSubmitted = true;
                break;
            } else {
                await logger.info(
                    `❌ 셀렉터 "${selector}"로 요소를 찾을 수 없음`
                );
            }
        } catch (error) {
            await logger.info(
                `❌ 셀렉터 "${selector}" 시도 중 오류: ${
                    error instanceof Error ? error.message : String(error)
                }`
            );
            continue;
        }
    }

    if (!loginSubmitted) {
        const currentUrl = page.url();
        await logger.error(
            `❌ 로그인 제출 버튼을 찾을 수 없습니다. 현재 페이지 URL: ${currentUrl}`
        );
        await logger.error(
            `❌ 시도한 셀렉터 목록: ${triedSubmitSelectors.join(", ")}`
        );
        throw new Error(
            `로그인 제출 버튼을 찾을 수 없습니다. 현재 페이지: ${currentUrl}, 시도한 셀렉터: ${triedSubmitSelectors.join(
                ", "
            )}`
        );
    }

    // 로그인 완료 대기
    await logger.info("⏳ 로그인 완료 대기 중...");
    await page.waitForTimeout(LOGIN_COMPLETE_DELAY);
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

    if (
        !currentUrl.includes("blog.naver.com") ||
        currentUrl.includes("nidlogin.login")
    ) {
        await logger.info("🔄 원래 블로그 페이지로 돌아가는 중...");

        const blogIdMatch = originalUrl.match(/blog\.naver\.com\/([^\/]+)/);

        if (blogIdMatch) {
            const blogId = blogIdMatch[1];
            const blogUrl = `https://blog.naver.com/${blogId}`;

            await logger.info(`📝 블로그 URL로 이동: ${blogUrl}`);
            await page.goto(blogUrl, {
                waitUntil: "domcontentloaded",
                timeout: 30000,
            });
            await logger.success("✅ 원래 블로그 페이지로 이동 완료");

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
