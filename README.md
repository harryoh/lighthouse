# 🔍 Lighthouse - 웹 콘텐츠 크롤링 및 분석 시스템

> 한국 온라인 콘텐츠 실시간 모니터링 및 정치 성향 분석 플랫폼

## 📋 개요

Lighthouse는 한국의 다양한 온라인 플랫폼(뉴스, 커뮤니티, SNS)에서 콘텐츠를 자동으로 수집하고, NLP 기반으로 정치 성향과 여론 동향을 분석하는 종합 모니터링 시스템입니다.

### 🎯 핵심 가치

- **실시간 여론 모니터링**: 24/7 자동 크롤링으로 최신 트렌드 포착
- **정치 성향 분석**: NLP 기반 진보/중도/보수 자동 분류
- **다차원 분석**: 감정 분석, 키워드 추출, 트렌드 감지
- **수동 모니터링 대비 90% 시간 절감**

## ✨ 주요 기능

### 1. 지능형 웹 크롤링 엔진

- 🔸 적응형 파서로 사이트 구조 자동 학습
- 🔸 동적 콘텐츠(JavaScript) 렌더링 지원
- 🔸 Rate limiting 및 프록시 로테이션
- 🔸 User-Agent 로테이션 및 robots.txt 준수

### 2. NLP 기반 콘텐츠 분석

- 🔸 정치 성향 분류 (진보/중도/보수)
- 🔸 감정 분석 (긍정/부정/중립)
- 🔸 핵심 키워드 및 개체명 추출
- 🔸 시계열 트렌드 분석

### 3. 실시간 모니터링 대시보드

- 🔸 WebSocket 기반 라이브 업데이트
- 🔸 커스터마이징 가능한 위젯
- 🔸 알림 및 이상 징후 감지
- 🔸 다양한 차트 및 시각화

### 4. 고급 중복 제거 시스템

- 🔸 퍼지 매칭으로 유사 콘텐츠 감지
- 🔸 크로스 플랫폼 중복 제거
- 🔸 원본 출처 자동 추적

## 🛠️ 기술 스택

### Backend

- **Framework**: Node.js, TypeScript
- **Monorepo**: Nx workspace with pnpm
- **ORM**: Prisma with MySQL 8.0
- **Queue**: Redis with BullMQ
- **Search**: Elasticsearch 8.x

### Crawling & Analysis

- **Browser Automation**: Playwright
- **HTTP Client**: Axios
- **NLP**: Korean language processing (예정: KoBERT)
- **Rate Limiting**: Bottleneck

### Infrastructure

- **Container**: Docker Compose
- **Task Management**: Task Master AI
- **Development**: Claude Code + Cursor IDE integration

## 📁 프로젝트 구조

```
lighthouse/
├── apps/                    # 애플리케이션
│   ├── api/                # REST API 서버
│   └── admin/              # 관리자 대시보드
├── libs/                   # 공유 라이브러리
│   ├── crawler-core/       # 크롤러 프레임워크
│   ├── database/          # Prisma & DB 로직
│   └── shared/            # 공유 유틸리티
├── docker/                # Docker 설정
│   ├── docker-compose.yml
│   └── scripts/
├── prisma/               # 데이터베이스 스키마
│   ├── schema.prisma
│   └── migrations/
├── .taskmaster/          # Task Master 설정
│   ├── config.json
│   ├── docs/
│   └── tasks/
└── .claude/             # Claude Code 설정
```

## 🚀 Quick Start

### Prerequisites

- Node.js 20.x 이상
- Docker & Docker Compose
- pnpm (`npm install -g pnpm`)

### 1. 환경 설정

```bash
# 프로젝트 클론
git clone https://github.com/your-org/lighthouse.git
cd lighthouse

# 의존성 설치
pnpm install

# 환경 변수 설정
cp .env.example .env.local
```

### 2. Docker 인프라 실행

```bash
# MySQL, Redis, Elasticsearch 시작
docker-compose -f docker/docker-compose.yml up -d

# 서비스 상태 확인
docker-compose -f docker/docker-compose.yml ps
```

### 3. 데이터베이스 초기화

```bash
# Prisma 마이그레이션 실행
npx prisma migrate dev

# 시드 데이터 생성
npx prisma db seed
```

### 4. 개발 서버 실행

```bash
# Nx 워크스페이스 빌드
pnpm nx run-many --target=build --all

# 개발 서버 시작
pnpm nx serve api
```

### 5. 크롤링 테스트

```bash
# Docker Compose로 모든 서비스 시작
cd docker
docker-compose up -d

# API 서버 시작 (별도 터미널)
pnpm nx serve api

# 테스트 크롤링 실행 (API 호출)
curl -X POST http://localhost:3001/api/crawl/test

# 크롤링 상태 모니터링
open http://localhost:3001/admin/queues
```

## 📊 데이터베이스 스키마

### 핵심 엔티티

- **Source**: 크롤링 대상 사이트 정보
- **Content**: 수집된 콘텐츠 (기사, 포스트 등)
- **Analysis**: 분석 결과 (정치성향, 감정 등)
- **User**: 시스템 사용자
- **Job**: 크롤링/분석 작업 큐

## 🗺️ 개발 로드맵

### Phase 1: MVP ✅ (진행중)

- [x] 프로젝트 인프라 설정
- [x] 데이터베이스 스키마 구현
- [x] BaseCrawler 프레임워크
- [x] 단일 뉴스 사이트 크롤러
- [x] 기본 Admin UI
- [x] Job Queue 시스템 (BullMQ)
- [x] Bull Board 모니터링

### Phase 2: 멀티 소스 지원

- [ ] 3개 주요 신문사 크롤러
- [ ] DC인사이드/클리앙 크롤러
- [ ] 중복 제거 시스템
- [ ] 크롤러 모니터링

### Phase 3: NLP 분석 기능

- [ ] KoBERT 정치 성향 분석
- [ ] 감정 분석 모델
- [ ] Elasticsearch 통합
- [ ] 실시간 대시보드

### Phase 4: 확장 및 최적화

- [ ] 분산 크롤링 시스템
- [ ] API 플랫폼 구축
- [ ] 고급 시각화
- [ ] 성능 최적화

### Phase 5: 엔터프라이즈

- [ ] 다중 테넌트 지원
- [ ] SSO 및 2FA
- [ ] AI 기반 자동 요약
- [ ] 플러그인 시스템

## 🔧 Task Master 통합

Lighthouse는 Task Master AI를 통해 PRD 기반 작업 관리를 수행합니다.

### 현재 작업 상태

```bash
# 다음 작업 확인
npx task-master next

# 작업 상세 보기
npx task-master show <id>

# 작업 완료 표시
npx task-master set-status --id=<id> --status=done
```

### 작업 통계

- **총 작업**: 11개 메인 태스크
- **서브태스크**: 35개 이상
- **현재 진행**: 인프라 설정 및 데이터베이스 스키마

## 🔌 API 문서

### 인증

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password"
}
```

### 크롤링 작업

```http
# 테스트 크롤링 실행
POST /api/crawl/test

# 배치 크롤링
POST /api/crawl/test-batch
{
  "urls": [
    "https://www.yna.co.kr",
    "https://www.hani.co.kr"
  ]
}

# 큐에 크롤링 작업 추가
POST /api/queues/crawl/jobs
{
  "sourceId": "test-1",
  "source": {
    "url": "https://example.com",
    "type": "NEWS",
    "name": "Example News"
  },
  "priority": 5
}
```

### 콘텐츠 검색

```http
GET /api/contents/search?q=keyword&from=2024-01-01
Authorization: Bearer <token>
```

## 👨‍💻 개발 가이드

### 새 크롤러 추가

1. `libs/crawler-core/src/crawlers/` 디렉토리에 새 크롤러 클래스 생성
2. `BaseCrawler` 클래스 상속
3. `parseContent()` 및 `validateResponse()` 메서드 구현
4. 크롤러 팩토리에 등록

```typescript
// libs/crawler-core/src/crawlers/NewsCrawler.ts
export class NewsCrawler extends BaseCrawler {
  async parseContent(html: string): Promise<ParsedContent> {
    // 파싱 로직 구현
  }
}
```

### 테스트 실행

```bash
# 유닛 테스트
pnpm nx test crawler-core

# E2E 테스트
pnpm nx e2e api-e2e

# 모든 테스트
pnpm nx run-many --target=test --all
```

## 📚 문서

- [API 문서](./docs/api.md)
- [크롤러 가이드](./docs/crawler.md)
- [분석기 가이드](./docs/analyzer.md)
- [배포 가이드](./docs/deployment.md)

## ⚖️ 법적 고려사항

- **robots.txt 준수**: 모든 크롤러는 robots.txt 정책을 준수합니다
- **저작권**: 수집된 콘텐츠의 저작권은 원 저작자에게 있습니다
- **개인정보보호**: KISA 개인정보보호 가이드라인 준수
- **Rate Limiting**: 대상 서버에 부하를 주지 않도록 요청 속도 제한

## 🤝 기여하기

기여를 환영합니다! PR을 제출하기 전에 다음 사항을 확인해주세요:

1. 코드 스타일 가이드 준수
2. 테스트 작성 및 통과
3. 문서 업데이트
4. PR 템플릿 작성

## 📄 라이선스

MIT License

---

**Built with ❤️ for Real-time Korean Content Analysis**
