/**
 * 하드코딩된 사용자 데이터
 * DB 없이 사용할 목 데이터
 */

export interface User {
    id: string;
    username: string;
    password: string; // 실제로는 해시된 비밀번호를 사용해야 하지만, 간단한 예제를 위해 평문 사용
    name: string;
}

// 하드코딩된 사용자 목록
export const USERS: User[] = [
    {
        id: "1",
        username: "admin",
        password: "admin123",
        name: "관리자",
    },
    {
        id: "2",
        username: "user1",
        password: "user123",
        name: "일반 사용자",
    },
    {
        id: "2",
        username: "user2",
        password: "user123",
        name: "일반 사용자",
    },
];

/**
 * 사용자 이름으로 사용자 찾기
 */
export function findUserByUsername(username: string): User | undefined {
    return USERS.find((user) => user.username === username);
}

/**
 * 사용자 ID와 비밀번호로 사용자 인증
 */
export function authenticateUser(
    username: string,
    password: string
): User | null {
    const user = findUserByUsername(username);
    if (user && user.password === password) {
        return user;
    }
    return null;
}
