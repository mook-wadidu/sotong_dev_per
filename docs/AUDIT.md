# 소통(Sotong) 보안·UX 종합 감사 (정적)

작성일: 2026-06-15 · 렌즈: Red×4, Blue×3(+1), UX×2 · 교차검증 완료(코드 직접 확인)

> 검증 환경 확인: `.env.local`/`.env.hosted` 의 `DB_DRIVER=supabase` 이고 두 파일 모두 `SOTONG_ENTRY_SECRET`·`SOTONG_ADMIN_TOKEN` 이 **없다**(grep 0건). 즉 "supabase 운영 + 기본 시크릿 가동" 이 가설이 아니라 **현재 설정 그대로의 배포 결과**다. 이 사실이 다수 P0 를 가설에서 확정으로 끌어올린다.

---

## ① 총평 / Verdict

**지금 배포하면 안 된다.** 확정된 배포 차단(P0)이 보안 6건 + 프라이버시 1건 + 신뢰성 1건 존재한다. 코드의 인증/HMAC/RLS/마스킹 **설계 자체는 견고**하나(timingSafeEqual, force RLS default-deny, stripPhone/maskPhone, AI mock 폴백), **시크릿 관리·토큰 노출·운영(supabase) 전환 결손·법적 고지** 에서 치명적 구멍이 겹쳐 있다. 특히 (a) 공개 홈이 어드민 키를 HTML 에 그대로 박고, (b) 그 키가 운영 env 누락으로 공개 기본값 `sotong-dev-admin` 으로 가동되며, (c) push_subscriptions RLS 가 service_role 자신까지 막아 알림이 전면 장애 — 이 세 개만으로도 출시 불가.

거짓경보/이미 방어된 항목도 분명히 있다(§⑤). 클래식 XSS, RLS 격리, PII 마스킹, CSRF(App Router 기본 Origin 검증)는 대체로 막혀 있어 그쪽에 시간을 쓸 필요는 없다.

---

## ② 배포 전 Must-Fix (보안 우선)

순서 = 권장 처리 순서.

1. **랜딩 어드민키 노출 제거** — `src/app/[locale]/page.tsx:96` 의 `href={adminPath(config.adminToken)}` 를 키 없는 `/ko/admin`(이미 존재하는 키 입력 게이트)로 교체.
2. **시크릿 fail-fast 가드** — `src/lib/config.ts:22,25` 기본값 제거 + production 에서 `SOTONG_ENTRY_SECRET`/`SOTONG_ADMIN_TOKEN` 미설정·기본값이면 부팅 throw. 동시에 운영 env(.env.local/.env.hosted/Vercel)에 `openssl rand -base64 32` 급 랜덤 주입. 노출된 기본값 회전.
3. **ownerToken 클라 유출 차단** — `getSalon`/`getSalonByEntry`(`src/lib/actions.ts:46,51`)가 반환하는 Salon 에서 ownerToken 제거(PublicSalon 투영). `getCustomerView`/`getDesignerView`/`getSalonInfoByEntry`(service.ts) 동일 적용.
4. **seed 토큰 격리·회전** — `supabase/seed.sql:34,41,57-60` 고정 평문 토큰을 dev 전용으로, 운영 reset 경로에서 분리(`supabase/config.toml` `[db.seed]`). 공개된 토큰 운영 회전.
5. **push_subscriptions RLS 정책 추가** — `supabase/migrations/0002_push_subscriptions.sql` 에 `create policy ... for all to service_role using(true) with check(true)` 추가(또는 0001 tables 배열에 흡수).
6. **무인증/토큰 엔드포인트 레이트리밋** — `getMessagesSince`·`completeConsultation`·`getReportView`·`getIntakeMenu`·`saveDesignerPush` 에 상한 추가. supabase 운영이므로 인메모리 대신 공유 스토어/엣지 전역 상한.
7. **사진 dataURL 서버 검증** — `startConsultation`/`completeConsultation` 입력 경계에서 개수≤5·길이 상한·`data:image/(jpeg|png|webp)` 화이트리스트(svg+xml 거부).
8. **프라이버시(PIPA)** — 보유기간·파기 잡 구현 또는 동의문구 정정 + Gemini 국외이전·제3자 위탁 고지 추가.
9. **Gemini fetch 타임아웃** — `src/lib/ai/gemini.ts:139` 에 AbortController(8~10s).
10. **보안 헤더 + 콘솔/어드민 경로 헤더** — `next.config.ts` 에 CSP(`frame-ancestors 'none'`, `img-src 'self' data:`, `script-src 'self'`)·X-Frame-Options·nosniff, 그리고 `/:locale/admin`·`/:locale/s/:path*` 에 no-referrer+noindex. (P1 이나 같이 처리 권장)

---

## ③ 보안 우선순위 표 (Red / Blue 병합)

| 우선 | 문제 | 시나리오 | 파일 | 수정 | 배포전필수 |
|---|---|---|---|---|---|
| **P0** | 공개 랜딩이 adminToken 을 링크 href 로 렌더 | 홈 소스 → 키 취득 → getAdminData 통과 → 전 지점 PII·전 QR 토큰·살롱/디자이너 무단 생성 | `src/app/[locale]/page.tsx:96` | 키 없는 `/ko/admin` 게이트로 교체 | 예 |
| **P0** | entrySecret/adminToken 기본값 하드코딩 + 운영 env 누락(확인됨) + 가드 0 | 기본 entrySecret 으로 임의 입장토큰 위조, `?key=sotong-dev-admin` 으로 어드민 전권 | `src/lib/config.ts:22,25` / `.env.local`·`.env.hosted`(SOTONG_* 0건) | 기본값 제거 + production throw 가드 + env 주입·회전 | 예 |
| **P0** | ownerToken(어드민 동급 비밀)이 무인증 서버액션으로 클라 유출 | `getSalon("salon-demo")`/`getSalonByEntry(token)` 직접 호출 → ownerToken → `/ko/s/{ownerToken}` 콘솔 탈취(손님→오너 수직상승) | `src/lib/actions.ts:46,51` / `src/lib/service.ts:530,539` | PublicSalon 투영으로 ownerToken strip | 예 |
| **P0** | owner/staff 토큰이 seed·memory 에 고정 평문(공개 repo) | 공개값 `owner_sinsa_a1b2c3d4e5f6` 등으로 콘솔/인박스 장악. upsert 라 재시드해도 유지 | `supabase/seed.sql:34,41,57-60` / `src/lib/db/memory.ts` | dev 전용 격리, 운영 분리, 회전 | 예 |
| **P0** | push_subscriptions FORCE RLS + service_role 정책 부재 → service_role 자신도 차단 | 운영(supabase) 전환 후 푸시 저장/조회 전부 throw, notifyDesigner/saveDesignerPush 가 에러 삼켜 알림 무음 장애 | `supabase/migrations/0002_push_subscriptions.sql:16-18` | service_role 허용 policy 추가(0001 배열 흡수 권장) | 예 |
| **P0** | 폴링·리포트·완료·메뉴·푸시구독 등 무인증/토큰 엔드포인트 레이트리밋 전무 | 폴링(2쿼리/회) 폭주로 커넥션풀 고갈, completeConsultation 반복으로 Gemini draftReport 과금 | `src/lib/service.ts:729,744,812,297,132` | 각 엔드포인트 상한 + 공유스토어/엣지 전역 상한 | 예 |
| **P0** | 사진 dataURL 개수·크기·MIME 서버 검증 0 | 서버액션 직접 호출로 거대/임의 dataURL 무제한 저장 → jsonb row·스토리지·대역 폭증 | `src/lib/service.ts:404-449,744-794` | 개수≤5·길이상한·MIME 화이트리스트(svg 거부) | 예 |
| **P0**(privacy) | 파기정책 미구현인데 동의문은 "일정 기간 후 파기" 약속(허위고지) | 6개월 뒤에도 사진·전화 잔존, 파기요청 처리 경로 0 → PIPA 파기·고지 위반 | `src/messages/ko/customer.json:79` / 마이그레이션·repo(파기잡 없음) | 보유기간+파기 잡 구현 또는 문구 정정 | 예 |
| **P0**(privacy) | Gemini(Google, 국외) 전송에 국외이전·제3자 위탁 고지 0건 | 알레르기 메모·전체 채팅 원문이 고지 없이 해외 전송 | `src/lib/ai/gemini.ts:113-156` / `src/lib/service.ts:603` | 고지/동의 항목 추가(국외이전·위탁) | 예 |
| **P0**(reliability) | Gemini fetch 타임아웃·AbortSignal 부재 → 지연 시 mock 폴백 미작동 hang | 운영 AI 지연 순간 인테이크/메시지/리포트가 무한 await, 손님 무한 스피너 | `src/lib/ai/gemini.ts:139` | AbortController 8~10s | 예 |
| **P1** | 보안 헤더(CSP/X-Frame-Options/nosniff) 전무 + admin/콘솔 경로 no-referrer/noindex 미적용 | clickjacking 으로 완료/배정 유도클릭, 토큰 URL Referer·색인 누출 | `next.config.ts:10-28` | 전역 CSP·XFO·nosniff + s/admin 경로 토큰헤더, remotePatterns 축소 | 권장(P0와 동시) |
| **P1** | entryKeyVersion 회전(QR 폐기) 코드 부재 — 검증은 정상이나 증가 경로 0 | 유출 QR·퇴사 직원 토큰 무기한 유효, 앱으로 폐기 불가 | `src/lib/service.ts:1296` 등 | 오너/어드민에 버전+1 재발급 액션 | 권장 |
| **P1** | 손님 자유텍스트 프롬프트 인젝션 → 요약/안전주의 조작 | 알레르기 메모에 지시문 삽입 → hairCautions 에서 경고 제거 → 패치테스트 누락 위험 | `src/lib/ai/prompts.ts:62-64,165` | 펜스+sentinel, 알레르기 등 안전필드는 구조화 입력으로 결정론 머지 | 권장 |
| **P1** | 인테이크 레이트리밋 키가 살롱 공용 QR → 공유 카운터 DoS | 공격자 8회/분으로 그 QR 전체 접수 차단 | `src/lib/service.ts:418` | IP+토큰 조합 키, 매장/클라 상한 분리 | 아니오 |
| **P1** | 인메모리 레이트리밋이 supabase+서버리스 다중인스턴스에서 무력 + 5000키 초과 전체 clear | 인스턴스 분산으로 상한 ×N, GC 가 전체 카운터 리셋 | `src/lib/service.ts:58-102` | 공유스토어 이전, GC 를 만료버킷만 부분삭제로 | 권장(운영 전제라 사실상 P0급) |
| **P1** | 0001 RLS 루프 배열에 push_subscriptions 누락 | 향후 새 테이블 동일 누락 시 anon REST 노출 회귀 | `supabase/migrations/0001_core.sql:416-425` | 배열 흡수 + CI 검증(rowsecurity/policy) | 권장 |
| **P1** | service_role 등 실키가 평문 .env.local·.env.hosted 사본 2개로 디스크 상주 | 디렉터리 공유/오커밋 시 RLS 우회 전권 유출 | `.env.local`, `.env.hosted` | 사본 삭제·플랫폼 시크릿 스토어, 노출 가정 키 회전 | 권장 |
| **P1** | startConsultation 부분 실패 → intake 고아행 + 재시도 중복 상담 | DB/AI 예외 시 행은 남고 토큰 미반환, 손님 재제출로 중복 | `src/lib/service.ts:441` | 요약 산출 후 insert 또는 토큰 선반환·요약 지연 | 아니오 |
| **P1** | notifyDesigner 를 인테이크 응답 경로에서 동기 await | 느린 푸시가 손님 접수완료 지연으로 전가 | `src/lib/service.ts:492` | fire-and-forget(after/waitUntil)+sendWebPush 타임아웃 | 아니오 |
| **P1** | 폴 커서 strict gt(created_at) — 동일 타임스탬프 메시지 누락 가능 | 칩 연타로 같은 created_at 시 한 메시지 영구 누락 | `src/lib/db/supabase.ts:662` | (created_at,id) keyset 커서 | 아니오 |
| **P2** | report 토큰 64bit + 만료/단발성 없음(capability URL 영속) | 리포트 링크 공유 시 before/after 사진 무기한 열람 | `src/lib/service.ts:782,838` | token() 192bit 통일 + TTL/폐기 | 아니오 |
| **P2** | 어드민 단일 공유키 — 감사·회전·blast radius | 1명 유출 = 전 지점 + 전 QR 토큰 | `src/lib/entry.ts:47-50` | 다중계정·감사로그(MVP 후) | 아니오 |
| **P2** | salon-qr document.write blacklist 살균 | `<>&"` 제거로 태그 브레이크아웃은 막힘, 패턴 취약 | `src/components/admin/salon-qr.tsx:51-77` | textContent/엔티티 인코딩 | 아니오 |
| **P2** | error_logs detail 토큰 단편 장기 적재 | 유출 시 내부구조 추론 일부 | `src/lib/service.ts:360` 등 | 파기 대상 포함 + 해시화 | 아니오 |
| **P2** | getRepo/getAi 무음 폴백 — supabase env 오타 시 MemoryRepo 로 조용히 가동 | 운영인데 휘발성 메모리 저장, 재시작 시 손실 | `src/lib/db/index.ts:13` | supabase 인데 client null 이면 throw | 아니오 |

---

## ④ UX 우선순위 표

| 우선 | 문제 | 시나리오 | 파일 | 수정 | 배포전필수 |
|---|---|---|---|---|---|
| **P1** | 인박스(D1) 비실시간 — 새 손님 와도 화면 미갱신 | 알림 못 켠 iOS 디자이너가 대기 손님을 영영 인지 못 함 | `src/app/[locale]/d/inbox/[staffToken]/page.tsx` | 경량 폴링/router.refresh 또는 새로고침 버튼(POLL_MS 패턴 재사용) | 예 |
| **P1** | 디자이너 플로우에 인박스 복귀/뒤로 경로 전무(PWA standalone 데드엔드) | 요약 진입 후 다른 손님으로 못 감, standalone 엔 브라우저 back 도 없음 | `src/app/[locale]/d/summary/[token]/page.tsx:71-77` | getDesignerView 에 staffToken 포함 → 헤더 leading 백버튼/인박스 링크 | 예 |
| **P1** | 8스텝 인테이크 draft 영속화 부재 | 사진 권한 팝업·앱 전환·새로고침에 입력 전체 소실 → 이탈 | `src/components/customer/intake-stepper.tsx:114` | entryToken 키로 sessionStorage 디바운스 저장·복원(최소 텍스트/step) | 예(이탈 직결) |
| **P1** | 토스트 success/error 가 색·아이콘 없이 문구로만 구분 | 전송 실패를 성공으로 오인해 상담 누락 | `src/components/ui/toast.tsx:10-30` | error/success 아이콘·형태 구분 | 아니오 |
| **P1** | 리포트 콘텐츠 언어와 html lang 불일치 | ja 리포트가 /ko URL 로 열리면 자형 깨짐·스크린리더 오독 | `src/app/[locale]/c/r/[token]/page.tsx:26-50` | 컨테이너 lang={report.locale} 또는 locale redirect | 아니오 |
| **P2** | 진행률 '3/8' 가시 숫자 없음(세그먼트 막대만) | 8스텝 길이 인지 약해 중도 이탈 | `src/components/customer/intake-stepper.tsx:192` | stepOf 텍스트 노출(번역 기존재) | 아니오 |
| **P2** | Sheet 닫기 aria-label 'Close' 영어 하드코딩 | ja/ko 스크린리더 영어 고정 | `src/components/ui/sheet.tsx:56` | closeLabel prop + i18n | 아니오 |
| **P2** | 스레드 퀵리플라이 18칩 평면 나열 | 시술 중 가격/시간 칩 탐색비용 | `src/components/designer/designer-thread.tsx:277` | 그룹/빈도순·status 기반 우선노출 | 아니오 |
| **P2** | '종료' CTA 의미 모호 + 무확인 진입, 빈 리포트 발송 가능 | 대화종료 오인, 빈 폼 발송으로 빈 리포트 전송 | `src/components/designer/designer-thread.tsx:266` / `record-form.tsx:109` | 라벨 명확화 + 최소1필드 가드/확인 | 아니오 |
| **P2** | D2 헤드라인 폴백이 raw serviceId 노출 | AI 요약 실패 시 'cut_women' 등 식별자 제목 | `src/app/[locale]/d/summary/[token]/page.tsx:83` | serviceLabels(ids,'ko') 사용 | 아니오 |
| **P2** | iOS 미설치/차단 시 알림 켜기 동선 사실상 없음 | iOS 디자이너 알림 OFF·인박스 정지 결합 | `src/components/designer/notification-setup.tsx:140` | 설치 가이드 강화 + P1 폴링으로 보완 | 아니오 |
| **P2** | 칩/가격/시간 전송 실패가 토스트만 — 재시도 단서 없음 | 시끄러운 살롱서 토스트 놓쳐 미전달 인지 못 함 | `src/components/designer/designer-thread.tsx:204` | 실패 버블+재시도(custom onError 패턴 일반화) | 아니오 |
| **P2** | 사진 리사이즈 실패가 파일마다 토스트, 부분 누락 인지 어려움 | HEIC 일부 실패로 사진 빠진 채 진행 | `src/components/customer/intake-stepper.tsx:393` | 성공/실패 집계 1회 토스트 | 아니오 |
| **P2** | ProgressSteps 미완료 트랙 대비 미달, 선택 Chip 색외 신호 약함, disabled 버튼 피드백 부재, MessageBubble 원문 가독 약함, 미사용 i18n 키 잔존 | 저시력/흑백 UI 가독·선택 인지 저하 | `progress-steps.tsx:41`, `chip.tsx:62`, `button.tsx:6`, `message-bubble.tsx:57`, `customer.json` | 대비/두께 상향, 원문 알파/크기 상향, 죽은 키 정리 | 아니오 |

---

## ⑤ 이미 방어됨 / 기각된 거짓경보

교차검증에서 **악용 불가 또는 이미 방어된** 것으로 판정해 우선순위에서 내린 항목.

1. **"이미지 dataURL → stored XSS 승격"(Red injection P1)** — *XSS 부분은 기각, 검증누락은 P0로 흡수.* `dangerouslySetInnerHTML` 사용처 0건 확인, 싱크는 전부 `<img src>` 뿐. 브라우저는 `<img>` 의 `data:image/svg+xml` 에서 스크립트를 실행하지 않는다. "향후 다른 컨텍스트로 흐르면" 은 가정. 단, **dataURL 무검증 저장 자체는 abuse/cost(P0)로 실재**하므로 그쪽으로 병합(검증은 어차피 해야 함). 활성 stored XSS 로 시간 쓸 필요 없음.

2. **"RLS GRANT 단계 차단" 주석 부정확(Red tenancy P2)** — *실위험 기각, 문서 정확성만.* enable+force RLS + anon/authenticated 무정책으로 default-deny 가 행을 0건 반환하므로 잔존 GRANT 가 있어도 노출 없음. 코드로 RLS 일괄 적용 확인. 주석만 수정하면 됨(심층방어로 REVOKE 추가는 선택).

3. **salon-qr document.write(Red injection P2)** — *즉시 XSS 기각.* `<>&"` strip 으로 태그 브레이크아웃 차단 확인. 패턴이 깨지기 쉬운 건 사실이라 P2 위생 항목으로만 유지, 배포 차단 아님.

4. **CSRF(서버액션)** — Next App Router 의 기본 Origin 검증·POST 전용으로 일부 완화됨. 단 토큰이 URL 에 실리는 모델이라 헤더 보강(CSP/no-referrer)으로 보완 — 이는 §③ P1 헤더 항목으로 처리.

5. **"getCustomerView/getDesignerView 가 salon 전체 반환"(Red tenancy P0 부수)** — *직접 클라 유출 경로는 아님.* 이 둘은 `server-only` service 함수라 서버컴포넌트 경유로만 호출되고 ja/ko 페이지는 name 만 렌더한다. 클라가 직접 호출 가능한 진짜 유출은 `"use server"` 액션 `getSalon`/`getSalonByEntry` 다. 다만 ownerToken 을 굳이 실어 보내는 구조 위험은 동일하므로 같은 PublicSalon 투영 수정에 함께 흡수(별도 P0 아님).

6. **PII 마스킹·동의 게이트·AI mock 폴백·HMAC 검증 자체** — 정상 구현 확인. stripPhone/maskPhone, consentedAt 서버 재검증, timingSafeEqual, randomBytes(24) 무인증 토큰(192bit)은 견고. 손볼 필요 없음(단, mock 폴백은 timeout 없으면 hang 하므로 §③ reliability P0 와 별개).

---

### 참고: 확정의 핵심 근거(코드 직접 확인)
- `.env.local`/`.env.hosted`: `DB_DRIVER=supabase`, `SOTONG_*` 0건 → 기본 시크릿 가동이 현 설정의 실제 결과.
- `page.tsx:96` `adminPath(config.adminToken)` 렌더, `config.ts:22,25` 기본값, 가드 grep 0건.
- `actions.ts:46,51` "use server" + `service.ts:530,544` 풀 Salon(ownerToken 포함) 반환.
- `0002_push_subscriptions.sql:16-18` force RLS + grant 만, policy 없음. `0001` tables 배열에 push_subscriptions 부재.
- `enforceRate` 호출처 line 418/630 둘뿐. `gemini.ts:139` fetch 에 signal 없음. 파기/cron/entryKeyVersion 증가 코드 grep 0건.
---

## 메인 직접 검증 (스팟체크) — 2026-06-15

| 항목 | 결과 |
|---|---|
| **P0 어드민 키 노출** (`page.tsx`) | ✅ **확정(치명)** — `/ko` 홈 HTML에 `/ko/admin?key=sotong-dev-admin` 그대로 렌더됨. 누구나 홈만 봐도 어드민 키 취득. |
| **anon 공개키로 PII 직접 읽기 (RLS)** | ✅ **방어 정상** — anon 키로 `consultations` REST 호출 시 HTTP 200 `[]`(빈 배열). RLS default-deny 작동. |
| **0002 push_subscriptions RLS → 푸시 장애 P0** | ❌ **거짓경보** — service_role은 BYPASSRLS라 force RLS여도 통과. 실제 구독 저장/조회/웹푸시 201 모두 정상 동작 확인(행수 1). |
| **ownerToken/staffToken 클라 노출** (C1 진입) | ⚠️ **현재 미노출** — `/c/e/{token}` 렌더 HTML에 owner_/staff_ 토큰 없음. 다만 `Salon` 투영에 ownerToken이 포함돼 있어 향후 누출 위험은 있으니 PublicSalon 투영으로 방어(P1로 강등). |

요약: 합성이 P0로 올린 것 중 **푸시 RLS는 거짓경보, ownerToken 노출은 현재 미발생(P1 예방)**. 그 외 어드민 키 노출·기본 시크릿·시드 평문 토큰·레이트리밋·사진 검증·PIPA·Gemini 타임아웃은 유효한 배포 차단 이슈.
