import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { MAX_LOGS } from "../../service/logger";

// LogEntry 인터페이스 및 logsSlice
export interface LogEntry {
    id: string;
    message: string;
    timestamp: string;
    type: "info" | "success" | "error";
}

interface LogsState {
    logs: LogEntry[];
}

const initialState: LogsState = {
    logs: [],
};

const logsSlice = createSlice({
    name: "logs",
    initialState,
    reducers: {
        addLog: (
            state,
            action: PayloadAction<{
                message: string;
                type?: "info" | "success" | "error";
            }>
        ) => {
            const logEntry: LogEntry = {
                id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                message: action.payload.message,
                timestamp: new Date().toISOString(),
                type: action.payload.type || "info",
            };

            state.logs.push(logEntry);

            // 최대 로그 개수만 유지 (최신이 위로)
            if (state.logs.length > MAX_LOGS) {
                state.logs = state.logs
                    .sort(
                        (a, b) =>
                            new Date(b.timestamp).getTime() -
                            new Date(a.timestamp).getTime()
                    )
                    .slice(0, MAX_LOGS);
            } else {
                // 최신 로그가 위로 오도록 정렬
                state.logs.sort(
                    (a, b) =>
                        new Date(b.timestamp).getTime() -
                        new Date(a.timestamp).getTime()
                );
            }
        },
        clearLogs: (state) => {
            state.logs = [];
        },
    },
});

export const { addLog, clearLogs } = logsSlice.actions;
export default logsSlice.reducer;
