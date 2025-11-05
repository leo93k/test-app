// ==================== 모니터링 관련 상수 ====================
// 큐 상태 새로고침 간격 (밀리초)
export const REFRESH_INTERVAL = 1000; // 1초

// 큐 포화도 임계값
export const QUEUE_WARNING_THRESHOLD = 10; // 경고
export const QUEUE_CRITICAL_THRESHOLD = 20; // 위험

// 시스템 부하 임계값 (%)
export const SYSTEM_LOAD_WARNING_THRESHOLD = 50; // 경고
export const SYSTEM_LOAD_CRITICAL_THRESHOLD = 80; // 위험

// 큐 길이 표시 기준 (프로그레스 바용)
export const QUEUE_PROGRESS_MAX = 50;
