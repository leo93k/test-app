# EC2 배포 가이드

## GitHub Actions Secrets 설정

GitHub Repository → Settings → Secrets and variables → Actions에서 다음 secrets를 설정하세요:

### 필수 Secrets

1. **`EC2_SSH_KEY`**

    - EC2 인스턴스의 SSH 프라이빗 키 전체 내용
    - `-----BEGIN RSA PRIVATE KEY-----` 부터 `-----END RSA PRIVATE KEY-----`까지 전체 복사
    - 또는 `.pem` 파일의 전체 내용

2. **`EC2_HOST`**

    - EC2 인스턴스의 퍼블릭 IP 주소 또는 퍼블릭 DNS
    - 예: `3.34.1.35` 또는 `ec2-3-34-1-35.ap-northeast-2.compute.amazonaws.com`

3. **`EC2_USER`**
    - EC2 인스턴스의 사용자 이름
    - Ubuntu: `ubuntu`
    - Amazon Linux: `ec2-user`
    - 기타: 해당 인스턴스의 기본 사용자

### 선택적 Secrets

4. **`EC2_DEPLOY_PATH`** (선택)
    - EC2에서 애플리케이션이 배포될 경로
    - 기본값: `~/test-app`
    - 예: `~/test-app` 또는 `/home/ubuntu/my-app`

## 배포 프로세스

### 자동 배포 (GitHub Actions)

1. **main 브랜치에 push**

    ```bash
    git push origin main
    ```

    - GitHub Actions가 자동으로 트리거됨
    - 배포 진행 상황은 GitHub → Actions 탭에서 확인 가능

2. **수동 배포**
    - GitHub → Actions → Deploy to EC2 → Run workflow
    - `workflow_dispatch`로 수동 실행 가능

### 배포 스크립트 내용

GitHub Actions는 다음 단계를 수행합니다:

1. ✅ 코드 체크아웃
2. ✅ Node.js 설정
3. ✅ 의존성 설치
4. ✅ 애플리케이션 빌드
5. ✅ SSH 설정
6. ✅ EC2로 파일 전송 (rsync)
7. ✅ EC2에서 의존성 설치 및 Playwright 브라우저 설치
8. ✅ 기존 프로세스 종료 및 재시작
9. ✅ 서비스 상태 확인

## EC2 서버 설정

### 1. Node.js 및 Yarn 설치

```bash
# Node.js 20 설치
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Yarn 설치
curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | sudo apt-key add -
echo "deb https://dl.yarnpkg.com/debian stable main" | sudo tee /etc/apt/sources.list.d/yarn.list
sudo apt-get update && sudo apt-get install yarn
```

### 2. 포트 권한 설정

80 포트 사용을 위해 root 권한이 필요합니다:

```bash
# 방법 1: sudo로 실행 (현재 방식)
sudo yarn start:80

# 방법 2: 권한 설정 (권장)
sudo setcap 'cap_net_bind_service=+ep' $(which node)
```

### 3. 방화벽 설정

```bash
# UFW 활성화 시
sudo ufw allow 80/tcp
sudo ufw allow 22/tcp  # SSH
sudo ufw status
```

### 4. 보안 그룹 설정

AWS EC2 콘솔에서 보안 그룹 인바운드 규칙에 다음을 추가:

-   **HTTP (80 포트)**: 모든 IP (0.0.0.0/0) 허용
-   **SSH (22 포트)**: 필요한 IP만 허용 (보안상 권장)

## 문제 해결

### 배포 실패 시

1. **SSH 연결 확인**

    ```bash
    ssh -i ~/.ssh/your-key.pem ubuntu@YOUR_EC2_IP
    ```

2. **서비스 로그 확인**

    ```bash
    # EC2 서버에서
    tail -f ~/test-app/nextjs.log
    ```

3. **프로세스 상태 확인**

    ```bash
    # EC2 서버에서
    ps aux | grep next-server
    sudo ss -tulpn | grep :80
    ```

4. **수동 재시작**
    ```bash
    # EC2 서버에서
    cd ~/test-app
    pkill -f next-server
    sudo yarn start:80
    ```

### 일반적인 문제

-   **포트 80 사용 권한 없음**: `sudo yarn start:80` 또는 권한 설정 필요
-   **의존성 설치 실패**: EC2 서버에서 `yarn install` 수동 실행
-   **Playwright 설치 실패**: EC2 서버에서 `yarn postinstall` 수동 실행
-   **빌드 실패**: `.next` 디렉토리 삭제 후 재빌드

## 수동 배포 스크립트

EC2 서버에서 직접 배포하려면 `.github/workflows/deploy-manual.sh` 스크립트를 사용할 수 있습니다:

```bash
# EC2 서버에서
chmod +x .github/workflows/deploy-manual.sh
./github/workflows/deploy-manual.sh
```

또는 Git pull 후 수동 배포:

```bash
cd ~/test-app
git pull origin main
yarn install
yarn build
yarn postinstall
pkill -f next-server
sudo yarn start:80
```
