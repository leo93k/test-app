import { Page, Dialog } from "playwright";
import { Logger } from "@/service/logger";
import {
    friendRequestSelectors,
    radioSelectors,
    nextButtonSelectors,
    messageSelectors,
    finalNextButtonSelectors,
} from "@/const/selectors";

const ACTION_DELAY = 300;

/**
 * 서로이웃 추가 버튼 찾기 및 클릭
 * 이미 이웃인 경우 바로 종료
 */
export async function clickFriendRequestButton(
    page: Page,
    logger: Logger
): Promise<"already-friend" | "clicked" | "not-found"> {
    await logger.info("🔍 서로이웃 추가 버튼을 찾는 중...");

    // 먼저 메인 페이지에서 찾기
    const frames = page.frames();
    for (let i = 0; i < frames.length; i++) {
        const frame = frames[i];
        for (const selector of friendRequestSelectors) {
            try {
                const element = await frame.$(selector);
                if (element) {
                    // 버튼의 텍스트 확인
                    const text = await frame.evaluate((el) => {
                        return el.textContent || "";
                    }, element);

                    // "이웃"만 있고 "이웃추가"가 없으면 이미 이웃인 상태
                    if (text.includes("이웃") && !text.includes("이웃추가")) {
                        await logger.info(
                            `ℹ️ 이미 이웃 상태입니다: "${text}" (버튼 텍스트 확인)`
                        );
                        return "already-friend";
                    }

                    // "이웃추가" 버튼인 경우 클릭
                    if (
                        text.includes("이웃추가") ||
                        text.includes("서로이웃")
                    ) {
                        await logger.info(
                            `🔘 iframe ${
                                i + 1
                            }에서 서로이웃 버튼 발견: ${selector} (텍스트: "${text}")`
                        );
                        await element.click();
                        await logger.success("✅ 서로이웃 버튼 클릭 완료");
                        return "clicked";
                    }
                }
            } catch {
                continue;
            }
        }
    }

    // 메인 페이지에서 찾기
    for (const selector of friendRequestSelectors) {
        try {
            const element = await page.$(selector);
            if (element) {
                // 버튼의 텍스트 확인
                const text = await page.evaluate((el) => {
                    return el.textContent || "";
                }, element);

                // "이웃"만 있고 "이웃추가"가 없으면 이미 이웃인 상태
                if (text.includes("이웃") && !text.includes("이웃추가")) {
                    await logger.info(
                        `ℹ️ 이미 이웃 상태입니다: "${text}" (버튼 텍스트 확인)`
                    );
                    return "already-friend";
                }

                // "이웃추가" 버튼인 경우 클릭
                if (text.includes("이웃추가") || text.includes("서로이웃")) {
                    await logger.info(
                        `🔘 메인 페이지에서 서로이웃 버튼 발견: ${selector} (텍스트: "${text}")`
                    );
                    await element.click();
                    await logger.success("✅ 서로이웃 버튼 클릭 완료");
                    return "clicked";
                }
            }
        } catch {
            continue;
        }
    }

    await logger.error("⚠️ 서로이웃 추가 버튼을 찾을 수 없습니다.");
    return "not-found";
}

/**
 * 팝업 페이지 가져오기
 */
export function getPopupPage(page: Page, logger: Logger): Page {
    const context = page.context();
    const pages = context.pages();
    if (pages.length > 1) {
        logger.info("🪟 새 팝업 창이 열렸습니다.");
        return pages[pages.length - 1];
    } else {
        logger.info("📦 모달 팝업으로 처리합니다.");
        return page;
    }
}

/**
 * 라디오 버튼 클릭
 */
export async function clickRadioButton(
    popupPage: Page,
    logger: Logger
): Promise<boolean> {
    await logger.info("🔘 서로이웃 관계 라디오 버튼 찾는 중...");

    let radioClicked = false;

    // 메인 팝업 페이지에서 찾기
    for (const selector of radioSelectors) {
        try {
            await logger.info(`🔍 라디오 버튼 찾기 시도: ${selector}`);
            await popupPage.waitForSelector(selector, { timeout: 3000 });
            await logger.info(`🔘 라디오 버튼 발견: ${selector}`);

            // 비활성화 확인
            const isDisabled = await popupPage.evaluate((sel) => {
                const element = document.querySelector(sel);
                return element && element.hasAttribute("disabled");
            }, selector);

            if (isDisabled) {
                await logger.info(
                    "ℹ️ 라디오 버튼이 비활성화되어 있습니다. 다음 버튼으로 진행합니다."
                );
                radioClicked = true;
                break;
            }

            await popupPage.click(selector, { force: true });
            await logger.success("✅ 라디오 버튼 클릭 완료");
            radioClicked = true;
            break;
        } catch {
            continue;
        }
    }

    // iframe에서 찾기
    if (!radioClicked) {
        const frames = popupPage.frames();
        for (let i = 0; i < frames.length; i++) {
            const frame = frames[i];
            for (const selector of radioSelectors) {
                try {
                    await frame.waitForSelector(selector, { timeout: 3000 });
                    await logger.info(
                        `🔘 iframe ${i + 1}에서 라디오 버튼 발견: ${selector}`
                    );

                    const isDisabled = await frame.evaluate((sel) => {
                        const element = document.querySelector(sel);
                        return element && element.hasAttribute("disabled");
                    }, selector);

                    if (isDisabled) {
                        await logger.info(
                            "ℹ️ iframe 내 라디오 버튼이 비활성화되어 있습니다. 다음 버튼으로 진행합니다."
                        );
                        radioClicked = true;
                        break;
                    }

                    await frame.click(selector, { force: true });
                    await logger.success("✅ iframe 내 라디오 버튼 클릭 완료");
                    radioClicked = true;
                    break;
                } catch {
                    continue;
                }
            }
            if (radioClicked) break;
        }
    }

    if (!radioClicked) {
        await logger.error("⚠️ 라디오 버튼을 찾을 수 없습니다.");
    }

    return radioClicked;
}

/**
 * 다음 버튼 클릭
 */
export async function clickNextButton(
    popupPage: Page,
    logger: Logger,
    buttonName: string = "다음"
): Promise<boolean> {
    await logger.info(`🔘 ${buttonName} 버튼 찾는 중...`);

    let clicked = false;

    // 메인 페이지에서 찾기
    for (const selector of nextButtonSelectors) {
        try {
            const nextButton = await popupPage.$(selector);
            if (nextButton) {
                await nextButton.click();
                await logger.success(
                    `✅ ${buttonName} 버튼 클릭 완료 (선택자: ${selector})`
                );
                clicked = true;
                break;
            }
        } catch {
            continue;
        }
    }

    // iframe에서 찾기
    if (!clicked) {
        const frames = popupPage.frames();
        for (let i = 0; i < frames.length; i++) {
            const frame = frames[i];
            for (const selector of nextButtonSelectors) {
                try {
                    const nextButton = await frame.$(selector);
                    if (nextButton) {
                        await nextButton.click();
                        await logger.success(
                            `✅ iframe 내 ${buttonName} 버튼 클릭 완료 (iframe ${
                                i + 1
                            }, 선택자: ${selector})`
                        );
                        clicked = true;
                        break;
                    }
                } catch {
                    continue;
                }
            }
            if (clicked) break;
        }
    }

    if (!clicked) {
        await logger.error(`⚠️ ${buttonName} 버튼을 찾을 수 없습니다.`);
    }

    return clicked;
}

/**
 * 메시지 입력
 */
export async function fillMessage(
    popupPage: Page,
    logger: Logger,
    message: string
): Promise<boolean> {
    await logger.info("📝 서로이웃 추가 메시지 입력 중...");

    let messageInputted = false;

    // 메인 페이지에서 찾기
    for (const selector of messageSelectors) {
        try {
            await logger.info(`🔍 메시지 입력 필드 찾기 시도: ${selector}`);
            await popupPage.waitForSelector(selector, { timeout: 3000 });
            await logger.info(`🔘 메시지 입력 필드 발견: ${selector}`);
            await popupPage.fill(selector, message);
            await logger.success(
                `✅ 서로이웃 메시지 입력 완료 (선택자: ${selector})`
            );
            messageInputted = true;
            break;
        } catch {
            continue;
        }
    }

    // iframe에서 찾기
    if (!messageInputted) {
        const frames = popupPage.frames();
        for (let i = 0; i < frames.length; i++) {
            const frame = frames[i];
            for (const selector of messageSelectors) {
                try {
                    await frame.waitForSelector(selector, { timeout: 3000 });
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
                } catch {
                    continue;
                }
            }
            if (messageInputted) break;
        }
    }

    if (!messageInputted) {
        await logger.error("⚠️ 메시지 입력 필드를 찾을 수 없습니다.");
    }

    return messageInputted;
}

/**
 * 이미 추가 중인지 확인 (alert 및 팝업 닫힘 체크)
 */
export async function checkIfAlreadyProcessing(
    popupPage: Page,
    logger: Logger
): Promise<boolean> {
    let isAlreadyProcessing = false;
    let dialogHandler: ((dialog: Dialog) => Promise<void>) | null = null;

    try {
        // 먼저 팝업이 닫혔는지 확인
        try {
            const context = popupPage.context();
            const pages = context.pages();
            const popupStillOpen = pages.includes(popupPage);
            if (!popupStillOpen) {
                isAlreadyProcessing = true;
                await logger.success(
                    "✅ 이미 추가 중입니다. 서로이웃 추가 프로세스를 종료합니다. (팝업 닫힘)"
                );
                return true;
            }
        } catch {
            // 컨텍스트 접근 불가시 이미 닫힌 것으로 간주
            isAlreadyProcessing = true;
            await logger.success(
                "✅ 이미 추가 중입니다. 서로이웃 추가 프로세스를 종료합니다. (팝업 닫힘)"
            );
            return true;
        }

        // alert가 나타나는지 확인 (dialog 이벤트 감지)
        dialogHandler = async (dialog: Dialog) => {
            const dialogMessage = dialog.message();
            await logger.info(`⚠️ Alert 감지: ${dialogMessage}`);

            // "이미 추가중" 또는 유사한 메시지 확인
            if (
                dialogMessage.includes("이미") ||
                dialogMessage.includes("추가중") ||
                dialogMessage.includes("진행중") ||
                dialogMessage.includes("처리중")
            ) {
                isAlreadyProcessing = true;
                await dialog.accept(); // alert 확인 버튼 클릭
                await logger.success(
                    `✅ 이미 추가 중입니다. 서로이웃 추가 프로세스를 종료합니다. (Alert: ${dialogMessage})`
                );
            } else {
                await dialog.accept(); // 다른 alert도 확인 버튼 클릭
            }
        };

        // dialog 이벤트 리스너 등록
        popupPage.on("dialog", dialogHandler);

        // 팝업이 닫히는지 확인
        popupPage.on("close", async () => {
            if (!isAlreadyProcessing) {
                isAlreadyProcessing = true;
                await logger.success(
                    "✅ 이미 추가 중입니다. 서로이웃 추가 프로세스를 종료합니다. (팝업 닫힘)"
                );
            }
        });

        // 짧은 대기 (alert나 팝업 닫힘 감지용) - 페이지가 닫혔을 수 있으므로 에러 처리
        try {
            await popupPage.waitForTimeout(1000);
        } catch (waitError) {
            // 페이지가 닫혔으면 이미 처리 중일 가능성이 높음
            if (!isAlreadyProcessing) {
                const errorMessage =
                    waitError instanceof Error
                        ? waitError.message
                        : String(waitError);
                // "Target page, context or browser has been closed" 에러인 경우
                if (
                    errorMessage.includes("Target page") ||
                    errorMessage.includes("closed")
                ) {
                    isAlreadyProcessing = true;
                    await logger.success(
                        "✅ 이미 추가 중입니다. 서로이웃 추가 프로세스를 종료합니다. (팝업 닫힘)"
                    );
                } else {
                    // 다른 에러는 무시하고 계속 진행
                    try {
                        const context = popupPage.context();
                        const pages = context.pages();
                        const popupStillOpen = pages.includes(popupPage);
                        if (!popupStillOpen) {
                            isAlreadyProcessing = true;
                            await logger.success(
                                "✅ 이미 추가 중입니다. 서로이웃 추가 프로세스를 종료합니다. (팝업 닫힘)"
                            );
                        }
                    } catch {
                        // 컨텍스트 접근 불가시에도 이미 닫힌 것으로 간주
                        isAlreadyProcessing = true;
                        await logger.success(
                            "✅ 이미 추가 중입니다. 서로이웃 추가 프로세스를 종료합니다. (팝업 닫힘)"
                        );
                    }
                }
            }
        }

        // 팝업이 여전히 열려있는지 확인
        const context = popupPage.context();
        const pages = context.pages();
        const popupStillOpen = pages.includes(popupPage);

        // 페이지 내용 확인 (팝업이 남아있는 경우)
        if (popupStillOpen && !isAlreadyProcessing) {
            try {
                const pageText = await popupPage.textContent("body");
                if (
                    pageText &&
                    (pageText.includes("이미") ||
                        pageText.includes("추가중") ||
                        pageText.includes("진행중") ||
                        pageText.includes("처리중"))
                ) {
                    isAlreadyProcessing = true;
                    await logger.success(
                        "✅ 이미 추가 중입니다. 서로이웃 추가 프로세스를 종료합니다."
                    );
                }
            } catch {
                // 페이지 접근 불가 (닫혔을 수 있음)
                if (!popupStillOpen) {
                    isAlreadyProcessing = true;
                    await logger.success(
                        "✅ 이미 추가 중입니다. 서로이웃 추가 프로세스를 종료합니다. (팝업 닫힘)"
                    );
                }
            }
        } else if (!popupStillOpen && !isAlreadyProcessing) {
            isAlreadyProcessing = true;
            await logger.success(
                "✅ 이미 추가 중입니다. 서로이웃 추가 프로세스를 종료합니다. (팝업 닫힘)"
            );
        }

        // 이벤트 리스너 제거
        if (dialogHandler) {
            popupPage.off("dialog", dialogHandler);
        }
    } catch {
        // alert나 팝업 닫힘 감지 실패는 무시하고 계속 진행
        // 페이지가 닫힌 경우 이미 처리 중일 수 있음
        try {
            const context = popupPage.context();
            const pages = context.pages();
            const popupStillOpen = pages.includes(popupPage);
            if (!popupStillOpen && !isAlreadyProcessing) {
                isAlreadyProcessing = true;
                await logger.success(
                    "✅ 이미 추가 중입니다. 서로이웃 추가 프로세스를 종료합니다. (팝업 닫힘)"
                );
            } else {
                await logger.info(
                    "ℹ️ Alert 및 팝업 상태 확인 완료. 계속 진행합니다."
                );
            }
        } catch {
            // 컨텍스트 접근 불가시에도 정상 종료로 처리
            if (!isAlreadyProcessing) {
                await logger.info(
                    "ℹ️ Alert 및 팝업 상태 확인 완료. 계속 진행합니다."
                );
            }
        }

        // 이벤트 리스너 정리
        if (dialogHandler) {
            try {
                popupPage.off("dialog", dialogHandler);
            } catch {
                // 이미 정리되었을 수 있음
            }
        }
    }

    return isAlreadyProcessing;
}

/**
 * 최종 다음 버튼 클릭
 */
export async function clickFinalNextButton(
    popupPage: Page,
    logger: Logger
): Promise<boolean> {
    await logger.info("🔘 마지막 다음 버튼 찾는 중 (프로세스 완료)...");

    let finalNextClicked = false;

    // 메인 페이지에서 찾기
    for (const selector of finalNextButtonSelectors) {
        try {
            await logger.info(`🔍 최종 다음 버튼 찾기 시도: ${selector}`);
            await popupPage.waitForSelector(selector, { timeout: 3000 });
            await logger.info(`🔘 최종 다음 버튼 발견: ${selector}`);
            await popupPage.click(selector, { force: true });
            await logger.success(
                `✅ 최종 다음 버튼 클릭 완료! 서로이웃 추가 프로세스 종료 (선택자: ${selector})`
            );
            finalNextClicked = true;
            break;
        } catch {
            continue;
        }
    }

    // iframe에서 찾기
    if (!finalNextClicked) {
        const frames = popupPage.frames();
        for (let i = 0; i < frames.length; i++) {
            const frame = frames[i];
            for (const selector of finalNextButtonSelectors) {
                try {
                    await frame.waitForSelector(selector, { timeout: 3000 });
                    await logger.info(
                        `🔘 iframe ${
                            i + 1
                        }에서 최종 다음 버튼 발견: ${selector}`
                    );
                    await frame.click(selector, { force: true });
                    await logger.success(
                        `✅ iframe 내 최종 다음 버튼 클릭 완료! 서로이웃 추가 프로세스 종료 (iframe ${
                            i + 1
                        }, 선택자: ${selector})`
                    );
                    finalNextClicked = true;
                    break;
                } catch {
                    continue;
                }
            }
            if (finalNextClicked) break;
        }
    }

    if (!finalNextClicked) {
        await logger.error("⚠️ 최종 다음 버튼을 찾을 수 없습니다.");
    }

    return finalNextClicked;
}

/**
 * 서로이웃 추가 전체 프로세스 실행
 */
export async function executeFriendRequestProcess(
    page: Page,
    logger: Logger,
    username: string,
    password: string,
    message: string,
    originalUrl: string
): Promise<"success" | "already-friend" | "already-requesting" | "failed"> {
    await logger.info("🤝 서로이웃 추가 프로세스를 시작합니다...");

    // 로그인 플로우 import 및 실행
    const loginFlow = await import("./loginFlow");
    const loginButtonClicked = await loginFlow.clickLoginButton(page, logger);

    if (!loginButtonClicked) {
        throw new Error("로그인 버튼을 찾을 수 없습니다.");
    }

    try {
        // 로그인 폼 입력 및 제출
        await loginFlow.fillAndSubmitLoginForm(
            page,
            logger,
            username,
            password
        );

        // 원래 블로그 페이지로 돌아가기
        await loginFlow.navigateBackToBlog(page, logger, originalUrl);
    } catch (error) {
        await logger.error(
            `로그인 프로세스 오류: ${
                error instanceof Error ? error.message : "알 수 없는 오류"
            }`
        );
        return "failed";
    }

    // 서로이웃 추가 버튼 클릭 또는 이미 이웃인지 확인
    const friendRequestResult = await clickFriendRequestButton(page, logger);

    if (friendRequestResult === "already-friend") {
        await logger.success(
            "✅ 이미 이웃 상태입니다. 서로이웃 추가 프로세스를 종료합니다."
        );
        return "already-friend"; // 이미 이웃이므로 바로 종료
    }

    if (friendRequestResult === "not-found") {
        throw new Error("서로이웃 추가 버튼을 찾을 수 없습니다.");
    }

    // 팝업 대기
    await logger.info("⏳ 서로이웃 추가 팝업이 열릴 때까지 대기 중...");
    await page.waitForTimeout(ACTION_DELAY);

    // 팝업 페이지 가져오기
    const popupPage = getPopupPage(page, logger);

    // 팝업 내용 확인: "이미 이웃입니다" 메시지 체크
    try {
        await popupPage.waitForTimeout(500); // 팝업 내용 로드 대기
        const popupContent = await popupPage.evaluate(() => {
            const bodyText = document.body?.textContent || "";
            const alertText =
                document.querySelector(".alert")?.textContent || "";
            const alertMessageText =
                document.querySelector(".alert-message")?.textContent || "";
            return bodyText + " " + alertText + " " + alertMessageText;
        });

        await logger.info(
            `📋 팝업 내용 확인: ${popupContent.substring(0, 200)}...`
        );

        // "이미 이웃입니다" 관련 메시지 확인
        if (
            popupContent.includes("이미 이웃입니다") ||
            popupContent.includes("이미 이웃") ||
            popupContent.includes("이미 서로이웃") ||
            popupContent.includes("이미 서로이웃입니다") ||
            popupContent.includes("이웃 상태입니다")
        ) {
            await logger.info("ℹ️ 팝업에서 '이미 이웃입니다' 메시지 발견");
            await logger.success(
                "✅ 이미 이웃 상태입니다. 서로이웃 추가 프로세스를 종료합니다."
            );
            return "already-friend";
        }
    } catch {
        // 팝업 내용 확인 실패는 무시하고 계속 진행
        await logger.info("ℹ️ 팝업 내용 확인 중 오류 발생, 계속 진행합니다.");
    }

    // 라디오 버튼 클릭
    await clickRadioButton(popupPage, logger);

    // 팝업이 닫혔는지 확인
    try {
        await popupPage.waitForTimeout(ACTION_DELAY);
    } catch {
        // 페이지가 닫혔으면 이미 처리 중일 수 있음
        await logger.success(
            "✅ 이미 추가 중입니다. 서로이웃 추가 프로세스를 종료합니다. (팝업 닫힘)"
        );
        return "already-requesting";
    }

    // 에러 메시지 확인: "서로이웃 신청을 받지 않는 이웃입니다" (라디오 버튼 클릭 후)
    try {
        const errorMessage = await popupPage.evaluate(() => {
            const bodyText = document.body?.textContent || "";
            return bodyText;
        });

        if (
            errorMessage.includes("서로이웃 신청을 받지 않는") ||
            errorMessage.includes("서로이웃 신청을 받지 않는 이웃입니다") ||
            errorMessage.includes("신청을 받지 않는 이웃")
        ) {
            const errorMsg = "서로이웃 신청을 받지 않는 이웃입니다.";
            throw new Error(errorMsg);
        }
    } catch (error) {
        // 특정 에러 메시지인 경우 재throw
        if (
            error instanceof Error &&
            error.message.includes("서로이웃 신청을 받지 않는")
        ) {
            throw error;
        }
        // 에러 메시지 확인 실패는 무시하고 계속 진행
        await logger.info("ℹ️ 에러 메시지 확인 중 오류 발생, 계속 진행합니다.");
    }

    // 다음 버튼 클릭
    await clickNextButton(popupPage, logger);

    // 에러 메시지 확인: "서로이웃 신청을 받지 않는 이웃입니다"
    try {
        const errorMessage = await popupPage.evaluate(() => {
            const bodyText = document.body?.textContent || "";
            return bodyText;
        });

        if (
            errorMessage.includes("서로이웃 신청을 받지 않는") ||
            errorMessage.includes("서로이웃 신청을 받지 않는 이웃입니다") ||
            errorMessage.includes("신청을 받지 않는 이웃")
        ) {
            const errorMsg = "서로이웃 신청을 받지 않는 이웃입니다.";
            throw new Error(errorMsg);
        }
    } catch (error) {
        // 특정 에러 메시지인 경우 재throw
        if (
            error instanceof Error &&
            error.message.includes("서로이웃 신청을 받지 않는")
        ) {
            throw error;
        }
        // 에러 메시지 확인 실패는 무시하고 계속 진행
        await logger.info("ℹ️ 에러 메시지 확인 중 오류 발생, 계속 진행합니다.");
    }

    // 이미 추가 중인지 확인
    const isAlreadyProcessing = await checkIfAlreadyProcessing(
        popupPage,
        logger
    );
    if (isAlreadyProcessing) {
        return "already-requesting"; // 이미 추가 중이므로 종료
    }

    // 정상적인 경우 메시지 입력을 위해 대기
    try {
        await popupPage.waitForTimeout(ACTION_DELAY * 2);
    } catch {
        // 페이지가 닫혔으면 이미 처리 중일 수 있음
        await logger.success(
            "✅ 이미 추가 중입니다. 서로이웃 추가 프로세스를 종료합니다. (팝업 닫힘)"
        );
        return "already-requesting";
    }

    // 메시지 입력
    if (message) {
        try {
            await fillMessage(popupPage, logger, message);

            // 페이지가 닫혔는지 확인
            try {
                await popupPage.waitForTimeout(ACTION_DELAY);
            } catch {
                await logger.success(
                    "✅ 이미 추가 중입니다. 서로이웃 추가 프로세스를 종료합니다. (팝업 닫힘)"
                );
                return "already-requesting";
            }

            // 최종 다음 버튼 클릭
            await clickFinalNextButton(popupPage, logger);

            // 페이지가 닫혔는지 확인
            try {
                await popupPage.waitForTimeout(ACTION_DELAY);
            } catch {
                // 이미 처리 완료된 것으로 간주
                await logger.success(
                    "✅ 서로이웃 추가 프로세스 완료! (팝업 닫힘)"
                );
                return "success";
            }
        } catch (error) {
            // 메시지 입력 중 에러 발생 (이미 처리된 것으로 간주)
            const errorMessage =
                error instanceof Error ? error.message : String(error);
            if (
                errorMessage.includes("Target page") ||
                errorMessage.includes("closed")
            ) {
                await logger.success(
                    "✅ 이미 추가 중입니다. 서로이웃 추가 프로세스를 종료합니다. (팝업 닫힘)"
                );
                return "already-requesting";
            }
            throw error; // 다른 에러는 다시 던짐
        }
    } else {
        await logger.info("ℹ️ 메시지가 없어 메시지 입력을 건너뜁니다.");
    }

    await logger.success("🎉 서로이웃 추가 프로세스 완료!");
    return "success";
}
