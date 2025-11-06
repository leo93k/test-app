"use client";

import { usePathname } from "next/navigation";
import Navigation from "@/components/Navigation";

/**
 * 조건부 레이아웃 컴포넌트
 * 로그인 페이지에서는 Navigation을 보여주지 않음
 */
export default function ConditionalLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const isLoginPage = pathname === "/auth/login";

    if (isLoginPage) {
        return <>{children}</>;
    }

    return (
        <>
            <Navigation />
            <div className="ml-64">
                <div className="container mx-auto px-4 py-8">{children}</div>
            </div>
        </>
    );
}
