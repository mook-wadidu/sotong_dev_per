# 소통 (Sotong)

> 외국인 워크인 손님을 받는 한국 살롱·메이크업 스튜디오를 위한 **다국어 AI 상담·접수 데스크**.
> *손님은 자기 언어로 탭하고, 디자이너는 한국어 요약을 받는다.*

손님이 입구의 QR을 찍어 자기 언어(日/EN/한)로 원하는 시술·고민을 탭하면, AI가 이를 한국어로 요약해 디자이너에게 전달하고, 양방향 번역 상담을 거쳐 시술 후 "헤어 인바디" 리포트까지 손님 언어로 발송한다. 어드민은 지점별 QR·문의·발생 에러를 한 화면에서 본다.

## 빠른 시작 (제로 셋업)

기본값은 **인메모리 DB + mock AI** 라 docker·API 키 없이 바로 돈다.

```bash
pnpm install
pnpm dev      # http://localhost:3000
```

### 데모 동선
- **허브**: `/ko` (또는 `/ja`, `/en`) — 손님 체험 / 어드민 진입
- **어드민**: `/ko/admin?key=sotong-dev-admin` — 지점별 **QR** + **문의사항** + **발생 에러** 탭. QR 카드의 링크가 곧 손님 입장 URL.
- **손님(QR 입장)**: 어드민 QR 탭의 링크, 또는 데모 토큰
  `/ja/c/e/c2Fsb24tZGVtby52MQ.3KcGNlCXLHbKQq-eUuINpVyPeYP1Ux6ibP1AZ4qvi1w`
  → 언어선택 → 인테이크(탭) → 제출 → 상담 스레드
- **디자이너 인박스**(멀티세션): `/ko/d/inbox/staff_demo_2b9f5c1a4e7d8063af21`
  → 손님 요약(D2) → 시술 시작 → 상담 스레드(칩 응답) → 30초 기록 → 리포트 발송
- 한 PC에서 손님 탭 + 디자이너/어드민 탭을 함께 열면 번역 상담이 폴링으로 오간다(인메모리는 단일 프로세스 공유).

## 핵심 루프
`QR 입장 → 언어선택(C1) → 탭 인테이크(C2) → AI 한국어 요약(D2) → 양방향 번역 상담(C3/D3) → 시술 기록·리포트(D5/C4)`

## 스택
- **Next.js 16** App Router · TypeScript · **Tailwind v4** + 자체 디자인 시스템(`src/components/ui`)
- **next-intl** 3계층 i18n (ko 피벗 · 노출 ja/en/ko)
- **Supabase**(Postgres·RLS) — 선택. AI는 **Google Gemini** — 선택.
- 드라이버 스위치: `@/lib/db`(memory|supabase), `@/lib/ai`(mock|gemini). 미설정 시 자동으로 memory+mock.

## 실서비스 연동 (선택)
`.env.local` (예시는 `.env.local.example`):

```bash
# Supabase
DB_DRIVER=supabase
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
# Gemini
GEMINI_API_KEY=...        # 있으면 자동으로 gemini provider 사용
# 보안 (운영 필수 교체)
SOTONG_ENTRY_SECRET=...   # QR 입장 토큰 HMAC 서명
SOTONG_ADMIN_TOKEN=...    # 어드민 접근 키
```

```bash
supabase start && supabase db reset   # migrations/0001_core.sql + seed.sql 적용
```

## 보안·접근성 (피드백 반영)
- **QR = 입장권**: 손님 URL에 살롱 slug를 노출하지 않고 **HMAC 서명 entry_token**만 사용. 위조/추측 차단, `entryKeyVersion`으로 폐기·회전. `submitIntake`는 entryToken만 신뢰(클라 slug 미수신).
- **어드민 인증 게이트** + 목록 PII 마스킹(전화 뒤 4자리, 사진 dataURL 제외). 토큰 경로에 `Referrer-Policy: no-referrer` + `X-Robots-Tag: noindex`.
- **개인정보 동의 게이트** + 전화번호 선택(관광객 배려). 레이트리밋.
- WCAG: 대비 토큰 분리(accent-strong/text), focus-visible, `prefers-reduced-motion`, 핀치줌 허용, RadioGroup/ToggleGroup 시맨틱, aria-live 스레드.

## 검증
- `pnpm build` 그린(TS 통과), `pnpm lint` 0 problems, 11개 라우트 컴파일.
- 런타임 스모크: 허브·C1·C2·C3·어드민(키/무키)·디자이너 인박스 전부 HTTP 200, 무효 토큰 친절 안내, 토큰 경로 보안 헤더 적용 확인.

## 문서
- [`docs/AGENTS_CONTRACT.md`](docs/AGENTS_CONTRACT.md) — 모듈 계약(API·라우팅·UI 키트·규칙)
- [`docs/FEEDBACK.md`](docs/FEEDBACK.md) — 세계최고 디자이너·사용자 패널 1차 피드백(P0/P1/P2)
- [`docs/FEEDBACK_FINAL.md`](docs/FEEDBACK_FINAL.md) — 실물 재리뷰 결과(해결/잔여)
- `소통 서비스 마스터 문서`(PRD) — 제품 전체 정의

## 구조
```
src/
  app/[locale]/
    page.tsx                   # 허브
    c/e/[token]/(.../intake)    # 손님 C1 언어선택 · C2 인테이크
    c/t/[token] · c/r/[token]   # C3 상담 스레드 · C4 리포트
    d/inbox/[staffToken]        # 디자이너 인박스
    d/summary|t|report/[token]  # D2 요약 · D3 스레드 · D5 기록·리포트
    admin/                      # 운영 대시보드(QR·문의·에러)
  components/ui/                # 디자인 시스템
  components/{customer,designer,admin}/
  lib/  domain · catalog · db(memory|supabase) · ai(mock|gemini) · service · actions · entry · links · config
  messages/{ko,ja,en}/{common,customer,designer,admin}.json
supabase/ migrations · seed.sql
```

## 현재 범위
- ✅ v1 핵심 루프(접수→요약→번역 상담→리포트), 어드민(지점 QR·문의·에러), 다국어, 보안·접근성 베이스라인 — 동작.
- 🔜 회원 "지난번처럼", 대기시간 스타일 분석, 예약·결제, 카카오 알림톡 실연동, 셀프 온보딩.
