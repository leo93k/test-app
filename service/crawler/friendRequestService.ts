import { Page } from "playwright";
import { Logger } from "@/service/logger";
import { ACTION_DELAY } from "@/const";
import {
    clickFriendRequestButton,
    getPopupPage,
    clickRadioButton,
    clickNextButton,
    fillMessage,
    clickFinalNextButton,
    checkIfAlreadyProcessing,
    clickLoginButton,
    fillAndSubmitLoginForm,
    navigateBackToBlog,
} from "./flow";

export interface FriendRequestOptions {
    username: string;
    password: string;
    message: string;
    originalUrl: string;
}

export type FriendRequestResult =
    | "success"
    | "already-friend"
    | "already-requesting"
    | "failed";

/**
 * 서로이웃 추가 서비스
 */
export class FriendRequestService {
    private page: Page;
    private logger: Logger;

    constructor(page: Page, logger: Logger) {
        this.page = page;
        this.logger = logger;
    }

    /**
     * 서로이웃 추가 프로세스 실행
     */
    async execute(options: FriendRequestOptions): Promise<FriendRequestResult> {
        const { username, password, message, originalUrl } = options;

        await this.logger.info("🤝 서로이웃 추가 프로세스를 시작합니다...");

        // 로그인 플로우 실행
        const loginButtonClicked = await clickLoginButton(
            this.page,
            this.logger
        );

        if (!loginButtonClicked) {
            throw new Error("로그인 버튼을 찾을 수 없습니다.");
        }

        try {
            // 로그인 폼 입력 및 제출
            await fillAndSubmitLoginForm(
                this.page,
                this.logger,
                username,
                password
            );

            // 원래 블로그 페이지로 돌아가기
            await navigateBackToBlog(this.page, this.logger, originalUrl);
        } catch (error) {
            await this.logger.error(
                `로그인 프로세스 오류: ${
                    error instanceof Error ? error.message : "알 수 없는 오류"
                }`
            );
            return "failed";
        }

        // 서로이웃 추가 버튼 클릭 또는 이미 이웃인지 확인
        const friendRequestResult = await clickFriendRequestButton(
            this.page,
            this.logger
        );

        if (friendRequestResult === "already-friend") {
            await this.logger.success(
                "✅ 이미 이웃 상태입니다. 서로이웃 추가 프로세스를 종료합니다."
            );
            return "already-friend"; // 이미 이웃이므로 바로 종료
        }

        if (friendRequestResult === "not-found") {
            throw new Error("서로이웃 추가 버튼을 찾을 수 없습니다.");
        }

        // 팝업 대기
        await this.logger.info(
            "⏳ 서로이웃 추가 팝업이 열릴 때까지 대기 중..."
        );
        await this.page.waitForTimeout(ACTION_DELAY);

        // 팝업 페이지 가져오기
        const popupPage = getPopupPage(this.page, this.logger);

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

            await this.logger.info(
                `📋 팝업 내용 확인: ${popupContent.substring(0, 200)}...`
            );

            // 정상적인 이웃추가 팝업인지 확인
            const isNormalPopup =
                popupContent.includes("이웃추가") ||
                popupContent.includes("서로이웃") ||
                popupContent.includes("이웃으로 추가") ||
                popupContent.includes("이웃 신청");

            // 네이버 메인 페이지나 다른 페이지로 이동한 경우 감지
            const isWrongPage =
                popupContent.includes("본문 바로가기") ||
                popupContent.includes("NAVER") ||
                popupContent.includes("한국어 English") ||
                (popupContent.length > 0 && !isNormalPopup);

            if (isWrongPage) {
                const popupUrl = popupPage.url();
                await this.logger.error(
                    `❌ 잘못된 팝업이 열렸습니다. 이웃추가 팝업이 아닙니다.`
                );
                await this.logger.error(`팝업 URL: ${popupUrl}`);
                await this.logger.error(
                    `팝업 내용 샘플: ${popupContent.substring(0, 300)}...`
                );
                throw new Error(
                    `잘못된 팝업이 열렸습니다. 이웃추가 팝업이 아닙니다. 팝업 URL: ${popupUrl}`
                );
            }

            // "이미 이웃입니다" 관련 메시지 확인
            if (
                popupContent.includes("이미 이웃입니다") ||
                popupContent.includes("이미 이웃") ||
                popupContent.includes("이미 서로이웃") ||
                popupContent.includes("이미 서로이웃입니다") ||
                popupContent.includes("이웃 상태입니다") ||
                popupContent.includes("현재 이웃입니다") ||
                popupContent.includes("현재 이웃")
            ) {
                await this.logger.info(
                    "ℹ️ 팝업에서 '이미 이웃입니다' 메시지 발견"
                );
                await this.logger.success(
                    "✅ 이미 이웃 상태입니다. 서로이웃 추가 프로세스를 종료합니다."
                );
                return "already-friend";
            }

            // 정상적인 팝업인지 최종 확인
            if (!isNormalPopup) {
                await this.logger.info(
                    "⚠️ 팝업 내용이 정상적인 이웃추가 팝업과 다를 수 있습니다. 계속 진행합니다."
                );
            }
        } catch (error) {
            // 특정 에러 메시지인 경우 재throw
            if (
                error instanceof Error &&
                error.message.includes("잘못된 팝업")
            ) {
                throw error;
            }
            // 팝업 내용 확인 실패는 무시하고 계속 진행
            await this.logger.info(
                "ℹ️ 팝업 내용 확인 중 오류 발생, 계속 진행합니다."
            );
        }

        // 라디오 버튼 클릭
        await clickRadioButton(popupPage, this.logger);

        // 팝업이 닫혔는지 확인
        try {
            await popupPage.waitForTimeout(ACTION_DELAY);
        } catch {
            // 페이지가 닫혔으면 이미 처리 중일 수 있음
            await this.logger.success(
                "✅ 이미 추가 중입니다. 서로이웃 추가 프로세스를 종료합니다. (팝업 닫힘)"
            );
            return "already-requesting";
        }

        // 에러 메시지 확인: "서로이웃 신청을 받지 않는 이웃입니다" 또는 "현재 이웃입니다" (라디오 버튼 클릭 후)
        try {
            const errorMessage = await popupPage.evaluate(() => {
                const bodyText = document.body?.textContent || "";
                return bodyText;
            });

            // "현재 이웃입니다" 메시지 확인 (이미 이웃 상태)
            if (
                errorMessage.includes("현재 이웃입니다") ||
                errorMessage.includes("현재 이웃")
            ) {
                await this.logger.info("ℹ️ '현재 이웃입니다' 메시지 발견");
                await this.logger.success(
                    "✅ 이미 이웃 상태입니다. 서로이웃 추가 프로세스를 종료합니다."
                );
                return "already-friend";
            }

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
            await this.logger.info(
                "ℹ️ 에러 메시지 확인 중 오류 발생, 계속 진행합니다."
            );
        }

        // 다음 버튼 클릭
        await clickNextButton(popupPage, this.logger);

        // 다음 버튼 클릭 후 팝업이 즉시 닫혔는지 확인 (서버 환경 대응)
        try {
            await popupPage.waitForTimeout(500); // 팝업 닫힘 감지 대기
        } catch {
            // waitForTimeout 실패 시 팝업이 닫혔을 가능성이 높음
        }

        // 팝업이 닫혔는지 즉시 확인
        let popupClosed = false;
        try {
            const context = popupPage.context();
            const pages = context.pages();
            const popupStillOpen = pages.includes(popupPage);
            if (!popupStillOpen) {
                popupClosed = true;
                await this.logger.success(
                    "✅ 이미 추가 중입니다. 서로이웃 추가 프로세스를 종료합니다. (팝업 닫힘 - 다음 버튼 클릭 후)"
                );
                return "already-requesting";
            }
        } catch {
            // 컨텍스트 접근 불가시 팝업이 닫힌 것으로 간주
            popupClosed = true;
            await this.logger.success(
                "✅ 이미 추가 중입니다. 서로이웃 추가 프로세스를 종료합니다. (팝업 닫힘 - 다음 버튼 클릭 후)"
            );
            return "already-requesting";
        }

        // 에러 메시지 확인: "서로이웃 신청을 받지 않는 이웃입니다" 또는 "현재 이웃입니다"
        try {
            const errorMessage = await popupPage.evaluate(() => {
                const bodyText = document.body?.textContent || "";
                return bodyText;
            });

            // "현재 이웃입니다" 메시지 확인 (이미 이웃 상태)
            if (
                errorMessage.includes("현재 이웃입니다") ||
                errorMessage.includes("현재 이웃")
            ) {
                await this.logger.info("ℹ️ '현재 이웃입니다' 메시지 발견");
                await this.logger.success(
                    "✅ 이미 이웃 상태입니다. 서로이웃 추가 프로세스를 종료합니다."
                );
                return "already-friend";
            }

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
            await this.logger.info(
                "ℹ️ 에러 메시지 확인 중 오류 발생, 계속 진행합니다."
            );
        }

        // 이미 추가 중인지 확인 (팝업이 아직 열려있는 경우)
        if (!popupClosed) {
            const isAlreadyProcessing = await checkIfAlreadyProcessing(
                popupPage,
                this.logger
            );
            if (isAlreadyProcessing) {
                return "already-requesting"; // 이미 추가 중이므로 종료
            }
        }

        // 정상적인 경우 메시지 입력을 위해 대기
        try {
            await popupPage.waitForTimeout(ACTION_DELAY * 2);
        } catch {
            // 페이지가 닫혔으면 이미 처리 중일 수 있음
            await this.logger.success(
                "✅ 이미 추가 중입니다. 서로이웃 추가 프로세스를 종료합니다. (팝업 닫힘)"
            );
            return "already-requesting";
        }

        // 메시지 입력
        if (message) {
            try {
                await fillMessage(popupPage, this.logger, message);

                // 페이지가 닫혔는지 확인
                try {
                    await popupPage.waitForTimeout(ACTION_DELAY);
                } catch {
                    await this.logger.success(
                        "✅ 이미 추가 중입니다. 서로이웃 추가 프로세스를 종료합니다. (팝업 닫힘)"
                    );
                    return "already-requesting";
                }

                // 최종 다음 버튼 클릭
                await clickFinalNextButton(popupPage, this.logger);

                // 페이지가 닫혔는지 확인
                try {
                    await popupPage.waitForTimeout(ACTION_DELAY);
                } catch {
                    // 이미 처리 완료된 것으로 간주
                    await this.logger.success(
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
                    await this.logger.success(
                        "✅ 이미 추가 중입니다. 서로이웃 추가 프로세스를 종료합니다. (팝업 닫힘)"
                    );
                    return "already-requesting";
                }
                throw error; // 다른 에러는 다시 던짐
            }
        } else {
            await this.logger.info(
                "ℹ️ 메시지가 없어 메시지 입력을 건너뜁니다."
            );
        }

        await this.logger.success("🎉 서로이웃 추가 프로세스 완료!");
        return "success";
    }
}

/**
 * 서로이웃 추가 서비스 인스턴스 생성
 */
export function createFriendRequestService(
    page: Page,
    logger: Logger
): FriendRequestService {
    return new FriendRequestService(page, logger);
}
