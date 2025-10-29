import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navigation from "@/components/Navigation";
import ReduxProvider from "@/components/ReduxProvider";

const geistSans = Geist({
    variable: "--font-geist-sans",
    subsets: ["latin"],
});

const geistMono = Geist_Mono({
    variable: "--font-geist-mono",
    subsets: ["latin"],
});

export const metadata: Metadata = {
    title: "크롤링 도구 - 웹사이트 분석 및 관리",
    description: "웹 크롤링, 브라우저 자동화, 큐 모니터링을 위한 통합 도구",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="ko">
            <body
                className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800`}
            >
                <ReduxProvider>
                    <Navigation />
                    <div className="ml-64">
                        <div className="container mx-auto px-4 py-8">
                            {children}
                        </div>
                    </div>
                </ReduxProvider>
            </body>
        </html>
    );
}
