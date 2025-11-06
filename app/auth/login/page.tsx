"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
    const router = useRouter();
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const attemptLogin = async (username: string, password: string) => {
        setIsLoading(true);
        setError("");

        try {
            const response = await fetch("/api/auth/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ username, password }),
            });

            const data = await response.json();

            if (response.ok && data.success) {
                // 토큰을 로컬 스토리지에 저장
                localStorage.setItem("auth_token", data.token);
                // 홈 페이지로 리다이렉트
                router.push("/");
            } else {
                setError(data.error || "로그인에 실패했습니다.");
            }
        } catch (error) {
            console.error("Login error:", error);
            setError("로그인 처리 중 오류가 발생했습니다.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await attemptLogin(username, password);
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
                    <div className="text-center mb-8">
                        <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-2">
                            🔐 로그인
                        </h1>
                        <p className="text-gray-600 dark:text-gray-400">
                            크롤링 도구에 로그인하세요
                        </p>
                    </div>

                    {/* 로그인 폼 */}
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* 사용자 이름 입력 */}
                        <div>
                            <label
                                htmlFor="username"
                                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                            >
                                사용자 이름
                            </label>
                            <input
                                id="username"
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                required
                                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white outline-none transition-all"
                                placeholder="사용자 이름을 입력하세요"
                                disabled={isLoading}
                            />
                        </div>

                        {/* 비밀번호 입력 */}
                        <div>
                            <label
                                htmlFor="password"
                                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                            >
                                비밀번호
                            </label>
                            <input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white outline-none transition-all"
                                placeholder="비밀번호를 입력하세요"
                                disabled={isLoading}
                            />
                        </div>

                        {/* 에러 메시지 */}
                        {error && (
                            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
                                {error}
                            </div>
                        )}

                        {/* 로그인 버튼 */}
                        <Button
                            type="submit"
                            disabled={isLoading}
                            className="w-full"
                        >
                            {isLoading ? "로그인 중..." : "로그인"}
                        </Button>
                    </form>
                </div>
            </div>
        </div>
    );
}
