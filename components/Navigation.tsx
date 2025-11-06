"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/hooks/useAuth";
import { Button } from "@/components/ui/button";

export default function Navigation() {
    const pathname = usePathname();
    const { user, logout } = useAuth();

    // 개발 환경인지 확인
    const isDev = process.env.NODE_ENV !== "production";

    const allNavItems = [
        {
            href: "/",
            name: "홈",
            icon: "🏠",
            description: "메인 페이지",
        },
        {
            href: "/crawler",
            name: "서로이웃 추가",
            icon: "🕷️",
            description: "네이버 블로그 서로이웃 추가",
        },
        {
            href: "/analytics",
            name: "브라우저 실행",
            icon: "🌐",
            description: "셀레니움 브라우저",
        },
        {
            href: "/monitoring",
            name: "모니터링",
            icon: "📊",
            description: "서버 큐 모니터링",
            devOnly: true, // 개발 환경에서만 표시
        },
        {
            href: "/settings",
            name: "설정",
            icon: "⚙️",
            description: "애플리케이션 설정",
        },
    ];

    // 개발 환경이 아닐 때는 devOnly 항목 제외
    const navItems = allNavItems.filter((item) => !item.devOnly || isDev);

    return (
        <div className="w-64 bg-white dark:bg-gray-800 shadow-lg h-screen fixed left-0 top-0 z-10">
            {/* 로고/헤더 */}
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <h1 className="text-xl font-bold text-gray-800 dark:text-white">
                    🚀 크롤링 도구
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    웹사이트 분석 및 관리
                </p>
            </div>

            {/* 네비게이션 메뉴 */}
            <nav className="p-4">
                <ul className="space-y-2">
                    {navItems.map((item) => (
                        <li key={item.href}>
                            <Link
                                href={item.href}
                                className={`w-full flex items-center p-3 rounded-lg transition-colors ${
                                    pathname === item.href
                                        ? "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200"
                                        : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                                }`}
                            >
                                <span className="text-2xl mr-3">
                                    {item.icon}
                                </span>
                                <div className="text-left">
                                    <div className="font-medium">
                                        {item.name}
                                    </div>
                                    <div className="text-xs opacity-75">
                                        {item.description}
                                    </div>
                                </div>
                            </Link>
                        </li>
                    ))}
                </ul>
            </nav>

            {/* 하단 정보 및 로그아웃 */}
            <div className="absolute bottom-4 left-4 right-4 space-y-3">
                {/* 사용자 정보 */}
                {user && (
                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
                        <div className="text-xs text-blue-700 dark:text-blue-300">
                            <div className="font-medium mb-1">
                                👤 {user.name}
                            </div>
                            <div className="text-blue-600 dark:text-blue-400">
                                @{user.username}
                            </div>
                        </div>
                    </div>
                )}

                {/* 현재 페이지 정보 */}
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                        <div>
                            현재 페이지:{" "}
                            {navItems.find((item) => item.href === pathname)
                                ?.name || "홈"}
                        </div>
                        <div className="mt-1">상태: 정상</div>
                    </div>
                </div>

                {/* 로그아웃 버튼 */}
                {user && (
                    <Button
                        onClick={logout}
                        variant="outline"
                        className="w-full"
                    >
                        🚪 로그아웃
                    </Button>
                )}
            </div>
        </div>
    );
}
