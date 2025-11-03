export default function HomePage() {
    return (
        <div className="p-6">
            <div className="max-w-4xl mx-auto">
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold text-gray-800 dark:text-white mb-4">
                        🚀 크롤링 도구 대시보드
                    </h1>
                    <p className="text-lg text-gray-600 dark:text-gray-300">
                        웹사이트 분석, 브라우저 자동화, 큐 모니터링을 위한 통합
                        도구
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* 웹 크롤러 카드 */}
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border-l-4 border-blue-500">
                        <div className="flex items-center mb-4">
                            <span className="text-3xl mr-3">🕷️</span>
                            <h2 className="text-xl font-semibold text-gray-800 dark:text-white">
                                웹 크롤러
                            </h2>
                        </div>
                        <p className="text-gray-600 dark:text-gray-300 mb-4">
                            네이버 자동 로그인 및 서로이웃 추가 기능을
                            제공합니다.
                        </p>
                        <ul className="text-sm text-gray-500 dark:text-gray-400 space-y-1 mb-4">
                            <li>• 자동 로그인 시스템</li>
                            <li>• 실시간 로그 모니터링</li>
                            <li>• 안전한 크롤링</li>
                        </ul>
                        <a
                            href="/crawler"
                            className="inline-block w-full text-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                        >
                            크롤러 시작하기
                        </a>
                    </div>

                    {/* 브라우저 실행 카드 */}
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border-l-4 border-green-500">
                        <div className="flex items-center mb-4">
                            <span className="text-3xl mr-3">🌐</span>
                            <h2 className="text-xl font-semibold text-gray-800 dark:text-white">
                                브라우저 실행
                            </h2>
                        </div>
                        <p className="text-gray-600 dark:text-gray-300 mb-4">
                            큐 시스템을 사용한 다중 브라우저 실행 및 관리
                            기능입니다.
                        </p>
                        <ul className="text-sm text-gray-500 dark:text-gray-400 space-y-1 mb-4">
                            <li>• 최대 100개 브라우저 실행</li>
                            <li>• 큐 시스템으로 부하 관리</li>
                            <li>• 자동 브라우저 종료</li>
                        </ul>
                        <a
                            href="/analytics"
                            className="inline-block w-full text-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                        >
                            브라우저 실행하기
                        </a>
                    </div>

                    {/* 설정 카드 */}
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border-l-4 border-orange-500">
                        <div className="flex items-center mb-4">
                            <span className="text-3xl mr-3">⚙️</span>
                            <h2 className="text-xl font-semibold text-gray-800 dark:text-white">
                                설정
                            </h2>
                        </div>
                        <p className="text-gray-600 dark:text-gray-300 mb-4">
                            애플리케이션의 동작 방식을 설정하고 시스템 정보를
                            확인합니다.
                        </p>
                        <ul className="text-sm text-gray-500 dark:text-gray-400 space-y-1 mb-4">
                            <li>• 큐 설정 관리</li>
                            <li>• 브라우저 딜레이 조정</li>
                            <li>• 시스템 정보 확인</li>
                        </ul>
                        <a
                            href="/settings"
                            className="inline-block w-full text-center px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors"
                        >
                            설정 관리하기
                        </a>
                    </div>
                </div>

                {/* 시스템 상태 요약 */}
                <div className="mt-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
                    <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">
                        📈 시스템 개요
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <h4 className="text-md font-medium text-gray-700 dark:text-gray-300 mb-2">
                                주요 기능
                            </h4>
                            <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                                <li>• 웹 크롤링 및 자동 로그인</li>
                                <li>• 다중 브라우저 실행 관리</li>
                                <li>• 큐 시스템을 통한 부하 제어</li>
                                <li>• 실시간 모니터링 및 로깅</li>
                            </ul>
                        </div>
                        <div>
                            <h4 className="text-md font-medium text-gray-700 dark:text-gray-300 mb-2">
                                기술 스택
                            </h4>
                            <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                                <li>• Next.js 16 (App Router)</li>
                                <li>• Playwright (브라우저 자동화)</li>
                                <li>• TypeScript</li>
                                <li>• Tailwind CSS</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
