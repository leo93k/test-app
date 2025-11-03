import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    // Next.js 16에서는 turbo가 기본적으로 활성화되어 있습니다
    compiler: {
        removeConsole:
            process.env.NODE_ENV === "production"
                ? {
                      exclude: ["error", "warn"], // 에러와 경고는 유지
                  }
                : false,
    },
};

export default nextConfig;
