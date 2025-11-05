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
import { Logger } from "../../logger";
import { findElement } from "../utils/crawlService";

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
        return await findElement(this.page, idSelectors, this.logger, {
            contextName: "아이디 입력 필드",
            useWaitForSelector: false,
        });
    }

    private async findPasswordField() {
        return await findElement(this.page, passwordSelectors, this.logger, {
            contextName: "비밀번호 입력 필드",
            useWaitForSelector: false,
        });
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
        // 봇 탐지 우회를 위한 인간적인 타이핑 시뮬레이션
        await this.typeHumanLike(usernameField, username);
        await this.logger.success(`✅ 사용자명 입력 완료`);

        // 필드 전환 전 약간의 대기
        await this.page.waitForTimeout(200 + Math.random() * 100);

        await passwordField.click();
        // 비밀번호도 인간적인 타이핑으로 입력
        await this.typeHumanLike(passwordField, password);
        await this.logger.success(`✅ 비밀번호 입력 완료`);

        // 입력 완료 후 약간의 대기 (사용자가 확인하는 시간)
        await this.page.waitForTimeout(300 + Math.random() * 200);

        await this.logger.success(`Login credentials filled`);
    }

    /**
     * 인간적인 타이핑 시뮬레이션 (봇 탐지 우회)
     * 각 문자를 랜덤한 속도로 입력하여 실제 사용자처럼 보이게 함
     */
    private async typeHumanLike(field: any, text: string): Promise<void> {
        // 기존 내용 지우기
        await field.fill("");

        // 각 문자를 개별적으로 입력
        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            await field.type(char, {
                delay: 50 + Math.random() * 100, // 50-150ms 사이의 랜덤 딜레이
            });

            // 가끔씩 더 긴 딜레이 (사용자가 생각하는 것처럼)
            if (Math.random() < 0.1 && i > 0) {
                await this.page.waitForTimeout(200 + Math.random() * 300);
            }
        }
    }

    private async clickLoginButton(passwordField: any): Promise<LoginResult> {
        const urlBeforeClick = this.page.url();
        await this.logPageState("로그인 버튼 클릭 전");

        const loginButton = await this.findLoginButton();

        if (loginButton) {
            await this.clickLoginButtonAndWait(loginButton);
            const urlAfterClick = this.page.url();

            const redirectResult = await this.waitForLoginRedirect(
                urlAfterClick
            );

            if (!redirectResult.success) {
                return redirectResult;
            }

            return this.verifyLoginSuccess(urlBeforeClick);
        } else {
            return await this.tryLoginWithEnterKey(passwordField);
        }
    }

    private async findLoginButton() {
        const selectorsToTry = [
            ...loginSubmitSelectors,
            ...loginButtonSelectors,
        ];

        return await findElement(this.page, selectorsToTry, this.logger, {
            contextName: "로그인 버튼",
            useWaitForSelector: false,
        });
    }

    private async logPageState(context: string) {
        const url = this.page.url();
        const title = await this.page.title();
        await this.logger.info(`📋 ${context} 상태:`);
        await this.logger.info(`  - URL: ${url}`);
        await this.logger.info(`  - 페이지 제목: ${title}`);
    }

    private async clickLoginButtonAndWait(loginButton: any) {
        await this.logger.info(`🖱️ 로그인 버튼 클릭 시작...`);
        await loginButton.click();
        await this.logger.success(`✅ 로그인 버튼 클릭 완료`);

        // 클릭 직후 네비게이션 시작 대기
        await this.page
            .waitForLoadState("domcontentloaded", { timeout: ACTION_DELAY })
            .catch(() => {});
    }

    private async getCurrentPageInfo(): Promise<{
        url: string;
        title: string;
    }> {
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

        return { url: currentUrl, title: currentTitle };
    }

    private async checkLoginError(): Promise<string | null> {
        try {
            const errorMessage = await this.page.evaluate(
                (selectors: string[]) => {
                    const bodyText = document.body?.textContent || "";

                    // 자동입력 방지 문자 오류 메시지 확인
                    if (
                        bodyText.includes("아이디") &&
                        (bodyText.includes("자동입력 방지 문자") ||
                            bodyText.includes("자동입력 방지") ||
                            bodyText.includes("입력하신 내용을 다시 확인"))
                    ) {
                        return "자동입력 방지 문자로 인해 로그인에 실패했습니다.";
                    }

                    // 비밀번호 오류 메시지 확인
                    if (
                        bodyText.includes("아이디") &&
                        (bodyText.includes("비밀번호가 잘못") ||
                            bodyText.includes("비밀번호를 정확히"))
                    ) {
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

                    // 에러 메시지 셀렉터로 찾기 (Caps Lock 등 경고 제외)
                    for (const selector of selectors) {
                        const element = document.querySelector(selector);
                        if (element && element.textContent) {
                            const text = element.textContent.trim();

                            if (
                                text.includes("Caps Lock") ||
                                text.includes("대소문자") ||
                                text.includes("켜져 있습니다")
                            ) {
                                continue;
                            }

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

            return errorMessage;
        } catch {
            return null;
        }
    }

    private async waitForLoginRedirect(
        urlAfterClick: string
    ): Promise<LoginResult> {
        await this.logger.info(`⏳ 로그인 완료 및 리다이렉트 대기 중...`);

        let elapsedTime = 0;
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
            const { url: currentUrl, title: currentTitle } =
                await this.getCurrentPageInfo();

            await this.logger.info(`📋 대기 중 (${elapsedTime}ms):`);
            await this.logger.info(`  - URL: ${currentUrl}`);
            await this.logger.info(`  - 페이지 제목: ${currentTitle}`);

            // URL 변경 감지
            if (currentUrl !== previousUrl) {
                await this.logger.info(
                    `🔄 URL 변경 감지: ${previousUrl} → ${currentUrl}`
                );
                previousUrl = currentUrl;
            }

            // 로그인 오류 메시지 확인
            const errorMessage = await this.checkLoginError();
            if (errorMessage) {
                return {
                    success: false,
                    message: `Login failed: ${errorMessage}`,
                    currentUrl: currentUrl,
                };
            }

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

        return { success: true, message: "Continue to verification" };
    }

    private async verifyLoginSuccess(
        urlBeforeClick: string
    ): Promise<LoginResult> {
        const finalUrl = this.page.url();
        const finalTitle = await this.page.title();

        await this.logger.info(`📋 최종 상태:`);
        await this.logger.info(`  - 최종 URL: ${finalUrl}`);
        await this.logger.info(`  - 최종 페이지 제목: ${finalTitle}`);
        await this.logger.info(`  - 원래 URL: ${urlBeforeClick}`);
        await this.logger.info(
            `  - URL이 변경됨: ${finalUrl !== urlBeforeClick ? "예" : "아니오"}`
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
    }

    private async tryLoginWithEnterKey(
        passwordField: any
    ): Promise<LoginResult> {
        await this.logger.info(
            `⚠️ 로그인 버튼을 찾을 수 없음, Enter 키 시도...`
        );
        const urlBeforeEnter = this.page.url();
        await this.logger.info(`📋 Enter 키 전 URL: ${urlBeforeEnter}`);

        await passwordField.press("Enter");
        await this.logger.info(`⌨️ Enter 키 입력 완료`);

        await this.page.waitForTimeout(PAGE_NAVIGATION_DELAY);

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
