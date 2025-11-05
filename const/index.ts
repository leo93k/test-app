export const ID = "";
export const PASSWORD = "";

export const LOGIN_URL =
    "https://nid.naver.com/nidlogin.login?mode=form&url=https://www.naver.com/";

export const NAVER_BLOG_SEARCH_URL =
    "https://section.blog.naver.com/Search/Blog.naver";

// ==================== 타임아웃 ====================
// 페이지 로드 타임아웃 (밀리초)
export const PAGE_LOAD_TIMEOUT = 1000 * 60; // 60초

// 기본 타임아웃 시간 (밀리초)
export const DEFAULT_TIMEOUT = 30000; // 30초

// ==================== 액션 대기 시간 ====================
// 액션(클릭, 입력 등) 후 대기 시간 (밀리초)
export const ACTION_DELAY = 300; // 1초

// ==================== 페이지 이동 대기 시간 ====================
// 페이지 이동/로드 후 대기 시간 (밀리초)
export const PAGE_NAVIGATION_DELAY = 500; // 0.5초

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
