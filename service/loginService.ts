/* eslint-disable @typescript-eslint/no-explicit-any */
import { Page } from "playwright";
import { ACTION_DELAY, PAGE_NAVIGATION_DELAY, DEFAULT_TIMEOUT } from "@/const";
import {
    idSelectors,
    passwordSelectors,
    loginSubmitSelectors,
    loginButtonSelectors,
    loginErrorSelectors,
} from "@/const/selectors";
import { Logger } from "./logger";

export interface LoginCredentials {
    username: string;
    password: string;
}

export interface LoginResult {
    success: boolean;
    message: string;
    currentUrl?: string;
}

export class AutoLoginService {
    private page: Page;
    private logger: Logger;

    constructor(page: Page, logger: Logger) {
        this.page = page;
        this.logger = logger;
    }

    async attemptLogin(credentials: LoginCredentials): Promise<LoginResult> {
        const { username, password } = credentials;

        if (!username || !password) {
            return {
                success: false,
                message: "Username and password are required",
            };
        }

        try {
            // 로그인 필드 찾기 (병렬 처리)
            const [usernameField, passwordField] = await Promise.all([
                this.findUsernameField(),
                this.findPasswordField(),
            ]);

            if (!usernameField || !passwordField) {
                return {
                    success: false,
                    message: "Login fields not found. Please login manually.",
                };
            }

            // 로그인 정보 입력
            await this.fillLoginFields(
                usernameField,
                passwordField,
                username,
                password
            );

            // 로그인 버튼 클릭
            const loginResult = await this.clickLoginButton(passwordField);

            return loginResult;
        } catch (error) {
            await this.logger.error(`Login error: ${error}`);
            return {
                success: false,
                message: `Login failed: ${
                    error instanceof Error ? error.message : "Unknown error"
                }`,
            };
        }
    }

    private async findUsernameField() {
        for (const selector of idSelectors) {
            try {
                await this.logger.info(`Finding username field: ${selector}`);
                const field = await this.page.$(selector);
                if (field) {
                    await this.logger.success(
                        `Found username field: ${selector}`
                    );
                    return field;
                }
            } catch {
                continue;
            }
        }

        return null;
    }

    private async findPasswordField() {
        for (const selector of passwordSelectors) {
            try {
                const field = await this.page.$(selector);
                if (field) {
                    await this.logger.success(
                        `Found password field: ${selector}`
                    );
                    return field;
                }
            } catch {
                continue;
            }
        }

        return null;
    }

    private async fillLoginFields(
        usernameField: any,
        passwordField: any,
        username: string,
        password: string
    ) {
        // 필드 클릭 후 값 입력 (네이버의 경우 필요할 수 있음)
        // click()은 자동으로 요소가 클릭 가능할 때까지 대기
        await usernameField.click();
        await usernameField.fill(username);

        await passwordField.click();
        await passwordField.fill(password);

        await this.logger.success(`Login credentials filled`);
    }

    private async clickLoginButton(passwordField: any): Promise<LoginResult> {
        let loginButton = null;
        // loginSubmitSelectors를 우선적으로 사용하고, 없으면 loginButtonSelectors 사용
        const selectorsToTry = [
            ...loginSubmitSelectors,
            ...loginButtonSelectors,
        ];

        // 로그인 버튼 클릭 전 URL 및 페이지 상태 확인
        const urlBeforeClick = this.page.url();
        const titleBeforeClick = await this.page.title();
        await this.logger.info(`📋 로그인 버튼 클릭 전 상태:`);
        await this.logger.info(`  - URL: ${urlBeforeClick}`);
        await this.logger.info(`  - 페이지 제목: ${titleBeforeClick}`);

        for (const selector of selectorsToTry) {
            try {
                await this.logger.info(`🔍 로그인 버튼 찾기 시도: ${selector}`);
                loginButton = await this.page.$(selector);
                if (loginButton) {
                    await this.logger.success(
                        `✅ 로그인 버튼 발견: ${selector}`
                    );
                    break;
                } else {
                    await this.logger.info(
                        `❌ 셀렉터 "${selector}"로 버튼을 찾을 수 없음`
                    );
                }
            } catch (e) {
                await this.logger.error(
                    `❌ 셀렉터 "${selector}" 시도 중 오류: ${e}`
                );
                continue;
            }
        }

        if (loginButton) {
            await this.logger.info(`🖱️ 로그인 버튼 클릭 시작...`);
            await loginButton.click();
            await this.logger.success(`✅ 로그인 버튼 클릭 완료`);

            // 클릭 직후 네비게이션 시작 대기
            await this.page
                .waitForLoadState("domcontentloaded", { timeout: ACTION_DELAY })
                .catch(() => {});
            const urlAfterClick = this.page.url();
            await this.logger.info(
                `📋 로그인 버튼 클릭 직후 URL: ${urlAfterClick}`
            );

            // 로그인 후 페이지 로드 대기 (단계별로 URL 확인)
            let elapsedTime = 0;

            await this.logger.info(`⏳ 로그인 완료 및 리다이렉트 대기 중...`);

            // URL 변경 감지를 위한 초기 URL 저장
            let previousUrl = urlAfterClick;

            while (elapsedTime < DEFAULT_TIMEOUT) {
                // URL이 변경되거나 네트워크가 안정화될 때까지 대기
                await Promise.race([
                    this.page
                        .waitForURL("**", { timeout: ACTION_DELAY })
                        .catch(() => {}),
                    this.page
                        .waitForLoadState("networkidle", {
                            timeout: ACTION_DELAY,
                        })
                        .catch(() => {}),
                    new Promise((resolve) => setTimeout(resolve, ACTION_DELAY)),
                ]);

                elapsedTime += ACTION_DELAY;

                // 네비게이션 중일 수 있으므로 try-catch로 처리
                let currentUrl: string;
                let currentTitle: string = "";

                try {
                    currentUrl = this.page.url();
                } catch {
                    // 네비게이션 중이면 잠시 대기 후 재시도
                    await new Promise((resolve) => setTimeout(resolve, 100));
                    try {
                        currentUrl = this.page.url();
                    } catch {
                        currentUrl = "네비게이션 중...";
                    }
                }

                try {
                    currentTitle = await this.page.title();
                } catch {
                    // 네비게이션 중이면 제목을 가져올 수 없음
                    currentTitle = "로딩 중...";
                }

                await this.logger.info(`📋 대기 중 (${elapsedTime}ms):`);
                await this.logger.info(`  - URL: ${currentUrl}`);
                await this.logger.info(`  - 페이지 제목: ${currentTitle}`);

                // URL이 변경되었는지 확인
                if (currentUrl !== previousUrl) {
                    await this.logger.info(
                        `🔄 URL 변경 감지: ${previousUrl} → ${currentUrl}`
                    );
                    previousUrl = currentUrl;
                }

                // 로그인 오류 메시지 확인 (비밀번호 오류만 감지, Caps Lock 등 경고는 무시)
                try {
                    const errorMessage = await this.page.evaluate(
                        (selectors: string[]) => {
                            // 우선순위 1: 페이지 전체 텍스트에서 비밀번호 오류 메시지 확인
                            const bodyText = document.body?.textContent || "";

                            // 자동입력 방지 문자 오류 메시지 확인
                            if (
                                bodyText.includes("아이디") &&
                                (bodyText.includes("자동입력 방지 문자") ||
                                    bodyText.includes("자동입력 방지") ||
                                    bodyText.includes(
                                        "입력하신 내용을 다시 확인"
                                    ))
                            ) {
                                return "자동입력 방지 문자로 인해 로그인에 실패했습니다.";
                            }

                            // 비밀번호 오류 메시지 확인
                            if (
                                bodyText.includes("아이디") &&
                                (bodyText.includes("비밀번호가 잘못") ||
                                    bodyText.includes("비밀번호를 정확히"))
                            ) {
                                // 정확한 에러 메시지 패턴 찾기
                                const errorPatterns = [
                                    /아이디.*또는.*비밀번호가.*잘못.*되었습니다/,
                                    /아이디.*비밀번호.*잘못/,
                                    /비밀번호가.*잘못/,
                                ];

                                for (const pattern of errorPatterns) {
                                    const match = bodyText.match(pattern);
                                    if (match && match[0]) {
                                        return match[0].trim();
                                    }
                                }

                                return "아이디 또는 비밀번호가 잘못 되었습니다.";
                            }

                            // 우선순위 2: 에러 메시지 셀렉터로 찾기 (Caps Lock 등 경고 제외)
                            for (const selector of selectors) {
                                const element =
                                    document.querySelector(selector);
                                if (element && element.textContent) {
                                    const text = element.textContent.trim();

                                    // Caps Lock이나 일반 경고 메시지는 무시
                                    if (
                                        text.includes("Caps Lock") ||
                                        text.includes("대소문자") ||
                                        text.includes("켜져 있습니다")
                                    ) {
                                        continue;
                                    }

                                    // 비밀번호 오류 메시지만 반환
                                    if (
                                        (text.includes("아이디") ||
                                            text.includes("비밀번호")) &&
                                        text.includes("잘못")
                                    ) {
                                        return text;
                                    }
                                }
                            }

                            return null;
                        },
                        loginErrorSelectors
                    );

                    if (errorMessage) {
                        // 에러는 상위 레벨에서 로깅하므로 여기서는 로그 출력하지 않음
                        return {
                            success: false,
                            message: `Login failed: ${errorMessage}`,
                            currentUrl: currentUrl,
                        };
                    }
                } catch (error) {
                    // 에러 메시지 확인 중 오류는 무시하고 계속 진행
                    await this.logger.info(
                        `  - 에러 메시지 확인 중 오류: ${error}`
                    );
                }

                // URL 변경 감지는 이미 위에서 처리됨

                // 로그인 페이지에서 벗어났는지 확인
                if (
                    !currentUrl.includes("nidlogin") &&
                    !currentUrl.includes("nid.naver.com/nidlogin")
                ) {
                    await this.logger.success(
                        `✅ 로그인 페이지에서 벗어남: ${currentUrl}`
                    );
                    break;
                }
            }

            // 최종 로그인 성공 여부 확인
            const finalUrl = this.page.url();
            const finalTitle = await this.page.title();
            await this.logger.info(`📋 최종 상태:`);
            await this.logger.info(`  - 최종 URL: ${finalUrl}`);
            await this.logger.info(`  - 최종 페이지 제목: ${finalTitle}`);
            await this.logger.info(`  - 원래 URL: ${urlBeforeClick}`);
            await this.logger.info(
                `  - URL이 변경됨: ${
                    finalUrl !== urlBeforeClick ? "예" : "아니오"
                }`
            );
            await this.logger.info(
                `  - nidlogin 포함 여부: ${
                    finalUrl.includes("nidlogin") ? "예" : "아니오"
                }`
            );

            // 로그인 페이지 요소가 여전히 존재하는지 확인
            try {
                const loginFormStillExists =
                    (await this.page.$("input#id")) !== null;
                await this.logger.info(
                    `  - 로그인 폼 여전히 존재: ${
                        loginFormStillExists ? "예" : "아니오"
                    }`
                );
            } catch (e) {
                await this.logger.error(`  - 로그인 폼 확인 중 오류: ${e}`);
            }

            // 로그인 성공 여부를 URL이나 페이지 내용으로 확인
            const isLoginPage =
                finalUrl.includes("nidlogin") ||
                finalUrl.includes("nid.naver.com/nidlogin") ||
                finalUrl.includes("nid.naver.com/nidlogin.login");

            if (isLoginPage) {
                await this.logger.error(
                    `❌ 로그인 실패 감지 - 여전히 로그인 페이지에 있음`
                );
                await this.logger.error(`  - 최종 URL: ${finalUrl}`);
                await this.logger.error(`  - 최종 페이지 제목: ${finalTitle}`);
                return {
                    success: false,
                    message: `Login may have failed - still on login page. URL: ${finalUrl}, Title: ${finalTitle}`,
                    currentUrl: finalUrl,
                };
            } else {
                await this.logger.success(
                    `✅ 로그인 성공 - 메인 페이지로 리다이렉트됨`
                );
                return {
                    success: true,
                    message: "Login successful",
                    currentUrl: finalUrl,
                };
            }
        } else {
            await this.logger.info(
                `⚠️ 로그인 버튼을 찾을 수 없음, Enter 키 시도...`
            );
            const urlBeforeEnter = this.page.url();
            await this.logger.info(`📋 Enter 키 전 URL: ${urlBeforeEnter}`);

            await passwordField.press("Enter");
            await this.logger.info(`⌨️ Enter 키 입력 완료`);

            await this.page.waitForTimeout(PAGE_NAVIGATION_DELAY);

            // Enter 키 후에도 확인
            const urlAfterEnter = this.page.url();
            const titleAfterEnter = await this.page.title();
            await this.logger.info(`📋 Enter 키 후 상태:`);
            await this.logger.info(`  - URL: ${urlAfterEnter}`);
            await this.logger.info(`  - 페이지 제목: ${titleAfterEnter}`);
            await this.logger.info(
                `  - URL 변경 여부: ${
                    urlAfterEnter !== urlBeforeEnter ? "예" : "아니오"
                }`
            );

            return {
                success: true,
                message: "Login attempted with Enter key",
                currentUrl: urlAfterEnter,
            };
        }
    }
}
