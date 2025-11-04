"use client";
import { useEffect, useRef, useState } from "react";
import { socketClient } from "../../lib/socket";
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
        // sessionId의 최신 값을 ref에 동기화
        sessionIdRef.current = sessionId;

        // 소켓 리스너 등록 함수
        const setupSocketListeners = () => {
            // 소켓이 이미 생성되어 있으면 리스너 등록
            const socket = socketClient.getSocket();

            // 소켓이 없으면 리스너 등록하지 않음 (API 호출 시 생성됨)
            if (!socket) {
                return false;
            }

            // 이미 리스너가 등록되어 있는지 확인 (중복 방지)
            // 소켓에 이미 리스너가 등록되어 있으면 재등록하지 않음
            // unsubscribeRef가 있으면 이미 등록된 것
            if (unsubscribeRef.current) {
                return true;
            }

            // 소켓이 이미 연결되어 있으면 상태 업데이트
            if (socket.connected) {
                setIsConnected(true);
                setSocketId(socket.id || null);
            }

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

            const handleReconnect = () => {
                console.log("🔄 Socket reconnected:", socket.id);
                setIsConnected(true);
                setSocketId(socket.id || null);
            };

            // 로그 수신 리스너
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

            // 이벤트 리스너 등록 (소켓이 연결되면 자동으로 작동)
            socket.on("connect", handleConnect);
            socket.on("disconnect", handleDisconnect);
            socket.on("connect_error", handleConnectError);
            socket.on("reconnect", handleReconnect);
            socket.on("log", handleLog);

            console.log("✅ Log listener registered on socket");

            unsubscribeRef.current = () => {
                socket.off("log", handleLog);
                socket.off("connect", handleConnect);
                socket.off("disconnect", handleDisconnect);
                socket.off("connect_error", handleConnectError);
                socket.off("reconnect", handleReconnect);
            };

            return true;
        };

        // 초기 리스너 등록 시도 (소켓이 이미 있을 수 있음)
        setupSocketListeners();

        // 소켓이 API 호출 후 생성될 수 있으므로 주기적으로 확인
        const interval = setInterval(() => {
            const socket = socketClient.getSocket();
            if (socket && !unsubscribeRef.current) {
                setupSocketListeners();
            }
        }, 1000);

        return () => {
            clearInterval(interval);
            if (unsubscribeRef.current) {
                unsubscribeRef.current();
                unsubscribeRef.current = null;
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
