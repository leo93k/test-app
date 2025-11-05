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

// ==================== User-Agent 생성용 상수 ====================
/**
 * 운영체제 목록 (User-Agent 생성용)
 */
export const OS_LIST = [
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
] as const;

/**
 * Chrome 버전 목록 (User-Agent 생성용)
 */
export const CHROME_VERSIONS = [
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
] as const;

/**
 * WebKit 버전 목록 (User-Agent 생성용)
 */
export const WEBKIT_VERSIONS = ["537.36", "537.37", "537.38"] as const;
