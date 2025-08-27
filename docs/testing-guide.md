# Lighthouse 크롤러 시스템 테스트 가이드

## 개요
이 문서는 Lighthouse 크롤러 시스템의 각 구성 요소를 테스트하고 전체 워크플로우를 검증하는 방법을 설명합니다.

## 사전 준비사항

### 필수 환경
- Node.js 18+ 
- pnpm 8+
- Redis 서버 (Docker 또는 로컬)
- MySQL 데이터베이스

### 환경 설정 확인
```bash
# 의존성 설치
pnpm install

# 환경변수 확인
cat .env | grep -E "DATABASE_URL|REDIS_URL"

# 데이터베이스 마이그레이션
npx prisma migrate dev

# 빌드 확인
pnpm build
```

## 1단계: 크롤러 단독 테스트

### 테스트 실행
```bash
pnpm tsx scripts/crawl-test.ts
```

### 예상 결과
```
🚀 Starting Naver News Crawler Test (Dev Mode)...
📰 Crawling: https://news.naver.com/section/100
==============================================================

✅ Successfully crawled 89 articles!

📄 Article 1/3
==============================================================
📌 Title: [실제 기사 제목]
🔗 URL: https://news.naver.com/article/...
📅 Date: 2024-01-09T06:25:00.000Z
✍️  Author: [기자명]
📝 Content Preview:
   [기사 내용 일부]...
🖼️  Images: 3 found
🏷️  Tags: 정치, 국회, ...
```

### 성공 기준
- ✅ 최소 50개 이상의 기사 크롤링
- ✅ 각 기사에서 제목, URL, 날짜 추출
- ✅ 한국어 날짜 형식 올바른 파싱
- ✅ 통계 정보 출력 (성공/실패 개수, 평균 처리 시간)

### 실패 시 점검사항
- 네트워크 연결 상태
- Naver News 사이트 접근 가능 여부
- robots.txt 정책 변경 여부

## 2단계: API 서버 테스트

### 서버 시작
```bash
# Terminal 1: API 서버 실행
pnpm nx serve api

# 서버 시작 확인 메시지
# 🚀 Lighthouse API server running at http://0.0.0.0:3001
# ✅ Database connected successfully
# ✅ Queue system initialized successfully
```

### 헬스체크
```bash
# Terminal 2: 서버 상태 확인
curl http://localhost:3001/health
```

**예상 응답:**
```json
{
  "status": "healthy",
  "database": {
    "status": "healthy"
  },
  "queue": {
    "status": "healthy",
    "queues": [
      {"name": "crawl", "isHealthy": true, "jobCounts": {...}}
    ]
  }
}
```

### 크롤 작업 생성
```bash
# POST 요청으로 크롤 작업 생성
curl -X POST http://localhost:3001/api/crawl \
  -H "Content-Type: application/json" \
  -d '{"url": "https://news.naver.com/section/100"}' \
  | jq
```

**예상 응답:**
```json
{
  "status": "success",
  "message": "Crawl job created successfully",
  "data": {
    "jobId": "1234567890",
    "sourceUrl": "https://news.naver.com/section/100",
    "checkStatus": "/api/crawl/jobs/1234567890"
  }
}
```

## 3단계: 큐 시스템 모니터링

### 큐 상태 확인
```bash
# 전체 큐 상태
curl http://localhost:3001/api/queues/status | jq

# 특정 큐의 작업 목록
curl http://localhost:3001/api/queues/crawl/jobs | jq
```

### 작업 상태 조회
```bash
# JOB_ID는 이전 단계에서 받은 값 사용
JOB_ID="1234567890"
curl http://localhost:3001/api/crawl/jobs/$JOB_ID | jq
```

**예상 응답 (진행 중):**
```json
{
  "status": "success",
  "data": {
    "id": "1234567890",
    "name": "crawl-job",
    "progress": 45,
    "isCompleted": false,
    "isFailed": false
  }
}
```

**예상 응답 (완료):**
```json
{
  "status": "success",
  "data": {
    "id": "1234567890",
    "name": "crawl-job",
    "progress": 100,
    "isCompleted": true,
    "isFailed": false,
    "finishedOn": 1704789600000
  }
}
```

## 4단계: 전체 워크플로우 자동화 테스트

### 테스트 스크립트
```bash
#!/bin/bash
# test-workflow.sh

# 1. 크롤 작업 생성
echo "📋 Creating crawl job..."
RESPONSE=$(curl -s -X POST http://localhost:3001/api/crawl \
  -H "Content-Type: application/json" \
  -d '{"url": "https://news.naver.com/section/100"}')

# 2. Job ID 추출
JOB_ID=$(echo $RESPONSE | jq -r '.data.jobId')
echo "✅ Job created with ID: $JOB_ID"

# 3. 작업 완료까지 모니터링
echo "⏳ Monitoring job status..."
while true; do
  STATUS=$(curl -s http://localhost:3001/api/crawl/jobs/$JOB_ID | jq -r '.data.isCompleted')
  if [ "$STATUS" = "true" ]; then
    echo "✅ Job completed successfully!"
    break
  fi
  echo -n "."
  sleep 2
done

# 4. 최종 결과 확인
curl -s http://localhost:3001/api/crawl/jobs/$JOB_ID | jq
```

### 실행 방법
```bash
chmod +x test-workflow.sh
./test-workflow.sh
```

## 5단계: 데이터베이스 검증

### Prisma Studio 사용
```bash
# 시각적 데이터베이스 브라우저 실행
npx prisma studio

# 브라우저에서 http://localhost:5555 접속
# Content 테이블에서 크롤링된 데이터 확인
```

### SQL 직접 조회
```bash
# MySQL 클라이언트로 접속
mysql -u root -p lighthouse

# 최근 크롤링된 콘텐츠 조회
SELECT id, title, url, publishedAt, createdAt 
FROM Content 
ORDER BY createdAt DESC 
LIMIT 10;

# 오늘 크롤링된 콘텐츠 개수
SELECT COUNT(*) as count 
FROM Content 
WHERE DATE(createdAt) = CURDATE();
```

## 6단계: 네이버 뉴스 섹션별 테스트

### 다양한 섹션 테스트
```bash
# 정치 섹션
curl -X POST http://localhost:3001/api/crawl/naver/section \
  -H "Content-Type: application/json" \
  -d '{"section": "politics", "maxPages": 3}' | jq

# 경제 섹션  
curl -X POST http://localhost:3001/api/crawl/naver/section \
  -H "Content-Type: application/json" \
  -d '{"section": "economy", "maxPages": 2}' | jq

# IT/과학 섹션
curl -X POST http://localhost:3001/api/crawl/naver/section \
  -H "Content-Type: application/json" \
  -d '{"section": "technology", "maxPages": 5}' | jq
```

### 사용 가능한 섹션
- `politics` - 정치
- `economy` - 경제
- `society` - 사회
- `international` - 국제
- `technology` - IT/과학

## 문제 해결 가이드

### Redis 연결 오류
```bash
# Docker로 Redis 실행
docker run -d -p 6379:6379 redis:alpine

# 연결 테스트
redis-cli ping
# 예상 응답: PONG
```

### 포트 충돌 (3001)
```bash
# 사용 중인 프로세스 확인
lsof -i :3001

# 프로세스 종료
kill -9 [PID]

# 또는 환경변수로 포트 변경
PORT=3002 pnpm nx serve api
```

### 데이터베이스 연결 오류
```bash
# MySQL 서비스 상태 확인
brew services list | grep mysql

# MySQL 시작 (macOS)
brew services start mysql

# 연결 테스트
mysql -u root -p -e "SELECT 1"
```

### 크롤링 실패
1. **네트워크 확인**
   ```bash
   ping news.naver.com
   curl -I https://news.naver.com
   ```

2. **로그 확인**
   ```bash
   # API 서버 로그 확인 (실시간)
   tail -f apps/api/logs/api.log
   ```

3. **큐 상태 확인**
   ```bash
   # Failed jobs 확인
   curl http://localhost:3001/api/queues/crawl/failed | jq
   ```

## 성능 측정

### 크롤링 속도 벤치마크
```bash
# 시간 측정과 함께 실행
time pnpm tsx scripts/crawl-test.ts

# 예상 결과:
# real    0m45.123s  (전체 실행 시간)
# user    0m12.345s  (CPU 사용 시간)
# sys     0m2.345s   (시스템 호출 시간)
```

### 메모리 사용량 모니터링
```bash
# Node.js 프로세스 메모리 사용량
ps aux | grep node | grep api

# 실시간 모니터링
top -pid $(pgrep -f "nx serve api")
```

## 테스트 체크리스트

### 기본 기능
- [ ] 크롤러 단독 실행 성공
- [ ] API 서버 정상 시작
- [ ] 헬스체크 응답 정상
- [ ] 크롤 작업 생성 성공
- [ ] Job ID 반환 확인
- [ ] 작업 상태 조회 가능
- [ ] 작업 완료 확인
- [ ] 데이터베이스 저장 확인

### 확장 기능
- [ ] 여러 섹션 크롤링 테스트
- [ ] 동시 다중 작업 처리
- [ ] 실패한 작업 재시도
- [ ] 큐 모니터링 동작
- [ ] 중복 콘텐츠 필터링

### 안정성
- [ ] 네트워크 오류 처리
- [ ] 타임아웃 처리
- [ ] 메모리 누수 없음
- [ ] 장시간 실행 안정성

## 다음 단계

테스트가 모두 성공했다면:

1. **관리자 대시보드 구현** - 크롤링된 콘텐츠를 웹 UI로 확인
2. **스케줄러 설정** - 정기적인 크롤링 작업 자동화
3. **알림 시스템** - 크롤링 완료/실패 시 알림
4. **분석 기능 추가** - 크롤링된 데이터 분석 및 인사이트 도출

## 참고 자료

- [Nx 문서](https://nx.dev)
- [BullMQ 문서](https://docs.bullmq.io)
- [Prisma 문서](https://www.prisma.io/docs)
- [네이버 뉴스 robots.txt](https://news.naver.com/robots.txt)