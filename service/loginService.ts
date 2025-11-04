import { Page } from "playwright";
import {
    idSelectors,
    passwordSelectors,
    loginSubmitSelectors,
    loginButtonSelectors,
} from "@/const/selectors";

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

    constructor(page: Page) {
        this.page = page;
    }

    async attemptLogin(credentials: LoginCredentials): Promise<LoginResult> {
        const { username, password } = credentials;

        if (!username || !password) {
            return {
                success: false,
                message: "Username and password are required",
            };
        }

        console.log(`Attempting automatic login...`);

        try {
            // 로그인 필드 찾기
            const usernameField = await this.findUsernameField();
            const passwordField = await this.findPasswordField();

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
            console.error(`Login error: ${error}`);
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
                console.log(`Finding username field: ${selector}`);
                const field = await this.page.$(selector);
                if (field) {
                    console.log(`Found username field: ${selector}`);
                    return field;
                }
            } catch (e) {
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
                    console.log(`Found password field: ${selector}`);
                    return field;
                }
            } catch (e) {
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
        await usernameField.click();
        await this.page.waitForTimeout(500);
        await usernameField.fill(username);

        await passwordField.click();
        await this.page.waitForTimeout(500);
        await passwordField.fill(password);

        console.log(`Login credentials filled`);

        // 입력 후 잠시 대기
        await this.page.waitForTimeout(1000);
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
        console.log(`📋 로그인 버튼 클릭 전 상태:`);
        console.log(`  - URL: ${urlBeforeClick}`);
        console.log(`  - 페이지 제목: ${titleBeforeClick}`);

        for (const selector of selectorsToTry) {
            try {
                console.log(`🔍 로그인 버튼 찾기 시도: ${selector}`);
                loginButton = await this.page.$(selector);
                if (loginButton) {
                    console.log(`✅ 로그인 버튼 발견: ${selector}`);
                    break;
                } else {
                    console.log(
                        `❌ 셀렉터 "${selector}"로 버튼을 찾을 수 없음`
                    );
                }
            } catch (e) {
                console.log(`❌ 셀렉터 "${selector}" 시도 중 오류: ${e}`);
                continue;
            }
        }

        if (loginButton) {
            console.log(`🖱️ 로그인 버튼 클릭 시작...`);
            await loginButton.click();
            console.log(`✅ 로그인 버튼 클릭 완료`);

            // 클릭 직후 URL 확인
            await this.page.waitForTimeout(500);
            const urlAfterClick = this.page.url();
            console.log(`📋 로그인 버튼 클릭 직후 URL: ${urlAfterClick}`);

            // 로그인 후 페이지 로드 대기 (단계별로 URL 확인)
            const checkInterval = 1000; // 1초마다 체크
            const maxWaitTime = 5000; // 최대 5초 대기
            let elapsedTime = 0;

            console.log(`⏳ 로그인 완료 및 리다이렉트 대기 중...`);

            while (elapsedTime < maxWaitTime) {
                await this.page.waitForTimeout(checkInterval);
                elapsedTime += checkInterval;
                const currentUrl = this.page.url();
                const currentTitle = await this.page.title();

                console.log(`📋 대기 중 (${elapsedTime}ms):`);
                console.log(`  - URL: ${currentUrl}`);
                console.log(`  - 페이지 제목: ${currentTitle}`);

                // URL이 변경되었는지 확인
                if (currentUrl !== urlAfterClick) {
                    console.log(
                        `🔄 URL 변경 감지됨: ${urlAfterClick} → ${currentUrl}`
                    );
                }

                // 로그인 페이지에서 벗어났는지 확인
                if (
                    !currentUrl.includes("nidlogin") &&
                    !currentUrl.includes("nid.naver.com/nidlogin")
                ) {
                    console.log(`✅ 로그인 페이지에서 벗어남: ${currentUrl}`);
                    break;
                }
            }

            // 최종 로그인 성공 여부 확인
            const finalUrl = this.page.url();
            const finalTitle = await this.page.title();
            console.log(`📋 최종 상태:`);
            console.log(`  - 최종 URL: ${finalUrl}`);
            console.log(`  - 최종 페이지 제목: ${finalTitle}`);
            console.log(`  - 원래 URL: ${urlBeforeClick}`);
            console.log(
                `  - URL이 변경됨: ${
                    finalUrl !== urlBeforeClick ? "예" : "아니오"
                }`
            );
            console.log(
                `  - nidlogin 포함 여부: ${
                    finalUrl.includes("nidlogin") ? "예" : "아니오"
                }`
            );

            // 로그인 페이지 요소가 여전히 존재하는지 확인
            try {
                const loginFormStillExists =
                    (await this.page.$("input#id")) !== null;
                console.log(
                    `  - 로그인 폼 여전히 존재: ${
                        loginFormStillExists ? "예" : "아니오"
                    }`
                );
            } catch (e) {
                console.log(`  - 로그인 폼 확인 중 오류: ${e}`);
            }

            // 로그인 성공 여부를 URL이나 페이지 내용으로 확인
            const isLoginPage =
                finalUrl.includes("nidlogin") ||
                finalUrl.includes("nid.naver.com/nidlogin") ||
                finalUrl.includes("nid.naver.com/nidlogin.login");

            if (isLoginPage) {
                console.log(
                    `❌ 로그인 실패 감지 - 여전히 로그인 페이지에 있음`
                );
                console.log(`  - 최종 URL: ${finalUrl}`);
                console.log(`  - 최종 페이지 제목: ${finalTitle}`);
                return {
                    success: false,
                    message: `Login may have failed - still on login page. URL: ${finalUrl}, Title: ${finalTitle}`,
                    currentUrl: finalUrl,
                };
            } else {
                console.log(`✅ 로그인 성공 - 메인 페이지로 리다이렉트됨`);
                return {
                    success: true,
                    message: "Login successful",
                    currentUrl: finalUrl,
                };
            }
        } else {
            console.log(`⚠️ 로그인 버튼을 찾을 수 없음, Enter 키 시도...`);
            const urlBeforeEnter = this.page.url();
            console.log(`📋 Enter 키 전 URL: ${urlBeforeEnter}`);

            await passwordField.press("Enter");
            console.log(`⌨️ Enter 키 입력 완료`);

            await this.page.waitForTimeout(3000);

            // Enter 키 후에도 확인
            const urlAfterEnter = this.page.url();
            const titleAfterEnter = await this.page.title();
            console.log(`📋 Enter 키 후 상태:`);
            console.log(`  - URL: ${urlAfterEnter}`);
            console.log(`  - 페이지 제목: ${titleAfterEnter}`);
            console.log(
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
