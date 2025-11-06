"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

interface AuthState {
    isAuthenticated: boolean;
    isLoading: boolean;
    user: {
        userId: string;
        username: string;
        name: string;
    } | null;
}

/**
 * 인증 guard hook
 * 인증되지 않은 사용자를 로그인 페이지로 리다이렉트
 */
export function useAuthGuard() {
    const router = useRouter();
    const pathname = usePathname();
    const [authState, setAuthState] = useState<AuthState>({
        isAuthenticated: false,
        isLoading: true,
        user: null,
    });

    useEffect(() => {
        // 로그인 페이지는 guard 적용 안 함
        if (pathname === "/auth/login") {
            setAuthState({
                isAuthenticated: false,
                isLoading: false,
                user: null,
            });
            return;
        }

        // 로컬 스토리지에서 토큰 확인
        const token = localStorage.getItem("auth_token");

        if (!token) {
            // 토큰이 없으면 로그인 페이지로 리다이렉트
            router.push("/auth/login");
            return;
        }

        // 토큰 검증
        fetch("/api/auth/verify", {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`,
            },
        })
            .then((res) => res.json())
            .then((data) => {
                if (data.authenticated && data.user) {
                    setAuthState({
                        isAuthenticated: true,
                        isLoading: false,
                        user: data.user,
                    });
                } else {
                    // 인증 실패 시 토큰 제거하고 로그인 페이지로 리다이렉트
                    localStorage.removeItem("auth_token");
                    router.push("/auth/login");
                }
            })
            .catch((error) => {
                console.error("Auth verification error:", error);
                localStorage.removeItem("auth_token");
                router.push("/auth/login");
            });
    }, [pathname, router]);

    return authState;
}
