"use client";
import { useState } from "react";
import type { BlogSearchResult } from "./types";

interface BlogSearchSectionProps {
    searchResults: BlogSearchResult[];
    friendRequestTargets: BlogSearchResult[];
    onSearch: (keyword: string, maxPage: number) => void;
    onAddToTargets: (result: BlogSearchResult) => void;
    searchLoading: boolean;
}

export default function BlogSearchSection({
    searchResults,
    friendRequestTargets,
    onSearch,
    onAddToTargets,
    searchLoading,
}: BlogSearchSectionProps) {
    const [keyword, setKeyword] = useState("");
    const [maxPage, setMaxPage] = useState(1);

    const handleSearch = () => {
        onSearch(keyword, maxPage);
    };

    return (
        <div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
                <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">
                    🔍 블로그 검색
                </h3>

                {/* 키워드 입력 및 페이지 설정 */}
                <div className="mb-4">
                    <div className="flex gap-2 items-end">
                        <div className="flex-1">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                검색 키워드
                            </label>
                            <input
                                type="text"
                                value={keyword}
                                onChange={(e) => setKeyword(e.target.value)}
                                placeholder="검색할 키워드를 입력하세요"
                                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                                disabled={searchLoading}
                            />
                        </div>
                        <div className="w-24">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                페이지 수
                            </label>
                            <input
                                type="number"
                                value={maxPage}
                                onChange={(e) => {
                                    const value = parseInt(e.target.value) || 1;
                                    setMaxPage(
                                        Math.max(1, Math.min(20, value))
                                    );
                                }}
                                min="1"
                                max="20"
                                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                                disabled={searchLoading}
                            />
                        </div>
                        <button
                            onClick={handleSearch}
                            disabled={searchLoading || !keyword.trim()}
                            className="px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
                        >
                            {searchLoading ? "검색 중..." : "🔍 검색"}
                        </button>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        1부터 입력한 숫자까지의 페이지를 검색합니다. (예: 3 입력
                        시 1, 2, 3페이지 검색)
                    </p>
                </div>

                {/* 검색 결과 */}
                <div className="mt-6">
                    {searchResults.length > 0 ? (
                        <>
                            <h4 className="text-lg font-semibold text-gray-800 dark:text-white mb-3">
                                📋 검색 결과 ({searchResults.length}개)
                            </h4>
                            <div className="space-y-2">
                                <h5 className="text-md font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    📝 검색된 블로그 목록
                                </h5>
                                <div className="max-h-96 overflow-y-auto space-y-2">
                                    {searchResults.map((result, index) => (
                                        <div
                                            key={index}
                                            className="p-3 rounded-lg border bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 relative group"
                                        >
                                            <button
                                                onClick={() => {
                                                    if (
                                                        !friendRequestTargets.some(
                                                            (item) =>
                                                                item.url ===
                                                                result.url
                                                        )
                                                    ) {
                                                        onAddToTargets(result);
                                                    }
                                                }}
                                                disabled={friendRequestTargets.some(
                                                    (item) =>
                                                        item.url === result.url
                                                )}
                                                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white text-xs px-2 py-1 rounded"
                                                title={
                                                    friendRequestTargets.some(
                                                        (item) =>
                                                            item.url ===
                                                            result.url
                                                    )
                                                        ? "이미 추가됨"
                                                        : "서이추 목록에 추가"
                                                }
                                            >
                                                {friendRequestTargets.some(
                                                    (item) =>
                                                        item.url === result.url
                                                )
                                                    ? "✓"
                                                    : "+"}
                                            </button>
                                            <div className="flex justify-between items-start pr-8">
                                                <h6 className="font-medium text-gray-800 dark:text-white text-sm line-clamp-2">
                                                    {result.title ||
                                                        "제목 없음"}
                                                </h6>
                                                <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded ml-2 flex-shrink-0">
                                                    {result.platform ||
                                                        "블로그"}
                                                </span>
                                            </div>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                👤{" "}
                                                {result.author || "작성자 미상"}
                                            </p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                🔗{" "}
                                                <a
                                                    href={result.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-blue-600 dark:text-blue-400 hover:underline"
                                                >
                                                    블로그 보기
                                                </a>
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="text-center py-8">
                            <div className="text-4xl text-gray-400 mb-2">
                                🔍
                            </div>
                            <p className="text-gray-500 dark:text-gray-400">
                                검색 결과가 없습니다.
                            </p>
                            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                                다른 키워드로 검색해보세요.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
