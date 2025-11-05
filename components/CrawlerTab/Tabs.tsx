"use client";

type TabType = "main" | "logs";

interface TabsProps {
    activeTab: TabType;
    onTabChange: (tab: TabType) => void;
}

export default function Tabs({ activeTab, onTabChange }: TabsProps) {
    return (
        <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
            <nav className="flex space-x-1">
                <button
                    onClick={() => onTabChange("main")}
                    className={`px-4 py-2 font-medium text-sm rounded-t-lg transition-colors ${
                        activeTab === "main"
                            ? "bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400"
                            : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                    }`}
                >
                    🔍 검색 & 서이추
                </button>
                <button
                    onClick={() => onTabChange("logs")}
                    className={`px-4 py-2 font-medium text-sm rounded-t-lg transition-colors ${
                        activeTab === "logs"
                            ? "bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400"
                            : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                    }`}
                >
                    📋 로그 테스트
                </button>
            </nav>
        </div>
    );
}

export type { TabType };
