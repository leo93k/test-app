import { configureStore } from "@reduxjs/toolkit";
import settingsReducer from "./slices/settingsSlice";
import logsReducer from "./slices/logsSlice";

export const store = configureStore({
    reducer: {
        settings: settingsReducer,
        logs: logsReducer,
    },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
