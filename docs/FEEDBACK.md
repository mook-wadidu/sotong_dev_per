# 소통(Sotong) — 디자인·UX·접근성·보안 통합 리뷰 피드백

> 8개 전문 패널(비주얼·브랜드 / 인터랙션·모션 / 디자인시스템 / 다국어 타이포·로컬라이제이션 / 외국인 손님 / 한국인 디자이너 / 살롱 사장 / 접근성 WCAG / QR·보안)의 리뷰를 종합하고, 모든 항목을 **현재 코드(spine)로 직접 검증**한 결과입니다. 중복은 병합하고 모순은 판단해 정리했습니다. 곧 진행할 화면 빌드(C1~C4 손님 · D2~D5 디자이너 · 어드민) 에이전트가 바로 실행할 수 있도록 파일/스펙에 매핑했습니다.

## 총평

spine의 디자인 토큰 구조, cva 기반 UI 키트 골격, next-intl i18n 배선, 도메인 타입 계약은 **견고하고 톤이 일관**됩니다. 다만 곧 지을 화면들이 그대로 상속할 **P0급 결함이 토큰·계약·spine 레벨에 박혀** 있어, 화면 빌드 전에 선반영하지 않으면 모든 화면에 전파됩니다.

핵심 가치별 위험 요약:
- **"QR 인증하면 앱 설치 없이 진행"** — 현재 진입은 *인증이 아니라* 추측 가능한 평문 slug 공개 URL(`/{locale}/c/salon-demo`)이며, `submitIntake`가 클라이언트 `salonSlug`를 무검증 신뢰합니다. 요구사항 정면 위반(아래 별도 섹션).
- **"막힘없는 다국어 UX"** — 일본어 한자가 Pretendard에 가로채여 한국 자형으로 렌더, 가격이 손님 말풍선에 "13만원"으로 한국어 노출, 9개 네임스페이스 JSON이 전부 빈 `{}`.
- **"깔끔한 UI"** — 브랜드 accent(#c77d74) 텍스트가 거의 모든 곳에서 WCAG AA 미달, 손님 말풍선 원문 병기는 1.73:1로 사실상 안 보임.
- **접근성 쇼스토퍼** — 인테이크의 주력 컨트롤(Chip/PictoChip/LanguageButton)에 focus-visible 부재, prefers-reduced-motion 전무, `maximumScale:1`로 핀치줌 차단.
- **현장 현실성** — 디자이너 price/time 칩이 자유 타이핑을 강요(타이핑0 붕괴), 멀티세션 인박스 부재, 어드민이 무인증으로 전 지점 PII 노출.

좋은 소식: 대부분은 토큰/계약/spine 한 곳을 고치면 컴포넌트 변경 없이 **회귀 없이 일괄 해결**됩니다.

---

## QR → 웹 진입: 결론과 구현안

### 진단 (코드 검증 완료)
현재 모델은 **"QR 인증"이 아니라 "QR 안내 링크"**입니다.
- 진입 경로 `customerEntryPath(slug, locale)` = `/{locale}/c/{salonSlug}` (`src/lib/links.ts:4`)
- `salonSlug`는 `salon-demo` / `salon-hongdae` 같은 **추측 가능한 평문** (`src/lib/db/memory.ts:35-50`)
- `proxy.ts`는 로케일 라우팅만 수행 (`localeDetection:false` 미설정 → next-intl 기본 on)
- `submitIntake({salonSlug, ...})`가 **클라이언트가 보낸 salonSlug를 그대로 신뢰** (`src/lib/actions.ts:28` → `src/lib/service.ts:56-105` → `ai.summarizeIntake` 실비 호출)
- 토큰은 `randomUUID().slice(0,16)` = 64bit, **만료·폐기·스코프 없음** (`src/lib/db/memory.ts:70`, `src/lib/service.ts:303`)
- `supabase/`에 SQL 마이그레이션·RLS **0건** (config.toml만 존재), 접근은 service-role 단일 키 의존 — 심층방어 없음

즉 slug만 알면(또는 열거하면) 누구나 원격에서 임의 살롱 인테이크를 열고, 입장 증명 없이 위조 상담·AI비용·PII 레코드를 무제한 생성할 수 있습니다.

### 구현안 (화면 빌드 전 선반영 — P0)
1. **불투명 서명 entry_token 도입.** 진입 경로를 `/{locale}/c/e/{entryToken}`로 전환. `entryToken = base64url({salonId, kind:'static'|'table', table?, iat, exp?}) + HMAC`. QR에는 이 토큰만 인코딩하고 `salonSlug`는 URL에서 제거. `src/lib/entry.ts`(신규)에 `signEntryToken`/`verifyEntryToken`.
2. **서버 검증 후에만 salonSlug 확정.** `submitIntake`에서 `salonSlug` 인자를 제거하고 `entryToken`만 받음 → 서버가 `verifyEntryToken` 성공 시에만 `salonSlug` 사용. 실패 시 reject + `logIssue(severity:'warning', source:'entry')`로 어드민 에러판에 노출.
3. **두 종류 QR 지원.** (a) 정적 살롱 QR(벽 부착, 만료 없음, 살롱별 `entryKeyVersion`으로 회전 가능) (b) 단명/테이블 QR(`exp` 30~60분, 디자이너가 즉석 생성). `Salon` 타입에 `entryKeyVersion` 추가.
4. **로케일 중립 진입 + C1 강제.** QR은 locale을 박지 않고 진입 → C1 언어선택에서 확정 후 `/{locale}/...`로. Accept-Language는 *추천*으로만(강제 리다이렉트 금지). 손님 헤더에 상시 언어 전환 칩.
5. **레이트리밋.** entryToken 발급당 상담 생성 상한 + IP+token 슬라이딩 윈도우(submit/sendMessage), pollMessages 최소 간격 가드.
6. **PII 보호.** 토큰 경로 페이지에 `Referrer-Policy: no-referrer`, 전화번호는 손님 뷰 미반환/마스킹, 어드민 뒤 4자리 마스킹, 보존정책(completed+N일 파기) 명시.
7. **계약 갱신.** `AGENTS_CONTRACT.md §6`의 "손님은 무인증 — URL 토큰이 곧 접근권"이 **어드민에는 적용되지 않음**을 명시하고, 진입 토큰 규약을 명문화.

---

## 우선순위 표

### P0 — 데모/요구사항 차단·치명

| # | 항목 | 파일/스펙 |
|---|------|----------|
| 1 | QR 진입을 평문 slug 공개 URL → 불투명 서명 entry_token으로 전환 | `links.ts:4`, `db/memory.ts:35-50` |
| 2 | submitIntake에서 클라 salonSlug 제거, entryToken 서버 검증 | `actions.ts:28`, `service.ts:56-105` |
| 3 | 어드민 인증 게이트 + getAdminData salonSlug 필수화·검증 (무인증 /ko/admin 전 지점 PII 노출) | `links.ts:30`, `actions.ts:73` |
| 4 | `IntakeDraft.phone`을 옵셔널화 + '번호 없음(관광객)' 스킵 칩 | `types.ts:50,63-72`, `service.ts:68` |
| 5 | 개인정보·사진 수집 동의(consent) 도입, 동의 없이 submit 차단 | `types.ts` IntakeDraft, `common.json`, CONTRACT |
| 6 | Chip/PictoChip/LanguageButton에 focus-visible 링 (WCAG 2.4.7) | `chip.tsx:30,92`, `language-button.tsx:21` |
| 7 | prefers-reduced-motion 전역 가드 | `globals.css:77,100-127` |
| 8 | viewport `maximumScale:1` 제거 (WCAG 1.4.4) | `layout.tsx:13-18` |
| 9 | ui 키트에 Dialog/Sheet·Toast·Skeleton·RadioGroup·Tabs 추가 (ad-hoc 양산 차단) | `components/ui/index.ts` |
| 10 | 레이트리밋·어뷰즈 방어 | `proxy.ts`, `actions.ts` |
| 11 | price/time 칩 자유 입력 제거 → 프리필/프리셋 칩 (타이핑0 복원) | `catalog/data.ts:254-273`, `service.ts:182-200` |
| 12 | 디자이너 응답 칩 6종 → 현장 빈도 상위 15~20종 보강 | `catalog/data.ts:221-274` |
| 13 | 디자이너 멀티세션 인박스 추가 | `links.ts:18-27`, CONTRACT §5 |

### P1 — 중요

| # | 항목 | 파일/스펙 |
|---|------|----------|
| 14 | accent 텍스트용 토큰 분리(--accent-text ≈#9c4f46), 흰카드 2.97/accent-soft 2.66/말풍선 원문 1.73:1 해소 | `globals.css:28-30`, `message-bubble.tsx:49` |
| 15 | muted-foreground #6f655d로 darken + placeholder /70 제거 | `globals.css:16`, `primitives.tsx:42,58` |
| 16 | accent 버튼 면색 darken (CTA AA-normal) | `button.tsx:13`, `globals.css:29` |
| 17 | 일본어 폰트 스택 분기 (Pretendard 한자 가로채기 해소) + Noto JP self-host | `globals.css:66-68` |
| 18 | 가격/시간/날짜 손님 로케일 재포맷 (formatKRW "13만원" 노출 해소) | `catalog/index.ts:62-66`, `service.ts:166-200` |
| 19 | CJK letter-spacing 제거 + line-height 1.6~1.7 | `globals.css:87` |
| 20 | 단일/다중 선택 칩 시각·시맨틱 분기 (RadioGroup/ToggleGroup) | `chip.tsx:9,28,60-71` |
| 21 | 스레드 Skeleton/낙관적 업데이트/aria-live | `message-bubble.tsx:40`, CONTRACT §6 |
| 22 | 홈 Link>Button 중첩(`<a><button>`) 제거 | `page.tsx:59-74` |
| 23 | 에러 바운더리 i18n화 (common.json errorGeneric/retry 이미 존재) | `error.tsx:34-41` |
| 24 | warning/info 색 토큰 + Badge variant (어드민 에러 severity) | `globals.css:32-34`, `primitives.tsx:11-17` |
| 25 | 다크모드 토큰 또는 'light-only 의도' 명시 | `globals.css:8-37`, `layout.tsx:13` |
| 26 | Button xl의 w-full 강제 제거 / fullWidth 분리 | `button.tsx:26` |
| 27 | 리포트 본문 손님 언어 생성 (mock/gemini 한국어 하드코딩, gemini는 mock 위임) | `mock.ts:95-130`, `gemini.ts:22-31` |
| 28 | `in_service` 상태 전이 + '시술 시작' 버튼 (현재 미사용) | `service.ts:89,283`, `types.ts:21-26` |
| 29 | headline에 알레르기 항상 노출 + hairDensity 반영 | `mock.ts:33-37,41-48,51-59` |
| 30 | ProgressSteps aria-label/valuetext + 현재단계 강조 + 미완료 대비 3:1 | `progress-steps.tsx:14-29` |
| 31 | FormField 래퍼 + SectionLabel label 변형 (폼 a11y) | `primitives.tsx:35-92` |
| 32 | getAdminData 경량 프로젝션 (사진 dataURL 100건 페이로드 폭발) | `actions.ts:73-81` |
| 33 | ListConsultationsOptions에 status[]·sinceIso ('오늘 대기열') | `db/types.ts:52-55` |
| 34 | ErrorLog resolvedAt + 그룹핑 + 사람말 매핑 | `db/types.ts:37-46`, `memory.ts:177-193` |
| 35 | Salon에 address/tel/businessHours/placementLabel + PrintQR | `db/types.ts:12-20` (qrcode.react 설치됨) |
| 36 | 토큰 강화(절단 중단, randomBytes, expiresAt/revokedAt) | `memory.ts:70`, `service.ts:303-305` |
| 37 | PII 보호 (손님뷰 phone 미반환/마스킹, 보존정책) | `service.ts:69,119-143` |
| 38 | Supabase 마이그레이션/RLS 추가 (현재 SQL 0건, service-role 단일) | `supabase/server.ts`, `db/supabase.ts` |
| 39 | 디자이너 custom 낙관적 렌더 + pending | `service.ts:202-217` |
| 40 | 사진 클라 리사이즈 필수화 + 진행/재시도/'사진 없이' | CONTRACT §6, `types.ts` stylePhotoUrls |
| 41 | '30초 기록' products 카탈로그 칩화(PRODUCTS) + 사진 탭 | `actions.ts:57-64`, `mock.ts:103-108` |
| 42 | 어드민 데스크톱 셸(AdminShell 3분할) | `mobile-frame.tsx:8-28` |
| 43 | 9개 빈 네임스페이스 JSON 키 뼈대 + 누락 검출 + 폴백 | `messages/*/{customer,designer,admin}.json` |
| 44 | 로케일 진입 폴백/상시 전환 칩 | `routing.ts:7-11`, `proxy.ts` |
| 45 | 홈 손님·어드민 버튼 분리 (QR 손님 혼란) | `page.tsx:58-75` |

### P2 — 있으면 좋음

| # | 항목 | 파일/스펙 |
|---|------|----------|
| 46 | shadow 2~3단 + radius 위계 강화 (프리미엄 표현) | `card.tsx:11`, `button.tsx:11-13` |
| 47 | 칩 transition-all → 속성 명시 + active:scale 분리 | `chip.tsx:30,92` |
| 48 | ScreenBody footer 동반 시 하단 패딩 | `mobile-frame.tsx:77,90` |
| 49 | Button sm h-10 상향 또는 손님 화면 금지 | `button.tsx:23` |
| 50 | PictoChip 선택 비색 신호 | `chip.tsx:92-103` |
| 51 | MessageBubble text/original에 lang 속성 | `message-bubble.tsx:43,52` |
| 52 | Spinner role=status + aria-live 패턴 | `primitives.tsx:67-77` |
| 53 | LanguageButton flag·→ aria-hidden | `language-button.tsx:27,38-40` |
| 54 | 얼굴형/고민 이모지 → SVG 라인 아이콘 | `catalog/data.ts:148-155,200-209` |
| 55 | 가변 라벨 nowrap 해제 + PictoChip line-clamp | `button.tsx:6`, `chip.tsx:108` |
| 56 | 홈 COPY 하드코딩 → common.json | `page.tsx:12-34` |
| 57 | C1에 살롱 로고/지점명 + '설치 불필요' 안심 카피 | `page.tsx:48-56` |
| 58 | be_right_there 칩 라벨/메시지 불일치 수정 | `catalog/data.ts:246-253` |
| 59 | QuickReply chipLabel i18n 밖임을 주석 | `catalog/data.ts:221-274` |
| 60 | isReturning '처음/다시 방문' 칩 | `service.ts:59`, `mock.ts:29` |
| 61 | 리포트 공유/저장/날짜 표기 | `types.ts:104-124` |
| 62 | 어드민 집계 stats + CSV 내보내기 | `actions.ts:66-81` |
| 63 | 다지점·담당배정 확장 여지 + 셀프 온보딩 미구현 명시 | `db/types.ts:12-20`, `memory.ts:35-50` |
| 64 | Mock 번역 폴백 가시 표식 + GEMINI 키 필수 명시 | `mock.ts:88-93` |
| 65 | entry_token 정적/단명 두 종류 + keyVersion | `entry.ts`(신규), `links.ts:4` |
| 66 | 어드민 ja/en admin.json 삭제/폴백 결정 | `messages/{ja,en}/admin.json` |

---

## 모순·판단 정리

리뷰어 간 모션 가드 표현이 갈렸습니다(한쪽은 전역 `*{}` 강제, 다른 쪽은 `active:scale` 피드백은 유지). **판단:** 전역 가드로 `.animate-rise/.animate-fade`·scroll-behavior·transition-duration을 무력화하되, 탭 피드백(`active:scale`)은 매우 짧게 유지해 "탭 됨" 신호는 남깁니다 — 모션 민감성과 어포던스를 둘 다 만족.

손님 말풍선 처리도 갈렸습니다(원문 불투명도만 상향 vs accent 배경 자체 darken vs 양쪽 버블 흰카드 통일). **판단:** 번역 병기가 제품 핵심 가치이므로 **accent 자체를 darken(P1-14)** 하여 흰 글자/원문 대비를 동반 상승시키는 것을 1순위로 하고, 그래도 부족하면 원문 불투명도 상향(/90)을 보조로 적용. 양쪽 버블 흰카드 통일은 좌/우 정렬만으로 화자 구분이 충분하나 브랜드 표현을 잃으므로 차선.

---

## 팀별 하이라이트

- **비주얼·브랜드:** accent 텍스트 전반 AA 미달이 "읽히지 않는 브랜드"를 만든다 — 텍스트용 accent 토큰 분리가 최우선. shadow/radius 단일화로 프리미엄 표현 약함.
- **인터랙션·모션:** 단일/다중 선택 칩 무구분, 스레드 로딩/낙관적 단서 부재, focus-visible·홈 `<a><button>` 중첩이 전 화면으로 전파될 토큰·계약 결함.
- **디자인시스템:** 오버레이/피드백 프리미티브 전무 + 라디오 시맨틱 부재가 "공유 키트 재사용" 계약을 즉시 깬다(P0). 다크모드·warning/info 토큰·FormField 부재.
- **다국어 타이포·로컬라이제이션:** Pretendard가 일본어 한자를 한국 자형으로 가로챔(혼종 렌더), 가격이 손님 말풍선에 한국어로 새고, 9개 JSON이 빈 `{}`라 키 계약 부재. CJK letter-spacing 부적절.
- **외국인 손님:** 전화 필수 + 동의 부재 = 인테이크 차단 + 신뢰 붕괴(P0). 언어 선택 전 한국어 화면 노출 위험, 손님·어드민 혼재 허브, 에러 화면 한국어.
- **한국인 디자이너:** price/time 자유 타이핑·칩 커버리지 부족·멀티세션 인박스 부재로 "타이핑0"가 현장에서 무너진다(P0). 리포트 한국어, in_service 미사용.
- **살롱 사장:** 무인증 어드민 전 지점 PII 노출 + 사진 dataURL 100건 페이로드 폭발(P0). Salon에 QR/주소 메타·상태 필터·에러 해결처리·데스크톱 셸 전무.
- **접근성(WCAG):** 칩 3종 focus-visible 부재 + reduced-motion 전무 + maximumScale:1이 키보드/모션민감/저시력 손님 인테이크를 차단하는 쇼스토퍼(P0). 토큰·공통 포커스 유틸로 spine 단계 일괄 해결 가능.
- **QR·보안:** "QR 인증"이 평문 slug 공개 URL일 뿐, submitIntake 무검증·레이트리밋 0·토큰 64bit 무만료·RLS 부재 — 별도 섹션의 entry_token 구현안으로 선반영 필수.