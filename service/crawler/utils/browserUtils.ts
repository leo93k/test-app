import {
    DEFAULT_CHROME_ARGS,
    OS_LIST,
    CHROME_VERSIONS,
    WEBKIT_VERSIONS,
} from "../const/browserArgs";

// ==================== Chrome 브라우저 인자 ====================
/**
 * Chrome 브라우저 실행 인자 생성
 * @param headless - headless 모드 여부
 * @returns Chrome 인자 배열
 */
export function getChromeArgs(headless: boolean = false): string[] {
    return [...DEFAULT_CHROME_ARGS, ...(headless ? [] : ["--start-maximized"])];
}

// ==================== User-Agent 생성 ====================
/**
 * 랜덤한 User-Agent 생성 (자동로그인 방지 우회)
 */
export function generateRandomUserAgent(): string {
    // 랜덤 선택
    const os = OS_LIST[Math.floor(Math.random() * OS_LIST.length)];
    const chromeVersion =
        CHROME_VERSIONS[Math.floor(Math.random() * CHROME_VERSIONS.length)];
    const webkitVersion =
        WEBKIT_VERSIONS[Math.floor(Math.random() * WEBKIT_VERSIONS.length)];

    // User-Agent 생성
    return `Mozilla/5.0 (${os.name}) AppleWebKit/${webkitVersion} (KHTML, like Gecko) Chrome/${chromeVersion} Safari/${webkitVersion}`;
}

// ==================== 봇 탐지 우회 스크립트 ====================
/**
 * WebDriver 탐지 우회를 위한 JavaScript 초기화 스크립트
 * Playwright의 context.addInitScript()에 전달할 함수
 */
export function getBotDetectionBypassScript(): () => void {
    return () => {
        // navigator.webdriver 제거
        Object.defineProperty(navigator, "webdriver", {
            get: () => false,
        });

        // Chrome 객체 추가
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).chrome = {
            runtime: {},
        };

        // permissions API 모킹
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const originalQuery = (window.navigator as any).permissions.query;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window.navigator as any).permissions.query = (parameters: {
            name: string;
        }) =>
            parameters.name === "notifications"
                ? Promise.resolve({ state: Notification.permission })
                : originalQuery(parameters);

        // plugins 배열 추가
        Object.defineProperty(navigator, "plugins", {
            get: () => [1, 2, 3, 4, 5],
        });

        // languages 배열 설정
        Object.defineProperty(navigator, "languages", {
            get: () => ["ko-KR", "ko", "en-US", "en"],
        });
    };
}
