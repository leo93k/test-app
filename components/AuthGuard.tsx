"use client";

import { useAuthGuard } from "@/lib/hooks/useAuthGuard";
import { usePathname } from "next/navigation";

/**
 * 인증 guard 컴포넌트
 * 인증되지 않은 사용자를 로그인 페이지로 리다이렉트
 */
export default function AuthGuard({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const { isAuthenticated, isLoading } = useAuthGuard();
    const isLoginPage = pathname === "/auth/login";

    // 로그인 페이지는 guard 적용 안 함
    if (isLoginPage) {
        return <>{children}</>;
    }

    // 로딩 중이거나 인증되지 않은 경우 아무것도 렌더링하지 않음
    // (useAuthGuard에서 리다이렉트 처리)
    if (isLoading || !isAuthenticated) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600 dark:text-gray-400">
                        인증 확인 중...
                    </p>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}
