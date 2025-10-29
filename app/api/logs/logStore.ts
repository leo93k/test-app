// 로그 저장소 (실제 프로덕션에서는 Redis나 데이터베이스 사용)
const logs: Array<{
    id: string;
    message: string;
    timestamp: string;
    type: "info" | "success" | "error";
}> = [];

export function addLog(
    message: string,
    type: "info" | "success" | "error" = "info"
) {
    const logEntry = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        message,
        timestamp: new Date().toISOString(),
        type,
    };

    logs.push(logEntry);

    // 최대 100개 로그만 유지
    if (logs.length > 100) {
        logs.splice(0, logs.length - 100);
    }
}

export function getLogs(lastId: string = "0") {
    // lastId가 숫자 형식이면 기존 방식으로 처리
    if (/^\d+$/.test(lastId)) {
        const newLogs = logs.filter((log) => {
            const logTimestamp = log.id.split("-")[0];
            return parseInt(logTimestamp) > parseInt(lastId);
        });
        return {
            logs: newLogs,
            lastId: logs.length > 0 ? logs[logs.length - 1].id : lastId,
        };
    }

    // 새로운 ID 형식에서는 문자열 비교
    const lastIndex = logs.findIndex((log) => log.id === lastId);
    const newLogs = lastIndex >= 0 ? logs.slice(lastIndex + 1) : logs;

    return {
        logs: newLogs,
        lastId: logs.length > 0 ? logs[logs.length - 1].id : lastId,
    };
}

export function getAllLogs() {
    return logs;
}

export function clearLogs() {
    logs.length = 0;
}
