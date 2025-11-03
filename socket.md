# Socket.io 로그 시스템 아키텍처

## 개요

이 프로젝트는 **Socket.io**를 사용하여 서버에서 클라이언트로 실시간 로그를 전달하는 시스템을 구현했습니다. 서버 사이드에서 생성된 로그는 WebSocket을 통해 모든 연결된 클라이언트에 실시간으로 브로드캐스트되며, 클라이언트는 Redux store에 저장하여 UI에 표시합니다.

## 시스템 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                        클라이언트 (브라우저)                    │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │ LogsDisplay  │───▶│  useSocket   │───▶│  socket.ts   │  │
│  │  Component   │    │     Hook     │    │   Client     │  │
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
                                                   │
┌──────────────────────────────────────────────────┼─────────┐
│                                                   ▼         │
│  ┌────────────────────────────────────────────────────┐   │
│  │         Next.js Pages Router API                    │   │
│  │         /api/socket.ts                              │   │
│  │  - Socket.io 서버 초기화                            │   │
│  │  - 클라이언트 연결 관리                             │   │
│  └────────────────────────────────────────────────────┘   │
│                          │                                 │
│                          ▼                                 │
│  ┌────────────────────────────────────────────────────┐   │
│  │         socketServer.ts                             │   │
│  │  - 전역 Socket.io 인스턴스 관리                     │   │
│  │  - Logger에서 사용                                  │   │
│  └────────────────────────────────────────────────────┘   │
│                          │                                 │
│                          ▼                                 │
│  ┌────────────────────────────────────────────────────┐   │
│  │         Logger (lib/logger.ts)                      │   │
│  │  - 서버: WebSocket으로 전송                         │   │
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
connectSocket(): Socket | null
```

-   Socket.io 클라이언트 연결 생성 및 관리
-   이미 연결된 Socket이 있으면 재사용
-   연결되지 않은 Socket이 있으면 재사용 대기
-   새 Socket 생성 시 설정:
    -   URL: `window.location.origin` (브라우저) 또는 환경변수
    -   Path: `/api/socket.io`
    -   Transports: `["websocket", "polling"]`
    -   재연결: 자동 재연결 활성화 (최대 5번 시도)

**이벤트 리스너:**

-   `connect`: 연결 성공 시 로그 출력
-   `disconnect`: 연결 해제 시 로그 출력
-   `connect_error`: 연결 에러 시 로그 출력
-   `reconnect`: 재연결 성공 시 로그 출력

#### `lib/hooks/useSocket.ts`

**React Hook for WebSocket 로그 수신**

-   Redux와 통합된 Socket.io 로그 수신 Hook
-   컴포넌트 마운트 시 Socket 연결 및 리스너 등록
-   로그 수신 시 자동으로 Redux store에 저장

**동작 흐름:**

1. `useEffect`에서 `connectSocket()` 호출
2. `socket.on("log", handleLog)` 리스너 등록
3. 로그 수신 시 `dispatch(addLog(...))`로 Redux에 저장
4. 컴포넌트 언마운트 시 리스너 제거

**주의사항:**

-   Socket 연결은 여러 컴포넌트에서 공유되므로, 언마운트 시 `disconnectSocket()`을 호출하지 않음
-   리스너만 제거하여 다른 컴포넌트에 영향 없도록 함

#### `components/CrawlerTab/LogsDisplay.tsx`

**로그 표시 컴포넌트**

-   `useSocket()` Hook을 호출하여 WebSocket 연결 초기화
-   마운트 시 `/api/socket` API를 호출하여 서버 초기화 보장
-   Redux store에서 로그를 구독하여 UI에 표시
-   클라이언트 사이드 로그 테스트 기능 제공
-   API 호출을 통한 서버 사이드 로그 테스트 기능 제공

### 2. 서버 사이드

#### `pages/api/socket.ts`

**Socket.io 서버 초기화 API Route (Pages Router)**

Next.js Pages Router를 사용하여 Socket.io 서버를 HTTP 서버에 통합합니다.

**초기화 프로세스:**

1. `res.socket.server.io`가 없으면 새 Socket.io 서버 인스턴스 생성
2. HTTP 서버에 Socket.io 서버 연결
3. 전역 Socket.io 인스턴스를 `socketServer.ts`에 설정
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

**이벤트 핸들러:**

-   `connection`: 클라이언트 연결 시
    -   연결된 클라이언트 수 로그 출력
-   `log`: 클라이언트에서 로그 수신 시
    -   `socket.broadcast.emit("log", data)`로 다른 모든 클라이언트에 브로드캐스트
-   `disconnect`: 클라이언트 연결 해제 시
    -   남은 클라이언트 수 로그 출력

**중요:**

-   Next.js Pages Router의 API Route를 사용하여 Socket.io 서버를 초기화
-   `res.socket.server.io`에 Socket.io 인스턴스를 저장하여 요청 간 상태 유지
-   App Router와의 충돌을 방지하기 위해 Pages Router만 사용

#### `lib/socketServer.ts`

**전역 Socket.io 서버 인스턴스 관리**

서버 사이드 모듈(특히 `Logger`)에서 Socket.io 서버 인스턴스에 접근할 수 있도록 전역으로 관리합니다.

**함수:**

-   `setSocketServer(server)`: Socket.io 서버 인스턴스 설정
-   `getSocketServer()`: 전역 Socket.io 서버 인스턴스 가져오기
-   `initSocketServer()`: 호환성을 위해 유지되지만 실제로는 사용하지 않음

**사용 위치:**

-   `pages/api/socket.ts`: Socket.io 서버 초기화 후 전역에 설정
-   `lib/logger.ts`: 서버 사이드에서 로그 전송 시 사용

#### `lib/logger.ts`

**통합 로깅 시스템**

서버와 클라이언트 모두에서 사용 가능한 로깅 유틸리티입니다.

**동작 방식:**

-   **서버 사이드** (`typeof window === "undefined"`):
    1. 콘솔에 로그 출력
    2. `getSocketServer()`로 Socket.io 인스턴스 가져오기
    3. `io.emit("log", {...})`로 모든 연결된 클라이언트에 전송
-   **클라이언트 사이드**:
    1. Redux store에 직접 `addLog` 액션 디스패치
    2. Socket.io를 사용하지 않고 클라이언트 로컬에 저장

**Logger 클래스:**

-   Singleton 패턴으로 구현
-   `getInstance(sessionId)`: Logger 인스턴스 가져오기
-   `log(message, type)`: 로그 메시지 기록
-   `info(message)`, `success(message)`, `error(message)`: 편의 메서드

#### `pages/api/test-log.ts`

**로그 테스트 API Route**

서버 사이드에서 로그를 생성하고 WebSocket을 통해 전달하는 테스트 엔드포인트입니다.

**동작:**

1. Socket.io 서버가 초기화되지 않았으면 초기화
2. 요청 본문의 `type`과 `message`를 받아 Logger로 로그 생성
3. 여러 로그를 순차적으로 생성하여 실시간 전달 테스트
4. WebSocket을 통해 모든 클라이언트에 실시간 전달

## 데이터 흐름

### 서버에서 클라이언트로 로그 전달

```
1. 서버 코드에서 Logger 호출
   ↓
2. Logger.log() (서버 사이드)
   ↓
3. getSocketServer() → Socket.io 서버 인스턴스
   ↓
4. io.emit("log", { message, type, timestamp })
   ↓
5. 모든 연결된 클라이언트에 브로드캐스트
   ↓
6. 클라이언트: socket.on("log", handleLog)
   ↓
7. handleLog() → dispatch(addLog(...))
   ↓
8. Redux store 업데이트
   ↓
9. UI 자동 리렌더링 (LogsDisplay 컴포넌트)
```

### 클라이언트에서 클라이언트로 로그 전달

```
1. 클라이언트 A: socket.emit("log", data)
   ↓
2. 서버: socket.on("log", ...)
   ↓
3. 서버: socket.broadcast.emit("log", data)
   ↓
4. 클라이언트 B, C, ...: socket.on("log", ...)
   ↓
5. 각 클라이언트의 Redux store 업데이트
```

## 연결 관리

### 클라이언트 연결 생성

1. **초기 연결:**

    - `LogsDisplay` 컴포넌트 마운트 시 `/api/socket` API 호출
    - `useSocket()` Hook이 `connectSocket()` 호출
    - Socket.io 클라이언트가 서버에 연결 시도

2. **연결 재사용:**

    - `connectSocket()`은 모듈 레벨 변수에 Socket 인스턴스를 저장
    - 이미 연결된 Socket이 있으면 재사용
    - 여러 컴포넌트에서 `useSocket()`을 호출해도 같은 Socket 인스턴스 공유

3. **재연결:**
    - 연결이 끊어지면 Socket.io 클라이언트가 자동으로 재연결 시도
    - 재연결 성공 시 새로운 Socket ID가 할당될 수 있음
    - 재연결 후에도 이벤트 리스너는 자동으로 유지됨

### 서버 연결 관리

1. **서버 초기화:**

    - 첫 번째 `/api/socket` 요청 시 Socket.io 서버 인스턴스 생성
    - `res.socket.server.io`에 저장하여 이후 요청에서 재사용
    - 전역 Socket.io 인스턴스도 `socketServer.ts`에 설정

2. **클라이언트 연결:**

    - 클라이언트가 연결되면 `io.on("connection", ...)` 핸들러 실행
    - 각 클라이언트는 고유한 Socket ID를 받음
    - 연결된 클라이언트 수는 `io.sockets.sockets.size`로 확인 가능

3. **연결 해제:**
    - 클라이언트가 연결을 해제하면 `disconnect` 이벤트 발생
    - 서버에서 해당 클라이언트의 리스너 자동 정리

## 이벤트 타입

### `log` 이벤트

**데이터 구조:**

```typescript
{
    message: string; // 로그 메시지
    type: "info" | "success" | "error"; // 로그 타입
    timestamp: string; // ISO 8601 형식의 타임스탬프
}
```

**전송 방식:**

-   **서버 → 클라이언트**: `io.emit("log", data)` - 모든 클라이언트에 전송
-   **클라이언트 → 클라이언트**: `socket.broadcast.emit("log", data)` - 발신자 제외 모든 클라이언트에 전송

## Redux 통합

### `lib/slices/logsSlice.ts`

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

-   `✅ Socket.io client connected: [socket-id]`: 연결 성공
-   `❌ Socket.io client disconnected: [reason]`: 연결 해제
-   `📨 Log received via WebSocket: [data]`: 로그 수신
-   `📦 Dispatching to Redux...`: Redux 저장 시작
-   `✅ Log dispatched to Redux`: Redux 저장 완료
-   `🔍 Socket.io received 'log' event: [data]`: 개발 환경에서 모든 `log` 이벤트 수신

### 서버 사이드 로그

-   `Socket.io server starting...`: 서버 초기화 시작
-   `Socket.io server started successfully`: 서버 초기화 완료
-   `🔌 Server: A user connected: [socket-id]`: 클라이언트 연결
-   `🔌 Server: Total connected clients: [number]`: 연결된 클라이언트 수
-   `🔌 Server: A user disconnected: [socket-id]`: 클라이언트 연결 해제
-   `✅ Log sent via WebSocket: [message]`: 로그 전송 성공

## 문제 해결

### 여러 Socket 연결이 생성되는 경우

**원인:**

-   `connectSocket()`이 여러 번 호출되어 새 Socket 인스턴스가 생성됨
-   또는 컴포넌트가 여러 번 마운트/언마운트됨

**해결:**

-   현재 구현에서는 모듈 레벨 변수로 Socket 인스턴스를 관리하여 재사용
-   `socket?.connected` 체크로 이미 연결된 Socket 재사용

### 로그가 수신되지 않는 경우

**확인 사항:**

1. Socket.io 서버가 초기화되었는지 확인 (`/api/socket` 호출 확인)
2. 클라이언트가 서버에 연결되었는지 확인 (브라우저 콘솔 로그 확인)
3. 리스너가 제대로 등록되었는지 확인 (`socket.on("log", ...)`)
4. 서버에서 `io.emit("log", ...)`가 제대로 호출되는지 확인

**디버깅:**

-   브라우저 콘솔에서 `✅ Socket.io client connected` 메시지 확인
-   네트워크 탭에서 WebSocket 연결 확인
-   서버 콘솔에서 `🔌 Server: A user connected` 메시지 확인

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

2. **Socket 인스턴스 공유:**

    - 서버 사이드에서 Socket.io 인스턴스는 `res.socket.server.io`에 저장
    - 여러 API Route에서 같은 Socket.io 인스턴스를 공유해야 함
    - `socketServer.ts`의 전역 변수로 Logger에서 접근

3. **클라이언트 Socket 재사용:**

    - 클라이언트에서 Socket 인스턴스는 모듈 레벨에서 관리
    - 여러 컴포넌트에서 `useSocket()`을 호출해도 같은 Socket 공유
    - 언마운트 시 `disconnectSocket()`을 호출하지 않도록 주의

4. **이벤트 리스너 중복 등록:**
    - `socket.on("log", ...)`는 여러 번 호출하면 리스너가 중복 등록됨
    - `useSocket()` Hook에서는 컴포넌트 언마운트 시 리스너를 제거하도록 구현

## 향후 개선 사항

1. **연결 상태 추적:**

    - `useSocket()` Hook에서 실제 연결 상태를 반환하도록 개선
    - UI에서 연결 상태를 표시할 수 있도록 함

2. **로그 필터링:**

    - Redux store에서 로그 타입별 필터링 기능 추가
    - 검색 기능 추가

3. **로그 저장:**

    - 로그를 로컬 스토리지나 데이터베이스에 저장
    - 페이지 새로고침 후에도 로그 유지

4. **에러 처리:**
    - 연결 실패 시 재시도 로직 개선
    - 에러 메시지를 사용자에게 표시
