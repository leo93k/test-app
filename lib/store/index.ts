import { configureStore } from "@reduxjs/toolkit";
import settingsReducer from "./settingsSlice";
import logsReducer from "./logsSlice";

export const store = configureStore({
    reducer: {
        settings: settingsReducer,
        logs: logsReducer,
    },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
