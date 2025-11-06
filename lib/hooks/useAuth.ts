"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface User {
    userId: string;
    username: string;
    name: string;
}

/**
 * 인증 관련 hook
 * 사용자 정보 조회 및 로그아웃 기능 제공
 */
export function useAuth() {
    const router = useRouter();
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // 로컬 스토리지에서 토큰 확인
        const token = localStorage.getItem("auth_token");

        if (!token) {
            setIsLoading(false);
            return;
        }

        // 토큰 검증 및 사용자 정보 가져오기
        fetch("/api/auth/verify", {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`,
            },
        })
            .then((res) => res.json())
            .then((data) => {
                if (data.authenticated && data.user) {
                    setUser(data.user);
                } else {
                    // 인증 실패 시 토큰 제거
                    localStorage.removeItem("auth_token");
                    setUser(null);
                }
            })
            .catch((error) => {
                console.error("Auth verification error:", error);
                localStorage.removeItem("auth_token");
                setUser(null);
            })
            .finally(() => {
                setIsLoading(false);
            });
    }, []);

    const logout = async () => {
        const token = localStorage.getItem("auth_token");

        // 서버에 로그아웃 요청
        if (token) {
            try {
                await fetch("/api/auth/logout", {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                });
            } catch (error) {
                console.error("Logout API error:", error);
            }
        }

        // 토큰 제거
        localStorage.removeItem("auth_token");
        setUser(null);
        // 로그인 페이지로 리다이렉트
        router.push("/auth/login");
    };

    return {
        user,
        isLoading,
        logout,
    };
}
