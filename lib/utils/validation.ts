import { NextApiResponse } from "next";

/**
 * URL 유효성 검사
 */
export function validateUrl(url: string | undefined): string | null {
    if (!url) {
        return "URL is required";
    }

    try {
        new URL(url);
        return null;
    } catch {
        return "Invalid URL format";
    }
}

/**
 * 로그인 정보 유효성 검사
 */
export function validateLoginCredentials(
    username: string | undefined,
    password: string | undefined
): string | null {
    if (!username || !password) {
        return "Username and password are required";
    }
    return null;
}

/**
 * API 에러 응답 반환 헬퍼
 */
export function sendValidationError(res: NextApiResponse, error: string): void {
    res.status(400).json({ error });
}

/**
 * URL 및 로그인 정보 유효성 검사 (통합)
 */
export function validateRequest(
    url: string | undefined,
    username?: string | undefined,
    password?: string | undefined
): { isValid: boolean; error: string | null } {
    const urlError = validateUrl(url);
    if (urlError) {
        return { isValid: false, error: urlError };
    }

    // username과 password가 제공된 경우에만 검증
    if (username !== undefined || password !== undefined) {
        const credentialsError = validateLoginCredentials(username, password);
        if (credentialsError) {
            return { isValid: false, error: credentialsError };
        }
    }

    return { isValid: true, error: null };
}
