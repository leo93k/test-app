/**
 * 네이버 블로그 자동화를 위한 CSS 선택자 모음
 */

// 로그인 버튼 선택자
export const loginButtonSelectors = [
    "button[type='submit']",
    "li.login a", // 가장 간단한 방법
    "li.i1.login a",
    "li.login a.btn_blog_login",
    "a.btn_blog_login",
    'a[href*="nidlogin.login"]',
    'a[href*="nid.naver.com"]',
];

// 아이디 입력 필드 선택자 (네이버 특화 + 일반적인 셀렉터)
export const idSelectors = [
    // 네이버 특화 셀렉터
    "input#id",
];

// 비밀번호 입력 필드 선택자 (네이버 특화 + 일반적인 셀렉터)
export const pwSelectors = [
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
    'input[placeholder*="Password"]',
    "#password",
    "#pass",
];

// 아이디 입력 필드 선택자 (별칭 - AutoLoginService 호환용)

// 비밀번호 입력 필드 선택자 (별칭 - AutoLoginService 호환용)
export const passwordSelectors = pwSelectors;

// 로그인 제출 버튼 선택자
export const loginSubmitSelectors = [
    "#log\\.login",
    'button[type="submit"]',
    'input[type="submit"]',
    'button:has-text("로그인")',
    ".btn_login",
];

// 서로이웃 추가 버튼 선택자
export const friendRequestSelectors = [
    "a._addBuddyPop", // 이웃추가 버튼 (정확한 클래스)
    "a.btn_add_nb", // 이웃추가 버튼 클래스
    "a.btn_add_nb._addBuddyPop", // 정확한 구조
    'a[class*="btn_add_nb"]', // 클래스 포함
    'a[class*="_addBuddyPop"]', // 클래스 포함
    'a:has-text("이웃추가")',
    'a:has-text("서로이웃")',
    'button:has-text("서로이웃")',
    'a:has-text("이웃")',
    'button:has-text("이웃")',
    '[class*="friend"]',
    '[id*="friend"]',
    '[class*="neighbor"]',
    '[id*="neighbor"]',
];

// 라디오 버튼 선택자 (서로이웃 관계 선택)
export const radioSelectors = ["input#each_buddy_add"];

// 다음 버튼 선택자 (1차)
export const nextButtonSelectors = ["a.button_next._buddyAddNext"];

// 메시지 입력 필드 선택자
export const messageSelectors = [
    "textarea#message", // 정확한 ID 매칭 (최우선)
];

// 최종 다음 버튼 선택자 (프로세스 완료)
export const finalNextButtonSelectors = ["a.button_next._addBothBuddy"];

/**
 * 네이버 블로그 검색을 위한 CSS 선택자 모음
 */

// 블로그 검색 결과 아이템 컨테이너 선택자
export const blogItemContainerSelectors = [
    ".list_search_blog",
    ".area_list_search .list_search_blog",
    ".search_list li",
    ".blog_item",
    ".post_item",
    "li[ng-repeat]",
    ".item",
];

// 블로그 제목 선택자
export const blogTitleSelectors = [
    ".name_blog .text_blog",
    ".text_blog",
    ".name_blog",
    ".title",
    ".blog_title",
    "a[href*='blog.naver.com']",
];

// 블로그 설명 선택자
export const blogDescriptionSelectors = [
    ".blog_intro",
    ".desc",
    ".description",
    ".content",
];

// 블로그 작성자 선택자
export const blogAuthorSelectors = [
    ".name_author",
    ".author",
    ".writer",
    ".blogger",
];
