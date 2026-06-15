# 소통(Sotong) — Phase 2 실물 화면 재리뷰 종합 (FEEDBACK_FINAL)

> 4개 패널(정확성·핵심루프 / 디자인·DS / UX·접근성 / QR·보안)의 실물 재리뷰를 종합하고, 모든 판정을 **현재 코드로 직접 재검증**한 결과입니다. 빌드(`pnpm build`)는 TypeScript 통과·9 static pages·11 라우트 컴파일 에러 0 으로 클린합니다.

## 한줄 결론 (데모 가능 여부)

**데모 가능.** 빌드가 클린하고 핵심 루프(QR 진입 → 인테이크 → 상담 → 리포트)와 FEEDBACK 의 P0 보안/접근성 쇼스토퍼는 전부 해결됐습니다. 다만 **디자이너 → 손님 메시지 경로에 정확성 P1 3건**(퀵리플라이 intent 충돌·가격 한국어 누출·폴링 커서 누락)이 살아 있어, "양국어 대화"를 라이브로 시연한다면 시연 전 픽스를 권장합니다. QR/인테이크/리포트 위주 데모라면 현 상태로 충분합니다.

---

## 1. 원 P0/P1 처리 현황

### 해결됨 (Resolved) — 요약

**보안·진입 (P0-1/2/3, P0-10 일부)**
- QR 평문 slug → 서명 entry_token 전환 완료. `/{locale}/c/e/{entryToken}`, `submitIntake` 에서 `salonSlug` 인자 제거, `startConsultation` 이 `verifyEntryToken` 성공 시에만 slug 확정 (`entry.ts:11-33`, `service.ts:131-141`). 데모 토큰 HMAC 재현 일치 확인.
- 어드민 상수시간 키 게이트 + 무효키 인증오류 화면, 목록 phone 4자리 마스킹·사진 dataURL 제외 (`service.ts:538-550`).
- 메시지/인테이크 레이트리밋(8/분·30/분) 적용.

**접근성 쇼스토퍼 (P0-6/7/8, P1-20/23/24/30/31)**
- Chip/PictoChip/LanguageButton focus-visible 링 + role=radio/checkbox·aria-checked·색외신호.
- prefers-reduced-motion 전역 가드(탭 피드백만 유지), viewport maximumScale 제거(핀치줌 허용).
- RadioGroup/ToggleGroup 방향키·Home/End, ProgressSteps role=progressbar, FormField aria-describedby/invalid/required, error.tsx i18n.

**인테이크·도메인 (P0-4/5/11/12/13)**
- 전화 옵셔널 + '연락처 없음' 옵트아웃, 동의 게이트 이중(FE canSubmit + 서버 consentedAt).
- price/time 자유 타이핑 제거 → 프리셋·자동 프리필 Sheet, 응답 칩 6 → 17종, 멀티세션 인박스 추가.

**디자인·i18n (P1-14/15/16/22/43/45, P2-58/66)**
- accent-text/accent-strong 토큰 분리, 화면 임의 hex 0건, me 말풍선 대비 회복.
- 9개 빈 네임스페이스 ko/ja/en 전부 채움 + ko 폴백, 홈 `<a><button>` 중첩 제거.

### 부분 해결 (Partial)
- **P1-18 가격 한국어 누출** — 인테이크 경로는 `formatPrice` 로 막았으나, **디자이너 가격 퀵리플라이 경로로 재유출**(아래 잔여 P1).
- **P0-10 레이트리밋** — submit/sendMessage 에만 적용. 진입 검증 GET·`proxy.ts` 는 미적용, in-memory 라 멀티인스턴스 전환 시 무력화.
- **어드민 키 URL 노출** — 인증은 닫혔으나 `?key=` 쿼리로 흘러 히스토리/로그/referer 2차 노출 여지.

### 미해결 (Outstanding)
- **P1-44 손님 화면 상시 언어 전환 칩 부재** (C2~C4) — 잘못 고른 언어 복구 불가(QR 재스캔뿐). ScreenHeader trailing 슬롯은 비어 있어 추가 가능.
- **entry_token version 대조·만료 부재** — 정적 QR 유출 시 폐기 수단 없음.
- **Referrer-Policy 헤더 부재** — 토큰 referer 누출 벡터.
- **P2-54 픽토그램 이모지**, **P2-46 shadow/radius 단조** — DS 마감, MVP 수용 가능.
- **P2-60 isReturning 하드코딩(false)** — 재방문 분기 미배선(`intake-stepper.tsx:119`).

---

## 2. 잔여 우선순위 (실물 new 이슈 포함)

### 잔여 P0 — 데모/요구사항 차단
**없음.** FEEDBACK 의 P0 는 전부 resolved 이고, 빌드·11 라우트 정상. 데모 자체를 막는 항목은 확인되지 않음.

### 잔여 P1 — 중요 (시연 전 권장 순)

| # | 항목 | 파일 + 구체 픽스 | 상태 |
|---|------|------------------|------|
| 1 | **퀵리플라이 intent 충돌** — 중복 intent 칩이 전부 첫 항목 메시지로 전송('마무리 단계'·'조금만 더'·'또 오세요' → 엉뚱한 문구가 양국어로 손님 전달) | `service.ts:319-336`(`find(q=>q.intent===input.intent)` 첫 항목만), `data.ts:346-391`(step_update 3·closing 2), `designer-thread.tsx:243-253`. 픽스: QUICK_REPLIES 에 고유 `replyId` 부여 → 칩이 send 에 replyId 전달 → postMessage 가 `find(q=>q.replyId===…)` 로 매칭(최소수정: 칩 index 전달) | new |
| 2 | **가격 한국어 누출(P1-18 재유출)** — ja/en 손님 말풍선에 '13만원'/'30,000원' 노출 | `designer-thread.tsx:37-44,163-168,305-313` → `service.ts:322-326`. 픽스: PRICE_PRESETS·프리필을 **won number**로, postMessage 가 `formatPrice(won, customerLocale)`(이미 존재, `catalog/index.ts:86`)로 치환. 디자이너 시트 라벨만 ko 유지 | partial |
| 3 | **폴링 커서 자기-전진으로 상대 메시지 영구 누락** | `designer-thread.tsx:139`·`customer-thread.tsx:57,92` → `memory.ts:187`·`supabase.ts:351-364`(strict `>`). 픽스: 필터를 `>=` 로 + seen Set dedupe(두 드라이버 동시), 또는 커서를 '도착분 createdAt'으로만 전진 | new |
| 4 | **entry_token version 미대조·만료 없음** — 유출 QR 폐기 불가 | `entry.ts:16-33`, `service.ts:219-229`, `db/types.ts:12-27`. 픽스: Salon 에 `entryKeyVersion` 추가 → 발급/검증 시 대조(불일치 거부), 어드민에서 version++ 폐기 | outstanding |
| 5 | **Referrer-Policy 헤더 부재** — 토큰 referer 누출 | `next.config.ts:6-10`. 픽스: `async headers()` 로 `Referrer-Policy: strict-origin-when-cross-origin`(C 경로 no-referrer) + 토큰 경로 noindex | outstanding |
| 6 | **손님 화면 상시 언어 전환 부재(P1-44)** — 잘못 고른 언어 복구 불가 | `mobile-frame.tsx` ScreenHeader trailing, `intake-stepper.tsx:134`·`customer-thread.tsx:120`·`report-view.tsx:84`. 픽스: trailing 에 공용 LocaleSwitch(같은 토큰 경로 다른 locale 로 router.replace), C2 는 draft 보존 | outstanding |
| 7 | **DataTable 데스크톱 행 키보드 불가(WCAG 2.1.1)** | `data-table.tsx:78-86`(`<tr onClick>` 에 tabIndex/role/onKeyDown 없음). 픽스: tabIndex=0·role='button'·onKeyDown(Enter/Space), 또는 '보기' 링크 셀 | new |
| 8 | **C3 thread.empty 상시 노출 + aria-live 초기 일괄 announce** | `customer-thread.tsx:131-162`. 픽스: empty 는 `messages.length===0` 일 때만, 초기 메시지는 live 밖 정적 영역 | new |
| 9 | **디자이너 send 실패 사일런트(텍스트 미복원·토스트 없음)** | `designer-thread.tsx:117-149,177-183`. 픽스: catch 에서 customText 복원 + toast.error(손님 스레드와 일치) | new |

> 주: P1-#1~3 은 모두 "디자이너가 보낸 의도 ≠ 손님이 받는 메시지" 라는 **대화 정확성**을 직접 해칩니다. 라이브 양국어 대화 데모를 한다면 최우선.

### 잔여 P2 (백로그)
- 신규 상담이 인박스에서 항상 '상담 중'으로 표시(`startConsultation` 이 즉시 `consulting` 전이, `service.ts:191-192`) — 인박스 분류 가치 약화. 픽스: 접수 직후 'intake' 유지 또는 라벨 매핑 합치기.
- isReturning 하드코딩 false, summary 국적 빈 배지, toast richColors 토큰 밖, sm h-9 손님 노출, 디자이너 스레드 ScreenHeader 미사용, QR DOM id 에 토큰 노출, in-memory 레이트리밋 멀티인스턴스 한계, 리포트 공유 토큰 노출 안내, 픽토그램 이모지·shadow 위계.

---

## 3. QR → 웹 진입 결론

**"QR = 입장권" 모델은 실물에서 정확히 구동된다.** 데모 토큰은 HMAC 검증상 `salon-demo.v1` 로 정확히 풀리고(재현 확인), C1·C2 모두 `getSalonByEntry → verifyEntryToken` 게이트 통과 후에만 살롱을 띄운다. 손님 URL/클라 컴포넌트에 평문 slug 노출 0건. 무설치·무로그인·동의 게이트·전화 옵셔널·어드민 키 게이트까지 end-to-end 로 성립 — **핵심 요구는 충족(works).**

남은 것은 **운영 강건성**이다: ① entry_token version 대조·만료(유출 QR 폐기 경로), ② 진입 검증 GET·proxy 레이트리밋(토큰 열거·어드민 에러판 플러딩 방어), ③ Referrer-Policy/noindex(토큰 referer 누출 차단), ④ 어드민 키 URL→쿠키 전환. 모두 데모를 막지 않으나, 실 운영 배포(특히 Vercel 서버리스/Supabase) 전 선반영 권장. 배포 체크리스트에 `SOTONG_ADMIN_TOKEN`·`entrySecret` env 주입 필수 명시(기본값 하드코딩 `config.ts:25`).