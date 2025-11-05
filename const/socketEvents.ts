/**
 * Socket.io 이벤트 이름 상수
 * 클라이언트와 서버 간 통신에 사용되는 이벤트 이름을 관리합니다.
 */

// 사용자 정의 이벤트
export const SOCKET_EVENTS = {
    // 클라이언트 → 서버: sessionId 전송
    JOIN_SESSION: "join-session",
    // 서버 → 클라이언트: 로그 전송
    LOG: "log",
    // 서버 → 클라이언트: 큐 작업 결과 전송
    QUEUE_RESULT: "queue-result",
} as const;

// Socket.io 기본 이벤트 (참고용)
export const SOCKET_DEFAULT_EVENTS = {
    CONNECT: "connect",
    DISCONNECT: "disconnect",
    CONNECT_ERROR: "connect_error",
    RECONNECT: "reconnect",
} as const;
