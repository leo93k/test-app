"use client";
import { useEffect, useRef, useState } from "react";
import { connectSocket } from "../../lib/socket";
import { useAppDispatch } from "../hooks";
import { addLog } from "../../lib/store/logsSlice";

export function useSocket() {
    const dispatch = useAppDispatch();
    const unsubscribeRef = useRef<(() => void) | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [socketId, setSocketId] = useState<string | null>(null);
    // sessionId를 useState로 관리하여 초기 렌더링 시에도 사용 가능하도록 함
    const [sessionId, setSessionId] = useState<string>(() => {
        // 초기 렌더링 시 즉시 sessionId 생성
        if (typeof window !== "undefined") {
            return `client-${Date.now()}-${Math.random()
                .toString(36)
                .substr(2, 9)}`;
        }
        return "";
    });
    // sessionId의 최신 값을 참조하기 위한 ref
    const sessionIdRef = useRef<string>(sessionId);

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

        // sessionId가 없으면 생성 (이미 초기값으로 설정되어 있지만 안전장치)
        if (!sessionId) {
            const newSessionId = `client-${Date.now()}-${Math.random()
                .toString(36)
                .substr(2, 9)}`;
            setSessionId(newSessionId);
            sessionIdRef.current = newSessionId;
        } else {
            // sessionId의 최신 값을 ref에 동기화
            sessionIdRef.current = sessionId;
        }

        // 소켓 연결 시 서버에 sessionId 전송하는 함수
        // sessionId를 최신 값으로 참조하기 위해 ref 사용
        const sendSessionId = () => {
            const currentSessionId = sessionIdRef.current || sessionId;
            if (socket.connected && currentSessionId) {
                socket.emit("join-session", currentSessionId);
                console.log(`📤 Sent sessionId to server: ${currentSessionId}`);
            }
        };

        // 연결 시 즉시 전송
        if (socket.connected && sessionId) {
            sendSessionId();
        }

        // 재연결 시에도 전송
        socket.on("connect", sendSessionId);

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
            socket.off("connect", sendSessionId);
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
    }, [dispatch, sessionId]);

    // sessionId가 변경될 때마다 ref 업데이트
    useEffect(() => {
        if (sessionId) {
            sessionIdRef.current = sessionId;
        }
    }, [sessionId]);

    return {
        isConnected,
        socketId,
        sessionId,
    };
}
