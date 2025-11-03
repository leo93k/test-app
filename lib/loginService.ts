import { Page } from "playwright";

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
        const usernameSelectors = [
            // 네이버 특화 셀렉터
            "#id",
            'input[name="id"]',
            'input[id="id"]',
            'input[placeholder="아이디"]',
            'input[placeholder="이메일"]',

            // 일반적인 셀렉터
            'input[name="username"]',
            'input[name="email"]',
            'input[name="user"]',
            'input[name="login"]',
            'input[type="email"]',
            'input[placeholder*="아이디"]',
            'input[placeholder*="이메일"]',
            'input[placeholder*="username"]',
            'input[placeholder*="email"]',
            "#username",
            "#email",
            "#user",
            "#login",
        ];

        for (const selector of usernameSelectors) {
            try {
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
        const passwordSelectors = [
            // 네이버 특화 셀렉터
            "#pw",
            'input[name="pw"]',
            'input[id="pw"]',
            'input[placeholder="비밀번호"]',

            // 일반적인 셀렉터
            'input[name="password"]',
            'input[name="pass"]',
            'input[type="password"]',
            'input[placeholder*="비밀번호"]',
            'input[placeholder*="password"]',
            "#password",
            "#pass",
        ];

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
        const loginButtonSelectors = [
            // 네이버 특화 셀렉터
            "li.login a",
        ];

        let loginButton = null;
        for (const selector of loginButtonSelectors) {
            try {
                loginButton = await this.page.$(selector);
                if (loginButton) {
                    console.log(`Found login button: ${selector}`);
                    break;
                }
            } catch (e) {
                continue;
            }
        }

        if (loginButton) {
            await loginButton.click();
            console.log(`Login button clicked`);

            // 로그인 후 페이지 로드 대기
            await this.page.waitForTimeout(5000);

            // 로그인 성공 여부 확인
            const currentUrl = this.page.url();
            console.log(`Current URL after login: ${currentUrl}`);

            // 로그인 성공 여부를 URL이나 페이지 내용으로 확인
            if (
                currentUrl.includes("naver.com") &&
                !currentUrl.includes("nidlogin")
            ) {
                console.log(
                    `Login appears successful - redirected to main page`
                );
                return {
                    success: true,
                    message: "Login successful",
                    currentUrl,
                };
            } else {
                console.log(`Login may have failed - still on login page`);
                return {
                    success: false,
                    message: "Login may have failed - still on login page",
                    currentUrl,
                };
            }
        } else {
            console.log(`Login button not found, trying Enter key`);
            await passwordField.press("Enter");
            await this.page.waitForTimeout(3000);

            // Enter 키 후에도 확인
            const currentUrl = this.page.url();
            console.log(`Current URL after Enter key: ${currentUrl}`);

            return {
                success: true,
                message: "Login attempted with Enter key",
                currentUrl,
            };
        }
    }
}
