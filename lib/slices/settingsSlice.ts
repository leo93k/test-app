import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface SettingsState {
    maxConcurrent: number;
    autoCloseDelay: number;
    logRetentionDays: number;
    enableAutoRefresh: boolean;
    refreshInterval: number;
}

const initialState: SettingsState = {
    maxConcurrent: 10,
    autoCloseDelay: 0.5,
    logRetentionDays: 7,
    enableAutoRefresh: true,
    refreshInterval: 1000,
};

const settingsSlice = createSlice({
    name: "settings",
    initialState,
    reducers: {
        setMaxConcurrent: (state, action: PayloadAction<number>) => {
            state.maxConcurrent = action.payload;
        },
        setAutoCloseDelay: (state, action: PayloadAction<number>) => {
            state.autoCloseDelay = action.payload;
        },
        setLogRetentionDays: (state, action: PayloadAction<number>) => {
            state.logRetentionDays = action.payload;
        },
        setEnableAutoRefresh: (state, action: PayloadAction<boolean>) => {
            state.enableAutoRefresh = action.payload;
        },
        setRefreshInterval: (state, action: PayloadAction<number>) => {
            state.refreshInterval = action.payload;
        },
        resetSettings: () => initialState,
        loadSettings: (
            state,
            action: PayloadAction<Partial<SettingsState>>
        ) => {
            return { ...state, ...action.payload };
        },
    },
});

export const {
    setMaxConcurrent,
    setAutoCloseDelay,
    setLogRetentionDays,
    setEnableAutoRefresh,
    setRefreshInterval,
    resetSettings,
    loadSettings,
} = settingsSlice.actions;

export default settingsSlice.reducer;
