import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { MAX_CONCURRENT } from "@/const/queue";

interface SettingsState {
    maxConcurrent: number;
    autoCloseDelay: number;
    maxBlogSearchPages: number;
}

const initialState: SettingsState = {
    maxConcurrent: MAX_CONCURRENT,
    autoCloseDelay: 0.5,
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
    setMaxBlogSearchPages,
    resetSettings,
    loadSettings,
} = settingsSlice.actions;

export default settingsSlice.reducer;
