# Socket.io 로그 시스템 아키텍처

## 개요

이 프로젝트는 **Socket.io**를 사용하여 서버에서 클라이언트로 실시간 로그를 전달하는 시스템을 구현했습니다. 서버 사이드에서 생성된 로그는 WebSocket을 통해 **세션별로 분리되어** 해당 세션의 클라이언트에만 실시간으로 전달되며, 클라이언트는 Redux store에 저장하여 UI에 표시합니다.

## 핵심 개념: 세션 기반 로깅

각 클라이언트는 고유한 `sessionId`를 가지며, 서버는 이 `sessionId`를 기반으로 로그를 필터링하여 해당 세션의 클라이언트에만 전달합니다. 이를 통해 여러 클라이언트가 동시에 사용하더라도 각자의 로그만 수신할 수 있습니다.

## 시스템 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                        클라이언트 (브라우저)                    │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │ LogList      │───▶│  useSocket   │───▶│  socket.ts   │  │
│  │ LogTestSection│    │     Hook     │    │   Client     │  │
│  └──────────────┘    └──────────────┘    └──────┬───────┘  │
│         │                    │                   │          │
│         ▼                    ▼                   ▼          │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐ │
│  │ Redux Store  │◀───│  logsSlice   │    │ WebSocket    │ │
│  │  (logs state)│    │   Reducer    │    │  Connection  │ │
│  └──────────────┘    └──────────────┘    └──────┬───────┘ │
└──────────────────────────────────────────────────┼─────────┘
                                                   │
                                          Socket.io Protocol
                                          (sessionId 기반 필터링)
                                                   │
┌──────────────────────────────────────────────────┼─────────┐
│                                                   ▼         │
│  ┌────────────────────────────────────────────────────┐   │
│  │         Next.js Pages Router API                    │   │
│  │         /api/socket.ts                              │   │
│  │  - Socket.io 서버 초기화                            │   │
│  │  - 클라이언트 연결 관리                             │   │
│  │  - join-session 이벤트 처리 (sessionId 저장)        │   │
│  └────────────────────────────────────────────────────┘   │
│                          │                                 │
│                          ▼                                 │
│  ┌────────────────────────────────────────────────────┐   │
│  │         service/socket.ts                           │   │
│  │  - 전역 Socket.io 인스턴스 관리                     │   │
│  │  - socket.data.sessionId 저장                      │   │
│  │  - Logger에서 사용                                  │   │
│  └────────────────────────────────────────────────────┘   │
│                          │                                 │
│                          ▼                                 │
│  ┌────────────────────────────────────────────────────┐   │
│  │         service/logger.ts                           │   │
│  │  - 서버: sessionId로 필터링하여 WebSocket 전송     │   │
│  │  - 클라이언트: Redux에 직접 저장                     │   │
│  └────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## 파일 구조 및 역할

### 1. 클라이언트 사이드

#### `lib/socket.ts`

**클라이언트 Socket.io 연결 관리 모듈**

-   **전역 Socket 인스턴스 관리**: 단일 Socket 인스턴스를 모듈 레벨에서 관리
-   **연결 재사용**: 이미 연결된 Socket이 있으면 재사용하여 중복 연결 방지
-   **자동 재연결**: 연결이 끊어지면 자동으로 재연결 시도

**주요 함수:**

```typescript
connectSocket(): Socket
```

-   Socket.io 클라이언트 연결 생성 및 관리
-   이미 연결된 Socket이 있으면 재사용
-   연결되지 않은 Socket이 있으면 재사용 대기
-   새 Socket 생성 시 설정:
    -   URL: `window.location.origin` (브라우저) 또는 환경변수
    -   Path: `/api/socket.io`
    -   Transports: `["websocket", "polling"]`
    -   재연결: 자동 재연결 활성화 (최대 5번 시도)

#### `lib/hooks/useSocket.ts`

**React Hook for WebSocket 로그 수신 및 세션 관리**

-   Redux와 통합된 Socket.io 로그 수신 Hook
-   컴포넌트 마운트 시 Socket 연결 및 리스너 등록
-   로그 수신 시 자동으로 Redux store에 저장
-   **세션 ID 생성 및 관리**: 각 클라이언트마다 고유한 `sessionId` 생성

**주요 기능:**

1. **sessionId 생성**: 초기 렌더링 시 `client-${Date.now()}-${random}` 형식으로 생성
2. **소켓 연결**: `connectSocket()` 호출하여 Socket 연결
3. **세션 등록**: 소켓 연결 시 `join-session` 이벤트로 `sessionId` 전송
4. **로그 수신**: `socket.on("log", handleLog)` 리스너 등록
5. **Redux 저장**: 로그 수신 시 `dispatch(addLog(...))`로 Redux에 저장

**반환 값:**

```typescript
{
    isConnected: boolean; // 소켓 연결 상태
    socketId: string | null; // 소켓 ID
    sessionId: string; // 세션 ID (항상 생성됨)
}
```

**동작 흐름:**

1. `useState`로 초기 렌더링 시 즉시 `sessionId` 생성
2. `useEffect`에서 `connectSocket()` 호출
3. 소켓 연결 시 `socket.emit("join-session", sessionId)` 전송
4. `socket.on("log", handleLog)` 리스너 등록
5. 로그 수신 시 `dispatch(addLog(...))`로 Redux에 저장
6. 컴포넌트 언마운트 시 리스너 제거

**주의사항:**

-   Socket 연결은 여러 컴포넌트에서 공유되므로, 언마운트 시 `disconnectSocket()`을 호출하지 않음
-   리스너만 제거하여 다른 컴포넌트에 영향 없도록 함
-   `sessionId`는 초기 렌더링 시 생성되므로 항상 사용 가능

#### `components/CrawlerTab/LogList.tsx`

**로그 목록 표시 컴포넌트**

-   Redux store에서 로그를 구독하여 UI에 표시
-   최신 로그가 위로 오도록 정렬
-   로그 타입별 스타일링 (info, success, error)

#### `components/CrawlerTab/LogTestSection.tsx`

**로그 테스트 컴포넌트**

-   `useSocket()` Hook을 호출하여 WebSocket 연결 초기화
-   마운트 시 `/api/socket` API를 호출하여 서버 초기화 보장
-   클라이언트 사이드 로그 테스트 기능 제공
-   API 호출을 통한 서버 사이드 로그 테스트 기능 제공
-   **실제 소켓 연결 상태 확인**: `SocketConnectionStatus` 컴포넌트로 실제 연결 상태 표시

### 2. 서버 사이드

#### `pages/api/socket.ts`

**Socket.io 서버 초기화 API Route (Pages Router)**

Next.js Pages Router를 사용하여 Socket.io 서버를 HTTP 서버에 통합합니다.

**초기화 프로세스:**

1. `res.socket.server.io`가 없으면 새 Socket.io 서버 인스턴스 생성
2. HTTP 서버에 Socket.io 서버 연결
3. 전역 Socket.io 인스턴스를 `service/socket.ts`에 설정
4. 클라이언트 연결 이벤트 핸들러 등록

**설정:**

```typescript
{
  cors: {
    origin: process.env.NODE_ENV === "production"
      ? process.env.NEXT_PUBLIC_APP_URL || "*"
      : "http://localhost:3000",
    methods: ["GET", "POST"]
  },
  path: "/api/socket.io"
}
```

#### `service/socket.ts`

**전역 Socket.io 서버 인스턴스 관리**

서버 사이드 모듈(특히 `Logger`)에서 Socket.io 서버 인스턴스에 접근할 수 있도록 전역으로 관리합니다.

**주요 기능:**

1. **서버 초기화**: `initializeServer(httpServer)`로 Socket.io 서버 생성
2. **세션 관리**: 클라이언트가 `join-session` 이벤트로 `sessionId`를 전송하면 `socket.data.sessionId`에 저장
3. **인스턴스 관리**: 싱글톤 패턴으로 전역 Socket.io 인스턴스 관리

**이벤트 핸들러:**

-   `connection`: 클라이언트 연결 시
    -   연결된 클라이언트 수 로그 출력
-   `join-session`: 클라이언트가 `sessionId`를 전송할 때
    -   `socket.data.sessionId`에 저장
    -   해당 세션에 속한 소켓으로 식별 가능
-   `disconnect`: 클라이언트 연결 해제 시
    -   남은 클라이언트 수 로그 출력

**함수:**

-   `initializeSocketServer(httpServer)`: Socket.io 서버 초기화
-   `getSocketServer()`: 전역 Socket.io 서버 인스턴스 가져오기 (비동기)
-   `getSocketServerSync()`: 전역 Socket.io 서버 인스턴스 가져오기 (동기)

#### `service/logger.ts`

**통합 로깅 시스템 (세션 기반)**

서버와 클라이언트 모두에서 사용 가능한 로깅 유틸리티입니다. **서버 사이드에서는 세션별로 필터링하여 해당 세션의 클라이언트에만 로그를 전송**합니다.

**동작 방식:**

-   **서버 사이드** (`typeof window === "undefined"`):
    1. 콘솔에 로그 출력
    2. `getSocketServer()`로 Socket.io 인스턴스 가져오기
    3. `io.fetchSockets()`로 모든 소켓 가져오기
    4. `socket.data.sessionId`가 현재 Logger의 `sessionId`와 일치하는 소켓만 필터링
    5. 해당 소켓들에만 `socket.emit("log", {...})`로 전송
-   **클라이언트 사이드**:
    1. Redux store에 직접 `addLog` 액션 디스패치
    2. Socket.io를 사용하지 않고 클라이언트 로컬에 저장

**Logger 클래스:**

-   Singleton 패턴으로 구현
-   `getInstance(sessionId)`: Logger 인스턴스 가져오기 (sessionId로 세션 구분)
-   `log(message, type)`: 로그 메시지 기록
-   `info(message)`, `success(message)`, `error(message)`: 편의 메서드

**세션 필터링:**

```typescript
// 서버에서 해당 sessionId를 가진 소켓만 찾아서 전송
const sockets = await io.fetchSockets();
const targetSockets = sockets.filter(
    (socket) => socket.data?.sessionId === this.sessionId
);

targetSockets.forEach((socket) => {
    socket.emit("log", logData);
});
```

#### `pages/api/test-log.ts`

**로그 테스트 API Route**

서버 사이드에서 로그를 생성하고 WebSocket을 통해 전달하는 테스트 엔드포인트입니다.

**동작:**

1. Socket.io 서버가 초기화되지 않았으면 초기화
2. 요청 본문의 `type`, `message`, `sessionId`를 받음
3. `Logger.getInstance(sessionId)`로 해당 세션의 Logger 생성
4. Logger로 로그 생성 (해당 세션의 클라이언트에만 전송)
5. 여러 로그를 순차적으로 생성하여 실시간 전달 테스트

**요청 본문:**

```typescript
{
    type: "info" | "success" | "error";
    message?: string;
    sessionId: string;  // 클라이언트에서 전송한 sessionId
}
```

## 데이터 흐름

### 서버에서 클라이언트로 로그 전달 (세션 기반)

```
1. API 엔드포인트에서 Logger.getInstance(sessionId) 호출
   ↓
2. Logger.log() (서버 사이드)
   ↓
3. getSocketServer() → Socket.io 서버 인스턴스
   ↓
4. io.fetchSockets() → 모든 연결된 소켓 가져오기
   ↓
5. socket.data.sessionId === this.sessionId 인 소켓만 필터링
   ↓
6. 해당 소켓들에만 socket.emit("log", { message, type, timestamp })
   ↓
7. 클라이언트: socket.on("log", handleLog)
   ↓
8. handleLog() → dispatch(addLog(...))
   ↓
9. Redux store 업데이트
   ↓
10. UI 자동 리렌더링 (LogList 컴포넌트)
```

### 세션 등록 과정

```
1. 클라이언트: useSocket() 훅에서 sessionId 생성
   sessionId = `client-${Date.now()}-${random}`
   ↓
2. 소켓 연결 시 socket.emit("join-session", sessionId) 전송
   ↓
3. 서버: socket.on("join-session", (sessionId) => {
       socket.data.sessionId = sessionId;
   })
   ↓
4. 이후 서버에서 해당 sessionId로 로그를 필터링하여 전송
```

## 연결 관리

### 클라이언트 연결 생성

1. **초기 연결:**

    - 컴포넌트 마운트 시 `/api/socket` API 호출하여 서버 초기화
    - `useSocket()` Hook이 `connectSocket()` 호출
    - Socket.io 클라이언트가 서버에 연결 시도
    - 연결 성공 시 `socket.emit("join-session", sessionId)` 전송

2. **연결 재사용:**

    - `connectSocket()`은 모듈 레벨 변수에 Socket 인스턴스를 저장
    - 이미 연결된 Socket이 있으면 재사용
    - 여러 컴포넌트에서 `useSocket()`을 호출해도 같은 Socket 인스턴스 공유

3. **재연결:**
    - 연결이 끊어지면 Socket.io 클라이언트가 자동으로 재연결 시도
    - 재연결 성공 시 `socket.emit("join-session", sessionId)` 다시 전송
    - 재연결 후에도 이벤트 리스너는 자동으로 유지됨

### 서버 연결 관리

1. **서버 초기화:**

    - 첫 번째 `/api/socket` 요청 시 Socket.io 서버 인스턴스 생성
    - `res.socket.server.io`에 저장하여 이후 요청에서 재사용
    - 전역 Socket.io 인스턴스도 `service/socket.ts`에 설정

2. **클라이언트 연결:**

    - 클라이언트가 연결되면 `io.on("connection", ...)` 핸들러 실행
    - 각 클라이언트는 고유한 Socket ID를 받음
    - 클라이언트가 `join-session` 이벤트로 `sessionId`를 전송하면 `socket.data.sessionId`에 저장
    - 연결된 클라이언트 수는 `io.sockets.sockets.size`로 확인 가능

3. **연결 해제:**
    - 클라이언트가 연결을 해제하면 `disconnect` 이벤트 발생
    - 서버에서 해당 클라이언트의 리스너 자동 정리

## Namespace, Room, Session 구조

### Namespace

**Socket.io Namespace**: 연결을 논리적으로 분리하는 최상위 단위입니다.

**현재 구조:**

-   **Namespace 개수**: 1개 (기본 namespace `/`)
-   **Path 설정**: `/api/socket.io` (path는 namespace가 아님)
-   **설정 위치**: `service/socket.ts` (93-102번 줄)

```typescript
// service/socket.ts
const io = new SocketIOServerImpl(httpServer, {
    path: "/api/socket.io", // Socket.io path (namespace가 아님)
    // namespace는 기본 "/" 사용
});
```

**특징:**

-   현재는 기본 namespace만 사용 (커스텀 namespace 없음)
-   모든 클라이언트가 같은 namespace에 연결됨
-   필요 시 `io.of("/custom")` 형태로 커스텀 namespace 추가 가능

### Room

**Socket.io Room**: Namespace 내에서 소켓들을 그룹화하는 단위입니다.

**현재 구조:**

-   **Room 이름**: `sessionId`를 사용 (예: `client-123-abc`)
-   **Room 추가**: `socket.join(sessionId)` (서버에서 자동)
-   **설정 위치**: `service/socket.ts` (123번 줄)

```typescript
// service/socket.ts
socket.on(SOCKET_EVENTS.JOIN_SESSION, (sessionId: string) => {
    socket.data.sessionId = sessionId;
    socket.join(sessionId); // sessionId를 room 이름으로 사용
});
```

**Room 사용 목적:**

-   같은 `sessionId`를 가진 소켓들을 그룹화
-   세션별로 메시지를 효율적으로 전송하기 위해 준비됨
-   현재는 Room에 추가만 하고, 실제 emit은 아직 fetchSockets 방식 사용

**Room 활용 (향후 개선 가능):**

```typescript
// 현재 방식 (fetchSockets + 필터링)
const sockets = await io.fetchSockets();
const targetSockets = sockets.filter(
    socket => socket.data?.sessionId === this.sessionId
);
targetSockets.forEach(socket => socket.emit(...));

// Room 사용 시 (더 효율적)
io.to(sessionId).emit(SOCKET_EVENTS.LOG, logData);
```

### Session (sessionId)

**Session**: 애플리케이션 레벨에서 클라이언트를 식별하는 고유 ID입니다.

**Session 생성:**

-   **위치**: `lib/hooks/useSocket.ts` (18-26번 줄)
-   **형식**: `client-${Date.now()}-${random}`
-   **생성 시점**: 컴포넌트 마운트 시 자동 생성

```typescript
// lib/hooks/useSocket.ts
const [sessionId, setSessionId] = useState<string>(() => {
    if (typeof window !== "undefined") {
        return `client-${Date.now()}-${Math.random()
            .toString(36)
            .substr(2, 9)}`;
    }
    return "";
});
```

**Session 등록 (클라이언트 → 서버):**

1. **위치**: `lib/utils/socketInit.ts` (33, 46번 줄)
2. **이벤트**: `join-session`
3. **전송 시점**: API 호출 전에 `ensureSocketInitialized(sessionId)` 호출

```typescript
// lib/utils/socketInit.ts
socket.emit(SOCKET_EVENTS.JOIN_SESSION, sessionId);
```

**Session 저장 (서버):**

1. **위치**: `service/socket.ts` (120-127번 줄)
2. **저장 위치**: `socket.data.sessionId`
3. **Room 추가**: `socket.join(sessionId)`

```typescript
// service/socket.ts
socket.on(SOCKET_EVENTS.JOIN_SESSION, (sessionId: string) => {
    socket.data.sessionId = sessionId; // 소켓에 sessionId 저장
    socket.join(sessionId); // sessionId를 room 이름으로 사용
});
```

**Session별 메시지 전송 (서버 → 클라이언트):**

1. **위치**: `service/logger.ts` (57-82번 줄)
2. **방식**: `fetchSockets()` + 필터링 (향후 Room 방식으로 개선 가능)

```typescript
// service/logger.ts
// 1. 모든 소켓 가져오기
const sockets = await io.fetchSockets();

// 2. sessionId로 필터링
const targetSockets = sockets.filter(
    (socket) => socket.data?.sessionId === this.sessionId
);

// 3. 필터링된 소켓들에만 emit
targetSockets.forEach((socket) => {
    socket.emit(SOCKET_EVENTS.LOG, logData);
});
```

### 구조 관계

```
Namespace (/)
  └── Room (sessionId: "client-123-abc")
        ├── Socket (socket.id: "abc123")
        └── Socket (socket.id: "def456")  // 같은 세션의 여러 탭
  └── Room (sessionId: "client-456-def")
        └── Socket (socket.id: "ghi789")
```

**설명:**

-   **Namespace**: 모든 연결이 같은 namespace에 속함
-   **Room**: `sessionId`를 room 이름으로 사용하여 같은 세션의 소켓들을 그룹화
-   **Session**: 애플리케이션 레벨 식별자로, 여러 소켓이 같은 sessionId를 가질 수 있음 (여러 탭)

### 세션별 메시지 전송 흐름

```
1. 클라이언트: sessionId 생성 ("client-123-abc")
   ↓
2. 클라이언트: socket.emit("join-session", "client-123-abc")
   ↓
3. 서버: socket.data.sessionId = "client-123-abc" 저장
   ↓
4. 서버: socket.join("client-123-abc")  // Room에 추가
   ↓
5. 서버: Logger.getInstance("client-123-abc")
   ↓
6. 서버: io.fetchSockets() → socket.data.sessionId === "client-123-abc" 필터링
   ↓
7. 서버: 필터링된 소켓들에 socket.emit("log", logData)
   ↓
8. 클라이언트: socket.on("log", handleLog) → Redux에 저장
```

### 향후 개선 방향

**Room 방식으로 전환 (더 효율적):**

```typescript
// 현재: fetchSockets + 필터링
const sockets = await io.fetchSockets();
const targetSockets = sockets.filter(...);
targetSockets.forEach(socket => socket.emit(...));

// 개선: Room 사용
io.to(sessionId).emit(SOCKET_EVENTS.LOG, logData);
// 한 줄로 해당 room의 모든 소켓에 emit
```

**장점:**

-   더 효율적 (모든 소켓을 가져올 필요 없음)
-   코드가 간결해짐
-   Socket.io의 내장 기능 활용

## 이벤트 타입

### `join-session` 이벤트

**클라이언트 → 서버**

클라이언트가 서버에 자신의 `sessionId`를 등록합니다.

**데이터 구조:**

```typescript
sessionId: string; // 예: "client-1234567890-abc123"
```

**동작:**

1. 클라이언트가 소켓 연결 시 `socket.emit("join-session", sessionId)` 전송
2. 서버에서 `socket.on("join-session", (sessionId) => { ... })` 핸들러 실행
3. `socket.data.sessionId = sessionId`로 저장
4. 이후 서버에서 해당 `sessionId`로 로그를 필터링하여 전송

### `log` 이벤트

**서버 → 클라이언트 (세션별)**

서버에서 특정 세션의 클라이언트에만 로그를 전송합니다.

**데이터 구조:**

```typescript
{
    message: string; // 로그 메시지
    type: "info" | "success" | "error"; // 로그 타입
    timestamp: string; // ISO 8601 형식의 타임스탬프
}
```

**전송 방식:**

-   **서버 → 클라이언트**: `socket.emit("log", data)` - 해당 세션의 소켓에만 전송
-   세션 필터링: `socket.data.sessionId === targetSessionId`인 소켓만 선택

## Redux 통합

### `lib/store/logsSlice.ts`

**상태 구조:**

```typescript
interface LogsState {
    logs: LogEntry[];
}

interface LogEntry {
    id: string;
    message: string;
    timestamp: string;
    type: "info" | "success" | "error";
}
```

**액션:**

-   `addLog({ message, type })`: 새 로그 추가
    -   자동으로 ID와 타임스탬프 생성
    -   최대 100개 로그 유지 (초과 시 오래된 로그 삭제)
    -   최신 로그가 위로 오도록 정렬
-   `clearLogs()`: 모든 로그 삭제

**저장 위치:**

-   Redux store의 `logs` 슬라이스에 저장
-   `useAppSelector((state) => state.logs.logs)`로 구독

## 설정 및 환경변수

### Next.js 설정 (`next.config.ts`)

```typescript
{
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        fs: false,
        net: false,
        tls: false,
      };
    }
    return config;
  },
  serverComponentsExternalPackages: ["socket.io"],
}
```

**목적:**

-   Socket.io 서버 사이드 모듈이 클라이언트 번들에 포함되지 않도록 함
-   Node.js 코어 모듈(`fs`, `net`, `tls`)을 클라이언트에서 제외

### 환경변수

-   `NEXT_PUBLIC_SOCKET_URL`: 프로덕션 환경에서 Socket.io 서버 URL
-   `NEXT_PUBLIC_APP_URL`: 프로덕션 환경에서 CORS origin 설정

## 디버깅

### 클라이언트 사이드 로그

-   `🔌 Initializing Socket.io server...`: 서버 초기화 시작
-   `✅ Socket.io server initialized`: 서버 초기화 완료
-   `✅ Socket connected: [socket-id]`: 연결 성공
-   `📤 Sent sessionId to server: [sessionId]`: 세션 등록 완료
-   `❌ Socket.io client disconnected: [reason]`: 연결 해제
-   `📨 Log received via WebSocket: [data]`: 로그 수신
-   `📦 Dispatching to Redux...`: Redux 저장 시작
-   `✅ Log dispatched to Redux`: Redux 저장 완료

### 서버 사이드 로그

-   `Socket.io server starting...`: 서버 초기화 시작
-   `Socket.io server started successfully`: 서버 초기화 완료
-   `🔌 Server: A user connected: [socket-id]`: 클라이언트 연결
-   `🔌 Server: Total connected clients: [number]`: 연결된 클라이언트 수
-   `🔗 Socket [socket-id] joined session: [sessionId]`: 세션 등록
-   `🔌 Server: A user disconnected: [socket-id]`: 클라이언트 연결 해제

## 문제 해결

### 세션 ID가 일치하지 않는 경우

**원인:**

-   클라이언트와 서버에서 다른 `sessionId`를 사용
-   `join-session` 이벤트가 전송되지 않음

**해결:**

-   모든 API 호출 시 동일한 `sessionId`를 전달해야 함
-   `useSocket()` 훅에서 생성한 `sessionId`를 사용
-   API 호출 전에 `socket.emit("join-session", sessionId)` 전송 확인

### 로그가 수신되지 않는 경우

**확인 사항:**

1. Socket.io 서버가 초기화되었는지 확인 (`/api/socket` 호출 확인)
2. 클라이언트가 서버에 연결되었는지 확인 (브라우저 콘솔 로그 확인)
3. `join-session` 이벤트가 전송되었는지 확인 (`📤 Sent sessionId to server` 로그)
4. 서버에서 `socket.data.sessionId`가 제대로 저장되었는지 확인
5. Logger에서 올바른 `sessionId`를 사용하는지 확인

**디버깅:**

-   브라우저 콘솔에서 `✅ Socket.io client connected` 메시지 확인
-   네트워크 탭에서 WebSocket 연결 확인
-   서버 콘솔에서 `🔗 Socket [id] joined session: [sessionId]` 메시지 확인

### 여러 클라이언트가 같은 로그를 받는 경우

**원인:**

-   `sessionId`가 제대로 전달되지 않음
-   서버에서 세션 필터링이 작동하지 않음

**해결:**

-   각 클라이언트가 고유한 `sessionId`를 가지는지 확인
-   API 호출 시 `sessionId`를 전달하는지 확인
-   Logger에서 `getInstance(sessionId)`를 올바르게 호출하는지 확인

### Redux에 저장되지 않는 경우

**확인 사항:**

1. `handleLog` 함수가 호출되는지 확인 (`📨 Log received via WebSocket` 로그)
2. `dispatch` 함수가 제대로 전달되었는지 확인
3. Redux store가 제대로 설정되었는지 확인
4. `addLog` 액션이 제대로 디스패치되는지 확인

## 주의사항

1. **Pages Router vs App Router:**

    - Socket.io 서버는 **Pages Router** (`pages/api/socket.ts`)를 사용해야 함
    - App Router (`app/api/...`)와 충돌할 수 있으므로 주의
    - `res.socket.server`는 Pages Router에서만 사용 가능

2. **세션 ID 일관성:**

    - 클라이언트에서 생성한 `sessionId`를 모든 API 호출에 전달해야 함
    - `useSocket()` 훅에서 생성한 `sessionId`를 사용
    - API 호출 전에 `socket.emit("join-session", sessionId)` 전송 필요

3. **Socket 인스턴스 공유:**

    - 서버 사이드에서 Socket.io 인스턴스는 `res.socket.server.io`에 저장
    - 여러 API Route에서 같은 Socket.io 인스턴스를 공유해야 함
    - `service/socket.ts`의 전역 변수로 Logger에서 접근

4. **클라이언트 Socket 재사용:**

    - 클라이언트에서 Socket 인스턴스는 모듈 레벨에서 관리
    - 여러 컴포넌트에서 `useSocket()`을 호출해도 같은 Socket 공유
    - 언마운트 시 `disconnectSocket()`을 호출하지 않도록 주의

5. **이벤트 리스너 중복 등록:**
    - `socket.on("log", ...)`는 여러 번 호출하면 리스너가 중복 등록됨
    - `useSocket()` Hook에서는 컴포넌트 언마운트 시 리스너를 제거하도록 구현

## 향후 개선 사항

1. **연결 상태 추적:**

    - `useSocket()` Hook에서 실제 연결 상태를 더 정확하게 반환
    - UI에서 연결 상태를 실시간으로 표시

2. **로그 필터링:**

    - Redux store에서 로그 타입별 필터링 기능 추가
    - 검색 기능 추가

3. **로그 저장:**

    - 로그를 로컬 스토리지나 데이터베이스에 저장
    - 페이지 새로고침 후에도 로그 유지

4. **에러 처리:**

    - 연결 실패 시 재시도 로직 개선
    - 에러 메시지를 사용자에게 표시

5. **세션 관리 개선:**
    - 세션 만료 시간 설정
    - 세션별 로그 보관 기간 설정
