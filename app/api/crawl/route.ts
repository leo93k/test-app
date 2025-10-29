import { NextRequest, NextResponse } from "next/server";
import { chromium } from "playwright";
import { AutoLoginService } from "../../../lib/loginService";
import { Logger } from "../../../lib/logger";
import {
    loginButtonSelectors,
    idSelectors,
    pwSelectors,
    loginSubmitSelectors,
    friendRequestSelectors,
    radioSelectors,
    nextButtonSelectors,
    messageSelectors,
    finalNextButtonSelectors,
} from "../../../lib/selectors";

// Delay 상수 정의
const PAGE_NAVIGATION_DELAY = 300; // 페이지 이동 후 대기 시간 (ms)
const ACTION_DELAY = 300; // 액션 간 대기 시간 (ms)
const LOGIN_COMPLETE_DELAY = 2500; // 로그인 완료 후 대기 시간 (ms)

export async function POST(request: NextRequest) {
    let browser = null;
    const sessionId = Date.now().toString();
    const logger = Logger.getInstance(sessionId);

    try {
        const {
            url,
            username,
            password,
            keepOpen = false,
            autoCloseDelay = 0,
            headless = false,
            loginOnly = false,
            friendRequest = false,
            message = "",
            sessionId = null,
        } = await request.json();

        if (!url) {
            return NextResponse.json(
                { error: "URL is required" },
                { status: 400 }
            );
        }

        // URL 유효성 검사
        try {
            new URL(url);
        } catch {
            return NextResponse.json(
                { error: "Invalid URL format" },
                { status: 400 }
            );
        }

        await logger.info(`크롤링 시작: ${url}`);

        // Playwright 브라우저 실행
        await logger.info(
            `브라우저 실행 중... (${
                headless ? "백그라운드" : "화면 표시"
            } 모드)`
        );
        browser = await chromium.launch({
            headless: headless, // 백그라운드 실행 여부
            slowMo: headless ? 0 : 1000, // 백그라운드 모드에서는 대기 시간 없음
            args: [
                "--no-sandbox",
                "--disable-setuid-sandbox",
                ...(headless ? [] : ["--start-maximized"]), // 백그라운드 모드가 아닐 때만 최대화
            ],
        });
        await logger.success(
            `브라우저 실행 완료 (${headless ? "백그라운드" : "화면 표시"} 모드)`
        );

        const page = await browser.newPage();

        // 타임아웃 설정
        page.setDefaultTimeout(30000);
        page.setDefaultNavigationTimeout(30000);

        // User-Agent 설정
        await page.setExtraHTTPHeaders({
            "User-Agent":
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        });

        // 페이지 로드 및 대기
        await logger.info(`페이지 로딩 시작: ${url}`);
        await page.goto(url, {
            waitUntil: "domcontentloaded",
            timeout: 30000,
        });
        await logger.success(`페이지 로딩 완료: ${url}`);

        // 페이지가 완전히 로드될 때까지 잠시 대기
        await logger.info("페이지 완전 로드 대기 중...");
        await page.waitForTimeout(PAGE_NAVIGATION_DELAY);
        await logger.success("페이지 완전 로드 완료");

        // 페이지 제목을 로그에 출력
        const title = await page.title();
        await logger.success(`페이지 로드 완료: ${title}`);

        // 로그인 정보가 제공된 경우 자동 로그인 시도 (서로이웃 추가 모드가 아닐 때만)
        if (username && password && !friendRequest) {
            await logger.info("자동 로그인 시도 중...");
            const loginService = new AutoLoginService(page);
            const loginResult = await loginService.attemptLogin({
                username,
                password,
            });
            await logger.info(`로그인 결과: ${loginResult.message}`);
        }

        if (!friendRequest) {
            return;
        }
        // 서로이웃 추가 모드인 경우
        await logger.info("🤝 서로이웃 추가 프로세스를 시작합니다...");

        try {
            /**
             * [페이지]:블로그
             * action: 로그인 버튼 찾기
             */
            await page.waitForTimeout(PAGE_NAVIGATION_DELAY);
            await logger.info("⏳ 페이지 완전 로드 대기 완료");

            let loginButtonClicked = false;
            let foundSelector = "";
            try {
                const frames = page.frames();
                await logger.info(`📋 발견된 iframe 개수: ${frames.length}`);

                for (let i = 0; i < frames.length; i++) {
                    const frame = frames[i];
                    await logger.info(`🔍 iframe ${i + 1}에서 검색 중...`);

                    for (const selector of loginButtonSelectors) {
                        try {
                            const loginButton = await frame.$(selector);
                            if (loginButton) {
                                await logger.info(
                                    `🔘 iframe ${
                                        i + 1
                                    }에서 로그인 버튼 발견: ${selector}`
                                );
                                await loginButton.click();
                                await logger.success(
                                    `✅ iframe 내 로그인 버튼 클릭 완료 (선택자: ${selector})`
                                );
                                loginButtonClicked = true;
                                foundSelector = `iframe[${i + 1}]: ${selector}`;
                                break;
                            }
                        } catch (error) {
                            continue;
                        }
                    }

                    if (loginButtonClicked) break;
                }
            } catch (iframeError) {
                await logger.error(`❌ iframe 검색 실패: ${iframeError}`);
            }

            /**
             * [페이지]:로그인 페이지
             * action: 아이디/ 비밀번호 입력하기
             */
            await logger.info("📝 3단계: 로그인 폼에 정보 입력 중...");

            // 아이디 입력

            let idInputted = false;
            for (const selector of idSelectors) {
                try {
                    const idInput = await page.$(selector);
                    if (idInput) {
                        await idInput.fill(username);
                        await logger.success("✅ 아이디 입력 완료");
                        idInputted = true;
                        break;
                    }
                } catch (error) {
                    continue;
                }
            }

            if (!idInputted) {
                throw new Error("아이디 입력 필드를 찾을 수 없습니다.");
            }

            // 비밀번호 입력

            let pwInputted = false;
            for (const selector of pwSelectors) {
                try {
                    const pwInput = await page.$(selector);
                    if (pwInput) {
                        await pwInput.fill(password);
                        await logger.success("✅ 비밀번호 입력 완료");
                        pwInputted = true;
                        break;
                    }
                } catch (error) {
                    continue;
                }
            }

            if (!pwInputted) {
                throw new Error("비밀번호 입력 필드를 찾을 수 없습니다.");
            }

            // 로그인 버튼 클릭
            await logger.info("🔘 로그인 버튼 클릭 중...");

            let loginSubmitted = false;
            for (const selector of loginSubmitSelectors) {
                try {
                    const submitButton = await page.$(selector);
                    if (submitButton) {
                        await submitButton.click();
                        await logger.success("✅ 로그인 제출 완료");
                        loginSubmitted = true;
                        break;
                    }
                } catch (error) {
                    continue;
                }
            }

            if (!loginSubmitted) {
                throw new Error("로그인 제출 버튼을 찾을 수 없습니다.");
            }

            // 로그인 완료 대기
            await logger.info("⏳ 로그인 완료 대기 중...");
            await page.waitForTimeout(LOGIN_COMPLETE_DELAY);

            // 4. 블로그로 다시 리다이렉트되면 서로이웃 추가 기능 실행
            await logger.info("🔄 4단계: 원래 블로그로 리다이렉트 대기 중...");

            // 현재 URL이 블로그 페이지인지 확인
            const currentUrl = page.url();
            await logger.info(`현재 URL: ${currentUrl}`);

            // 로그인 후 원래 블로그 페이지로 돌아가기
            if (
                !currentUrl.includes("blog.naver.com") ||
                currentUrl.includes("nidlogin.login")
            ) {
                await logger.info("🔄 원래 블로그 페이지로 돌아가는 중...");

                // 원래 URL에서 블로그 ID 추출
                const originalUrl = url;
                const blogIdMatch = originalUrl.match(
                    /blog\.naver\.com\/([^\/]+)/
                );

                if (blogIdMatch) {
                    const blogId = blogIdMatch[1];
                    const blogUrl = `https://blog.naver.com/${blogId}`;

                    await logger.info(`📝 블로그 URL로 이동: ${blogUrl}`);
                    await page.goto(blogUrl, {
                        waitUntil: "domcontentloaded",
                        timeout: 30000,
                    });
                    await logger.success("✅ 원래 블로그 페이지로 이동 완료");

                    // 페이지 로드 대기
                    await page.waitForTimeout(PAGE_NAVIGATION_DELAY);
                } else {
                    await logger.error(
                        "⚠️ 블로그 ID를 추출할 수 없습니다. 현재 페이지에서 계속 진행합니다."
                    );
                }
            } else {
                await logger.info("✅ 이미 블로그 페이지에 있습니다.");
            }

            // 서로이웃 추가 버튼 찾기
            await logger.info("🔍 서로이웃 추가 버튼을 찾는 중...");

            let friendRequestClicked = false;
            for (const selector of friendRequestSelectors) {
                try {
                    const friendButton = await page.$(selector);
                    if (friendButton) {
                        await logger.info(`🔘 서로이웃 버튼 발견: ${selector}`);
                        await friendButton.click();
                        await logger.success("✅ 서로이웃 버튼 클릭 완료");
                        friendRequestClicked = true;
                        break;
                    }
                } catch (error) {
                    continue;
                }
            }

            // iframe 내부에서도 서로이웃 추가 버튼 찾기 시도
            if (!friendRequestClicked) {
                await logger.info(
                    "🔍 iframe 내부에서 서로이웃 추가 버튼 찾기 시도..."
                );
                try {
                    const frames = page.frames();
                    await logger.info(
                        `📋 발견된 iframe 개수: ${frames.length}`
                    );

                    for (let i = 0; i < frames.length; i++) {
                        const frame = frames[i];
                        await logger.info(`🔍 iframe ${i + 1}에서 검색 중...`);

                        for (const selector of friendRequestSelectors) {
                            try {
                                const friendButton = await frame.$(selector);
                                if (friendButton) {
                                    await logger.info(
                                        `🔘 iframe ${
                                            i + 1
                                        }에서 서로이웃 버튼 발견: ${selector}`
                                    );
                                    await friendButton.click();
                                    await logger.success(
                                        `✅ iframe 내 서로이웃 버튼 클릭 완료 (선택자: ${selector})`
                                    );
                                    friendRequestClicked = true;
                                    break;
                                }
                            } catch (error) {
                                continue;
                            }
                        }

                        if (friendRequestClicked) break;
                    }
                } catch (iframeError) {
                    await logger.error(`❌ iframe 검색 실패: ${iframeError}`);
                }
            }

            if (!friendRequestClicked) {
                await logger.error("⚠️ 서로이웃 추가 버튼을 찾을 수 없습니다.");
            } else {
                // 팝업이 열릴 때까지 대기
                await logger.info(
                    "⏳ 서로이웃 추가 팝업이 열릴 때까지 대기 중..."
                );
                await page.waitForTimeout(ACTION_DELAY);

                // 새 창(팝업)이 열렸는지 확인
                let popupPage = page;
                const context = page.context();
                const pages = context.pages();
                if (pages.length > 1) {
                    // 새 창이 열렸으면 새 페이지 사용
                    popupPage = pages[pages.length - 1];
                    await logger.info("🪟 새 팝업 창이 열렸습니다.");
                } else {
                    // 모달 팝업이면 현재 페이지 사용
                    await logger.info("📦 모달 팝업으로 처리합니다.");
                }

                // 라디오 버튼 클릭
                await logger.info("🔘 서로이웃 관계 라디오 버튼 찾는 중...");

                let radioClicked = false;

                // 먼저 메인 팝업 페이지에서 찾기
                for (const selector of radioSelectors) {
                    try {
                        await logger.info(
                            `🔍 라디오 버튼 찾기 시도: ${selector}`
                        );
                        await popupPage.waitForSelector(selector, {
                            timeout: 3000,
                        });
                        await logger.info(`🔘 라디오 버튼 발견: ${selector}`);

                        // 라디오 버튼이 비활성화되어 있는지 확인
                        const isDisabled = await popupPage.evaluate((sel) => {
                            const element = document.querySelector(sel);
                            return element && element.hasAttribute("disabled");
                        }, selector);

                        if (isDisabled) {
                            await logger.info(
                                "ℹ️ 라디오 버튼이 비활성화되어 있습니다. 다음 버튼으로 진행합니다."
                            );
                            radioClicked = true; // 클릭은 안 하지만 다음 단계로 진행
                            break;
                        }

                        // 직접 page.click 사용 (더 확실함)
                        await popupPage.click(selector, {
                            force: true,
                        });
                        await logger.success("✅ 라디오 버튼 클릭 완료");
                        radioClicked = true;
                        break;
                    } catch (error) {
                        await logger.info(
                            `❌ 라디오 버튼 찾기 실패: ${selector}`
                        );
                        continue;
                    }
                }

                // iframe 내부에서도 라디오 버튼 찾기
                if (!radioClicked) {
                    await logger.info(
                        "🔍 iframe 내부에서 라디오 버튼 찾기 시도..."
                    );
                    const frames = popupPage.frames();
                    for (let i = 0; i < frames.length; i++) {
                        const frame = frames[i];
                        for (const selector of radioSelectors) {
                            try {
                                await frame.waitForSelector(selector, {
                                    timeout: 3000,
                                });
                                await logger.info(
                                    `🔘 iframe ${
                                        i + 1
                                    }에서 라디오 버튼 발견: ${selector}`
                                );

                                // 라디오 버튼이 비활성화되어 있는지 확인
                                const isDisabled = await frame.evaluate(
                                    (sel) => {
                                        const element =
                                            document.querySelector(sel);
                                        return (
                                            element &&
                                            element.hasAttribute("disabled")
                                        );
                                    },
                                    selector
                                );

                                if (isDisabled) {
                                    await logger.info(
                                        "ℹ️ iframe 내 라디오 버튼이 비활성화되어 있습니다. 다음 버튼으로 진행합니다."
                                    );
                                    radioClicked = true; // 클릭은 안 하지만 다음 단계로 진행
                                    break;
                                }

                                await frame.click(selector, {
                                    force: true,
                                });
                                await logger.success(
                                    `✅ iframe 내 라디오 버튼 클릭 완료`
                                );
                                radioClicked = true;
                                break;
                            } catch (error) {
                                continue;
                            }
                        }
                        if (radioClicked) break;
                    }
                }

                if (!radioClicked) {
                    await logger.error("⚠️ 라디오 버튼을 찾을 수 없습니다.");
                }

                // 라디오 버튼 클릭 후 잠시 대기
                await popupPage.waitForTimeout(ACTION_DELAY);

                // "다음" 버튼 클릭
                await logger.info("🔘 다음 버튼 찾는 중...");

                let nextClicked = false;
                for (const selector of nextButtonSelectors) {
                    try {
                        const nextButton = await popupPage.$(selector);
                        if (nextButton) {
                            await nextButton.click();
                            await logger.success(
                                `✅ 다음 버튼 클릭 완료 (선택자: ${selector})`
                            );
                            nextClicked = true;
                            break;
                        }
                    } catch (error) {
                        continue;
                    }
                }

                // iframe 내부에서도 다음 버튼 찾기
                if (!nextClicked) {
                    await logger.info(
                        "🔍 iframe 내부에서 다음 버튼 찾기 시도..."
                    );
                    const frames = popupPage.frames();
                    for (let i = 0; i < frames.length; i++) {
                        const frame = frames[i];
                        for (const selector of nextButtonSelectors) {
                            try {
                                const nextButton = await frame.$(selector);
                                if (nextButton) {
                                    await nextButton.click();
                                    await logger.success(
                                        `✅ iframe 내 다음 버튼 클릭 완료 (iframe ${
                                            i + 1
                                        }, 선택자: ${selector})`
                                    );
                                    nextClicked = true;
                                    break;
                                }
                            } catch (error) {
                                continue;
                            }
                        }
                        if (nextClicked) break;
                    }
                }

                if (!nextClicked) {
                    await logger.error("⚠️ 다음 버튼을 찾을 수 없습니다.");
                }

                // 다음 버튼 클릭 후 다음 단계 로드 대기
                await popupPage.waitForTimeout(ACTION_DELAY * 2);

                // 서로이웃 추가 메시지 입력
                if (message) {
                    await logger.info("📝 서로이웃 추가 메시지 입력 중...");

                    let messageInputted = false;
                    for (const selector of messageSelectors) {
                        try {
                            await logger.info(
                                `🔍 메시지 입력 필드 찾기 시도: ${selector}`
                            );
                            await popupPage.waitForSelector(selector, {
                                timeout: 3000,
                            });
                            await logger.info(
                                `🔘 메시지 입력 필드 발견: ${selector}`
                            );

                            // page.fill 직접 사용 (더 확실함)
                            await popupPage.fill(selector, message);
                            await logger.success(
                                `✅ 서로이웃 메시지 입력 완료 (선택자: ${selector})`
                            );
                            messageInputted = true;
                            break;
                        } catch (error) {
                            await logger.info(
                                `❌ 메시지 입력 필드 찾기 실패: ${selector}`
                            );
                            continue;
                        }
                    }

                    // iframe 내부에서도 메시지 입력 필드 찾기
                    if (!messageInputted) {
                        await logger.info(
                            "🔍 iframe 내부에서 메시지 입력 필드 찾기 시도..."
                        );
                        const frames = popupPage.frames();
                        for (let i = 0; i < frames.length; i++) {
                            const frame = frames[i];
                            for (const selector of messageSelectors) {
                                try {
                                    await frame.waitForSelector(selector, {
                                        timeout: 3000,
                                    });
                                    await logger.info(
                                        `🔘 iframe ${
                                            i + 1
                                        }에서 메시지 입력 필드 발견: ${selector}`
                                    );
                                    await frame.fill(selector, message);
                                    await logger.success(
                                        `✅ iframe 내 메시지 입력 완료 (iframe ${
                                            i + 1
                                        }, 선택자: ${selector})`
                                    );
                                    messageInputted = true;
                                    break;
                                } catch (error) {
                                    continue;
                                }
                            }
                            if (messageInputted) break;
                        }
                    }

                    if (!messageInputted) {
                        await logger.error(
                            "⚠️ 메시지 입력 필드를 찾을 수 없습니다."
                        );
                    }

                    // 메시지 입력 후 잠시 대기
                    await popupPage.waitForTimeout(ACTION_DELAY);

                    // 마지막 "다음" 버튼 클릭 (프로세스 완료)
                    await logger.info(
                        "🔘 마지막 다음 버튼 찾는 중 (프로세스 완료)..."
                    );

                    let finalNextClicked = false;
                    for (const selector of finalNextButtonSelectors) {
                        try {
                            await logger.info(
                                `🔍 최종 다음 버튼 찾기 시도: ${selector}`
                            );
                            await popupPage.waitForSelector(selector, {
                                timeout: 3000,
                            });
                            await logger.info(
                                `🔘 최종 다음 버튼 발견: ${selector}`
                            );
                            await popupPage.click(selector, {
                                force: true,
                            });
                            await logger.success(
                                `✅ 최종 다음 버튼 클릭 완료! 서로이웃 추가 프로세스 종료 (선택자: ${selector})`
                            );
                            finalNextClicked = true;
                            break;
                        } catch (error) {
                            await logger.info(
                                `❌ 최종 다음 버튼 찾기 실패: ${selector}`
                            );
                            continue;
                        }
                    }

                    // iframe 내부에서도 최종 다음 버튼 찾기
                    if (!finalNextClicked) {
                        await logger.info(
                            "🔍 iframe 내부에서 최종 다음 버튼 찾기 시도..."
                        );
                        const frames = popupPage.frames();
                        for (let i = 0; i < frames.length; i++) {
                            const frame = frames[i];
                            for (const selector of finalNextButtonSelectors) {
                                try {
                                    await frame.waitForSelector(selector, {
                                        timeout: 3000,
                                    });
                                    await logger.info(
                                        `🔘 iframe ${
                                            i + 1
                                        }에서 최종 다음 버튼 발견: ${selector}`
                                    );
                                    await frame.click(selector, {
                                        force: true,
                                    });
                                    await logger.success(
                                        `✅ iframe 내 최종 다음 버튼 클릭 완료! 서로이웃 추가 프로세스 종료 (iframe ${
                                            i + 1
                                        }, 선택자: ${selector})`
                                    );
                                    finalNextClicked = true;
                                    break;
                                } catch (error) {
                                    continue;
                                }
                            }
                            if (finalNextClicked) break;
                        }
                    }

                    if (!finalNextClicked) {
                        await logger.error(
                            "⚠️ 최종 다음 버튼을 찾을 수 없습니다."
                        );
                    }

                    // 프로세스 완료 대기
                    await popupPage.waitForTimeout(ACTION_DELAY);
                } else {
                    await logger.info(
                        "ℹ️ 메시지가 없어 메시지 입력을 건너뜁니다."
                    );
                }
            }

            await logger.success("🎉 서로이웃 추가 프로세스 완료!");
        } catch (error) {
            await logger.error(
                `❌ 서로이웃 추가 실패: ${
                    error instanceof Error ? error.message : "알 수 없는 오류"
                }`
            );
            throw error;
        }

        // 사용자가 브라우저를 조작할 수 있도록 잠시 대기
        // if (autoCloseDelay > 0) {
        //     await logger.info(
        //         `브라우저가 표시되었습니다. ${autoCloseDelay}초 후 자동으로 닫힙니다...`
        //     );
        //     await page.waitForTimeout(autoCloseDelay * 1000);
        //     await logger.info("브라우저 자동 닫기 시작...");
        //     await browser.close();
        //     await logger.success("브라우저가 자동으로 닫혔습니다");
        // } else {
        //     await logger.info(
        //         "브라우저가 표시되었습니다. 10초간 조작 가능합니다..."
        //     );
        //     await page.waitForTimeout(10000);

        //     // 브라우저를 열어둘지 닫을지 결정
        //     if (!keepOpen) {
        //         await logger.info("브라우저 수동 닫기 시작...");
        //         await browser.close();
        //         await logger.success("브라우저가 닫혔습니다");
        //     } else {
        //         await logger.info("브라우저를 열어둡니다");
        //     }
        // }

        return NextResponse.json({
            success: true,
            data: {
                browserKeptOpen: keepOpen,
            },
        });
    } catch (error) {
        await logger.error(
            `크롤링 오류: ${
                error instanceof Error ? error.message : "알 수 없는 오류"
            }`
        );

        // 브라우저가 열려있다면 닫기
        if (browser) {
            try {
                await logger.info("오류로 인해 브라우저 강제 닫기 시작...");
                await browser.close();
                await logger.success("오류로 인해 브라우저를 닫았습니다");
            } catch (closeError) {
                await logger.error(`브라우저 닫기 오류: ${closeError}`);
            }
        }

        return NextResponse.json(
            {
                error: "Failed to crawl the website",
                details:
                    error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 }
        );
    }
}
