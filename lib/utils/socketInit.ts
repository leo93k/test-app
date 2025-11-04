/**
 * 소켓 초기화 유틸리티
 * 로그 관련 API 호출 전에 소켓이 없으면 생성하고, sessionId를 전송합니다.
 */

/**
 * 소켓을 초기화하고 sessionId를 등록합니다.
 * 소켓이 이미 연결되어 있으면 재사용하고, 없으면 생성합니다.
 *
 * @param sessionId - 등록할 세션 ID
 * @returns Promise<boolean> - 소켓 초기화 성공 여부
 */
export async function ensureSocketInitialized(
    sessionId: string
): Promise<boolean> {
    try {
        // Socket.io 서버 초기화 (서버가 없으면 초기화)
        try {
            await fetch("/api/socket", { method: "GET" });
        } catch (socketError) {
            console.warn("Socket.io 서버 초기화 실패, 계속 진행:", socketError);
        }

        // 소켓 클라이언트 가져오기
        // 소켓이 없으면 생성하고, 있으면 재사용
        const { connectSocket } = await import("@/lib/socket");
        const socket = connectSocket(); // 소켓이 없으면 생성, 있으면 재사용

        // 소켓이 연결되어 있으면 sessionId 전송
        if (socket.connected) {
            socket.emit("join-session", sessionId);
            console.log(`📤 Sent sessionId to server: ${sessionId}`);
            return true;
        }

        // 소켓이 연결되지 않은 경우, 연결 대기
        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                resolve(false);
            }, 5000); // 5초 타임아웃

            const onConnect = () => {
                clearTimeout(timeout);
                socket.emit("join-session", sessionId);
                console.log(`📤 Sent sessionId to server: ${sessionId}`);
                socket.off("connect", onConnect);
                socket.off("connect_error", onError);
                resolve(true);
            };

            const onError = () => {
                clearTimeout(timeout);
                socket.off("connect", onConnect);
                socket.off("connect_error", onError);
                resolve(false);
            };

            socket.once("connect", onConnect);
            socket.once("connect_error", onError);
        });
    } catch (error) {
        console.error("소켓 초기화 실패:", error);
        return false;
    }
}
