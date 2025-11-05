import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface SettingsState {
    maxConcurrent: number;
    autoCloseDelay: number;
    logRetentionDays: number;
    enableAutoRefresh: boolean;
    refreshInterval: number;
    maxBlogSearchPages: number;
}

const initialState: SettingsState = {
    maxConcurrent: 5,
    autoCloseDelay: 0.5,
    logRetentionDays: 7,
    enableAutoRefresh: true,
    refreshInterval: 1000,
    maxBlogSearchPages: 3,
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
        setMaxBlogSearchPages: (state, action: PayloadAction<number>) => {
            state.maxBlogSearchPages = action.payload;
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
    setMaxBlogSearchPages,
    resetSettings,
    loadSettings,
} = settingsSlice.actions;

export default settingsSlice.reducer;
