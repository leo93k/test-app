import jwt from "jsonwebtoken";

// JWT 시크릿 키 (실제 프로덕션에서는 환경 변수로 관리해야 함)
const JWT_SECRET =
    process.env.JWT_SECRET || "your-secret-key-change-in-production";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d"; // 7일

export interface JWTPayload {
    userId: string;
    username: string;
    name: string;
}

/**
 * JWT 토큰 생성
 */
export function generateToken(payload: JWTPayload): string {
    return jwt.sign(payload, JWT_SECRET, {
        expiresIn: JWT_EXPIRES_IN,
    });
}

/**
 * JWT 토큰 검증
 */
export function verifyToken(token: string): JWTPayload | null {
    try {
        const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
        return decoded;
    } catch (error) {
        return null;
    }
}

/**
 * 요청 헤더에서 JWT 토큰 추출
 */
export function extractTokenFromHeader(
    authHeader: string | undefined
): string | null {
    if (!authHeader) {
        return null;
    }

    // "Bearer <token>" 형식에서 토큰 추출
    const parts = authHeader.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer") {
        return null;
    }

    return parts[1];
}
