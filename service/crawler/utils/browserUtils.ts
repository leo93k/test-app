// ==================== Chrome 브라우저 인자 ====================
/**
 * 봇 탐지 우회를 위한 기본 Chrome 인자
 */
export const DEFAULT_CHROME_ARGS = [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-blink-features=AutomationControlled", // WebDriver 탐지 우회
    "--disable-dev-shm-usage",
    "--disable-accelerated-2d-canvas",
    "--no-first-run",
    "--no-zygote",
    "--disable-gpu",
    "--disable-web-security",
    "--disable-features=IsolateOrigins,site-per-process",
    "--disable-site-isolation-trials",
    "--disable-extensions",
    "--disable-plugins",
    "--disable-javascript-harmony-shipping",
    "--disable-background-timer-throttling",
    "--disable-backgrounding-occluded-windows",
    "--disable-renderer-backgrounding",
    "--disable-background-networking",
    "--force-color-profile=srgb",
    "--metrics-recording-only",
    "--mute-audio",
    "--no-default-browser-check",
    "--enable-automation=false", // 자동화 모드 비활성화
    "--password-store=basic",
    "--use-mock-keychain",
];

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
    // 운영체제 조합
    const osList = [
        {
            name: "Windows NT 10.0; Win64; x64",
            platform: "Windows",
        },
        {
            name: "Macintosh; Intel Mac OS X 10_15_7",
            platform: "Mac",
        },
        {
            name: "Macintosh; Intel Mac OS X 11_0_0",
            platform: "Mac",
        },
        {
            name: "Macintosh; Intel Mac OS X 12_0_0",
            platform: "Mac",
        },
        {
            name: "X11; Linux x86_64",
            platform: "Linux",
        },
    ];

    // Chrome 버전 (최신 버전 범위)
    const chromeVersions = [
        "120.0.0.0",
        "121.0.0.0",
        "122.0.0.0",
        "123.0.0.0",
        "124.0.0.0",
        "125.0.0.0",
        "126.0.0.0",
        "127.0.0.0",
        "128.0.0.0",
        "129.0.0.0",
    ];

    // WebKit 버전
    const webkitVersions = ["537.36", "537.37", "537.38"];

    // 랜덤 선택
    const os = osList[Math.floor(Math.random() * osList.length)];
    const chromeVersion =
        chromeVersions[Math.floor(Math.random() * chromeVersions.length)];
    const webkitVersion =
        webkitVersions[Math.floor(Math.random() * webkitVersions.length)];

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
