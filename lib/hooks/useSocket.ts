"use client";
import { useEffect, useRef, useState } from "react";
import { connectSocket } from "../../lib/socket";
import { useAppDispatch } from "../hooks";
import { addLog } from "../slices/logsSlice";

export function useSocket() {
    const dispatch = useAppDispatch();
    const unsubscribeRef = useRef<(() => void) | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [socketId, setSocketId] = useState<string | null>(null);

    useEffect(() => {
        // Socket.io 서버 초기화 (컴포넌트 마운트 시)
        const initSocketServer = async () => {
            try {
                console.log("🔌 Initializing Socket.io server...");
                const response = await fetch("/api/socket", { method: "GET" });
                console.log("✅ Socket.io server initialized:", response.ok);
            } catch (error) {
                console.error(
                    "❌ Failed to initialize Socket.io server:",
                    error
                );
            }
        };
        initSocketServer();

        const socket = connectSocket();

        // 초기 연결 상태 설정
        setIsConnected(socket.connected);
        setSocketId(socket.id || null);

        // 연결 상태 리스너
        const handleConnect = () => {
            console.log("✅ Socket connected:", socket.id);
            setIsConnected(true);
            setSocketId(socket.id || null);
        };

        const handleDisconnect = (reason: string) => {
            console.log("❌ Socket disconnected:", reason);
            setIsConnected(false);
            setSocketId(null);
        };

        const handleConnectError = (error: Error) => {
            console.error("❌ Socket connection error:", error);
            setIsConnected(false);
            setSocketId(null);
        };

        const handleReconnect = (attemptNumber: number) => {
            console.log("🔄 Socket reconnected:", socket.id);
            setIsConnected(true);
            setSocketId(socket.id || null);
        };

        // 연결 이벤트 리스너 등록
        socket.on("connect", handleConnect);
        socket.on("disconnect", handleDisconnect);
        socket.on("connect_error", handleConnectError);
        socket.on("reconnect", handleReconnect);

        // 로그 수신 리스너를 직접 등록 (연결 상태와 무관하게 항상 등록)
        const handleLog = (data: {
            message: string;
            type: string;
            timestamp: string;
        }) => {
            console.log("📨 Log received via WebSocket:", data);
            console.log("📦 Dispatching to Redux...");
            dispatch(
                addLog({
                    message: data.message,
                    type: data.type as "info" | "success" | "error",
                })
            );
            console.log("✅ Log dispatched to Redux");
        };

        // Socket.io는 연결 상태와 무관하게 리스너를 등록할 수 있음
        // 이미 연결되어 있으면 즉시 동작하고, 아니면 연결 후 자동으로 동작함
        socket.on("log", handleLog);
        console.log("✅ Log listener registered on socket");
        console.log("🔍 Current socket ID:", socket.id);
        console.log("🔍 Socket connected:", socket.connected);

        unsubscribeRef.current = () => {
            socket.off("log", handleLog);
            socket.off("connect", handleConnect);
            socket.off("disconnect", handleDisconnect);
            socket.off("connect_error", handleConnectError);
            socket.off("reconnect", handleReconnect);
        };

        return () => {
            if (unsubscribeRef.current) {
                unsubscribeRef.current();
            }
            // disconnectSocket은 여러 컴포넌트에서 사용할 수 있으므로 여기서는 하지 않음
        };
    }, [dispatch]);

    return {
        isConnected,
        socketId,
    };
}
