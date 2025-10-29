/**
 * 네이버 블로그 자동화를 위한 CSS 선택자 모음
 */

// 로그인 버튼 선택자
export const loginButtonSelectors = [
    "li.login a", // 가장 간단한 방법
    "li.i1.login a",
    "li.login a.btn_blog_login",
    "a.btn_blog_login",
    'a[href*="nidlogin.login"]',
    'a[href*="nid.naver.com"]',
];

// 아이디 입력 필드 선택자
export const idSelectors = [
    "#id",
    'input[name="id"]',
    'input[placeholder*="아이디"]',
    'input[placeholder*="ID"]',
    'input[type="text"]',
];

// 비밀번호 입력 필드 선택자
export const pwSelectors = [
    "#pw",
    'input[name="pw"]',
    'input[placeholder*="비밀번호"]',
    'input[placeholder*="Password"]',
    'input[type="password"]',
];

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
export const radioSelectors = [
    "input#each_buddy_add",
    'input[type="radio"][id="each_buddy_add"]',
    'input.radio_button_buddy[id="each_buddy_add"]',
    'input[type="radio"][name="relation"][value="1"]',
    'input[type="radio"].radio_button_buddy',
];

// 다음 버튼 선택자 (1차)
export const nextButtonSelectors = [
    "a.button_next._buddyAddNext",
    "a._buddyAddNext",
    "a.button_next",
    'a:has-text("다음")',
    'a[class*="button_next"]',
    'a[class*="_buddyAddNext"]',
    'a[href*="buddyAdd"]',
];

// 메시지 입력 필드 선택자
export const messageSelectors = [
    "textarea#message", // 정확한 ID 매칭 (최우선)
    "textarea[name='message']",
    "textarea.text_box._bothBuddyAddMessage",
    "textarea._bothBuddyAddMessage",
    "textarea.text_box",
    "textarea",
    'input[type="text"]',
    'textarea[placeholder*="메시지"]',
    'textarea[placeholder*="message"]',
    'input[placeholder*="메시지"]',
    'input[placeholder*="message"]',
];

// 최종 다음 버튼 선택자 (프로세스 완료)
export const finalNextButtonSelectors = [
    "a.button_next._buddyAddNext",
    "a._buddyAddNext",
    "a.button_next",
    'a:has-text("다음")',
    'button:has-text("다음")',
    'a[class*="button_next"]',
    'a[class*="_buddyAddNext"]',
    'a[href*="buddyAdd"]',
    'button[type="submit"]',
    'input[type="submit"]',
];
