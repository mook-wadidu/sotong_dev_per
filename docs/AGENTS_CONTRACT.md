# 소통 — 에이전트 작업 계약 v4 (Integration Contract)

> Phase 2 화면 빌드용. spine + spine-v2(FEEDBACK P0/P1 선반영) + Phase 1(살롱 그룹 → 디자이너 다수 + **살롱별 메뉴/rank/ownerToken**)이 깔려 있고 **build green**.
> 모든 기능 에이전트는 작업 전 이 문서 + `docs/FEEDBACK.md` 를 읽는다. **spine 파일을 새로 만들거나 시그니처를 바꾸지 말 것** — import 해서 쓴다.
>
> **v3 변경(살롱 그룹 → 디자이너 N):** `Salon` 은 그룹 메타만(designerName·staffToken·logoEmoji 제거). 신규 `Designer{id,salonSlug,name,staffToken,entryKeyVersion}`. 입장 토큰 2종(디자이너/살롱공용). `getDesignerInbox` 는 디자이너 개인(내 손님 + 미배정), `assignConsultation` 으로 미배정 가져오기. `AdminSalon.designers[]`.
>
> **v4 변경(살롱별 메뉴/rank/ownerToken + 인테이크 보강):**
> - **메뉴는 더 이상 전역 catalog 가 아니다.** 살롱별 편집 카탈로그 `SalonServiceCategory`/`SalonService`(repo·DB) 로 분리. 전역 `SERVICE_CATEGORIES`/`ALL_SERVICES`/`estimatePrice` 는 **인테이크 경로에서 미사용**(catalog/data.ts 에는 그대로 남아 있으나 메뉴 소스는 repo). 손님 인테이크는 `getIntakeMenu(entryToken)` 가 살롱(+디자이너 rank) 가격으로 해석한 메뉴를 쓴다.
> - `Salon` 에 `designerRanks:{id,label}[]`, `ownerToken` 추가. `Designer` 에 `rankId?`.
> - `IntakeDraft`: `hairHistoryIds` **제거** → `treatmentHistory:{type,recency}[]`. 추가 `styleNote?`/`concernNote?`(손님 언어 자유텍스트)·`cowlickWhorl?`/`cowlickSticking?`(yes|no|unknown). `concernIds` 유지. `emptyIntake()` 갱신.
> - AI: `summarizeIntake` 가 자유텍스트(styleNote/concernNote/allergyNote, 손님 언어)·treatmentHistory·가마/뻗침을 한국어 요약에 번역·반영. gemini translate/summarize/report 는 `thinkingConfig.thinkingBudget=0`.

## 0. 아키텍처
- Next.js 16 App Router + TS + Tailwind v4 + next-intl. `src/`, alias `@/*`. pnpm.
- 백엔드 = Next 서버(Server Action/Server Component). **드라이버 스위치(env)**: DB `@/lib/db`(memory 기본/supabase), AI `@/lib/ai`(mock 기본/gemini). 기본값으로 `pnpm dev` 만 해도 핵심 루프가 돈다 — 절대 깨지 말 것.
- i18n: `/[locale]/...`, locale ∈ {ko, ja, en}, 기본 ko. 손님 노출 ja/en/ko, 디자이너/어드민 ko.
- **pnpm add/build/dev 금지**(통합 단계가 빌드). 필요한 패키지는 모두 설치됨: @radix-ui/react-dialog, @radix-ui/react-tabs, sonner, qrcode.react, lucide-react, cva, clsx, tailwind-merge.

## 1. 디렉토리 소유 (겹치면 안 됨)
| 에이전트 | 소유 | i18n |
|---|---|---|
| Customer FE | `src/app/[locale]/c/**`, `src/components/customer/**` | `messages/*/customer.json`(이미 키 채워짐) |
| Designer FE | `src/app/[locale]/d/**`, `src/components/designer/**` | `messages/*/designer.json`(채워짐) |
| Admin FE | `src/app/[locale]/admin/**`, `src/components/admin/**` | `messages/*/admin.json`(채워짐) |
| Backend/Data | `supabase/**`, `src/lib/db/supabase.ts` | — |
| AI | `src/lib/ai/gemini.ts`, `src/lib/ai/prompts.ts` | — |

**공유(읽기 전용)**: `src/components/ui/**`, `src/lib/**`(아래 spine 전부), `src/i18n/**`, `messages/*/common.json`. 메시지는 자기 namespace 에 **키 추가만**(기존 키 유지). 키는 ko/ja/en 세 곳 동일하게.

## 2. UI 키트 (`@/components/ui`) — 깔끔한 UI 핵심, 반드시 재사용
- 레이아웃(손님/디자이너=모바일): `MobileFrame`, `ScreenHeader`, `ScreenBody`, `ScreenFooter`. **어드민(데스크톱/태블릿)**: `AdminShell`, `AdminSection`(MobileFrame 쓰지 말 것).
- 선택(인테이크 탭): **`RadioGroup`(단일)·`ToggleGroup`(다중)** 를 우선 사용(접근성·키보드 내장). 낱개로는 `Chip`(selectMode "single"|"multi"), `PictoChip`(얼굴형 그리드).
- 입력: `FormField`(label/hint/error+id연결), `Input`, `Textarea`, `Checkbox`(동의), `Button`(variant: default|accent|secondary|outline|ghost|destructive|link, size: sm|default|lg|xl|icon — xl 은 w-full 강제 안 함, 필요시 className 으로).
- 표시: `Card*`, `Badge`(variant: default|accent|outline|success|warning|info|destructive), `Spinner`, `Skeleton`(로딩), `SectionLabel`, `Divider`, `ProgressSteps`(label·valueText).
- 상담: `MessageBubble`(side "me"|"them", text=번역문, original=원문, textLang/originalLang), `SystemNote`.
- 오버레이/피드백: `Dialog`·`Sheet`(+ Trigger/Content/Header/Footer/Title/Description; 값 입력·동의 상세·시술완료 확인), `Tabs`(+TabsList/Trigger/Content; 어드민 섹션), `toast`/`Toaster`(완료 알림 — Toaster 는 이미 layout 에 마운트됨, `toast()` 호출만).
- 목록: `DataTable`(+ type Column), `ListRow`.
- 진입: `LanguageButton`.
색은 토큰만: background/foreground/card/muted/border/primary/accent/**accent-strong**(CTA 면색)/**accent-text**(밝은 배경 위 강조 텍스트)/accent-soft/secondary/warning/info/success/destructive. radius: rounded-lg|xl|2xl. a11y(focus-visible/aria/reduced-motion)는 컴포넌트에 내장 — 임의 div 버튼 만들지 말 것.

## 3. 콘텐츠/데이터 (`@/lib/...`)
- 타입 `@/lib/domain/types`: `Locale, IntakeDraft(phone?·contactOptOut?·consentedAt?), Consultation, Message, DesignerSummary, HairReport, QuickReplyIntent(15종), FaceShape, ThreeLevel`. `emptyIntake()`.
- 렌더 `@/lib/domain/render`: `messageMainText(m, viewer)`, `messageOriginalText(m, viewer)`, `messageSide(m, viewerRole)`.
- 카탈로그 `@/lib/catalog`: `SERVICE_CATEGORIES, ALL_SERVICES, FACE_SHAPES, CROWN_VOLUME, HAIR_DENSITY, HAIR_TYPE, HAIR_HISTORY, CONCERNS, QUICK_REPLIES(15), TIME_PRESETS, PRODUCTS`. 헬퍼: `serviceLabels/concernLabels/hairHistoryLabels(ids,locale)`, `faceShapeLabel`, `estimatePrice`, `formatKRW`(ko 요약), `formatPrice(won,locale)`(손님 대면), `formatNextVisit(weeks,locale)`, `formatDate(iso,locale)`. 라벨 표기 `item.label[locale]`. `QuickReply.chipLabel` 은 ko 고정(i18n 아님).
  - **v4 주의**: 시술 메뉴(`SERVICE_CATEGORIES`/`ALL_SERVICES`/`estimatePrice`/`serviceLabels`)는 **인테이크/요약 경로에서 더 이상 메뉴 소스가 아니다** — 살롱별 `SalonService`(repo) 로 대체. 전역 상수/헬퍼는 하위호환·기타 화면용으로만 남는다. `HAIR_HISTORY` 도 인테이크에서 미사용(treatmentHistory 빌더로 대체). FACE_SHAPES/CROWN_VOLUME/HAIR_DENSITY/HAIR_TYPE/CONCERNS/PRODUCTS/QUICK_REPLIES/TIME_PRESETS 는 그대로 사용.

## 4. 서버 API
**클라이언트 컴포넌트는 `@/lib/actions`(서버액션)만 호출. 서버 컴포넌트는 `@/lib/service` 직접 호출 가능.**
액션(`@/lib/actions`):
- `getSalonByEntry(entryToken) → { salon: Salon | null, designer?: Designer }` (C1: 살롱 정보 + 디자이너 토큰이면 디자이너명)
- `getIntakeMenu(entryToken) → IntakeMenu | null` (C2 서버페이지가 호출) — `{ salonName, nameTranslations?, categories:{id,label,sort}[], services:{id,categoryId,label,priceFrom}[] }`. `priceFrom` 은 **디자이너 토큰이면 그 디자이너 rankPrices 우선(없으면 basePriceFrom), 살롱 공용이면 basePriceFrom.** 무효 토큰 → null. `service.getIntakeMenu` 와 동일.
- `submitIntake({entryToken, customerLocale, isReturning, intake}) → {consultationToken, designerToken, consultationId}` — **slug/디자이너 안 보냄, entryToken 만.** 서버가 토큰으로 살롱/디자이너 확정. **시술 라벨/예상가는 살롱 메뉴(`listServices`) 기준으로 해석**(전역 catalog 아님). intake.consentedAt 없으면 차단.
- `sendMessage({token, role:"customer"|"designer", text?, intent?, value?}) → Message | null`
- `pollMessages({token, role, sinceIso?}) → Message[]` (스레드 ~2s 폴링)
- `startService(designerToken)` (consulting→in_service)
- `finishAndSendReport({designerToken, record?:{products[],stateGrade?}, beforePhotoUrl?, afterPhotoUrl?}) → {reportToken} | null`
- `getDesignerInbox(staffToken) → {designer, salon, mine: ConsultationListItem[], unassigned: ConsultationListItem[]} | null` — **디자이너 개인**(내 손님 + 살롱 공용 미배정).
- `assignConsultation(staffToken, consultationToken) → {ok}` — 미배정을 자기에게 가져오기(디자이너 검증 후 repo.assignConsultation).
- `getAdminData(adminKey, salonSlug?) → {salons: AdminSalon[], consultations: ConsultationListItem[], errors: ErrorLog[]}` — **adminKey 무효면 throw.**
- `reportClientError({...})`
서버 컴포넌트용(`@/lib/service`): `getSalonInfoByEntry`(→ {salon, designer?}), `getCustomerView(consultationToken)`, `getDesignerView(designerToken)`, `getReportView(reportToken)`, `customerPrice(won,locale)`, `nextVisitLabel(weeks,locale)`. (getCustomerView 는 phone 미반환)
타입 `@/lib/db/types`:
- `Salon(slug·name·nameTranslations?·locales·entryKeyVersion·address?·tel?·businessHours?·placementLabel?·**designerRanks:{id,label}[]·ownerToken**)` — 그룹 메타 + 직급 정의 + 오너 콘솔 토큰.
- `Designer(id·salonSlug·name·staffToken·entryKeyVersion·**rankId?**)`.
- `DesignerRank{id,label}`. `SalonServiceCategory{id,salonSlug,label:LocalizedText,sort}`. `SalonService{id,salonSlug,categoryId,label:LocalizedText,basePriceFrom:number,rankPrices?:Record<string,number>,active:boolean}`. (메모리/DB id 규약: `${salonSlug}:${catalogId}`.)
- `CreateSalonInput`/`CreateDesignerInput` (콘솔/시드용; 토큰류는 repo 발급, 시드는 고정 id/staffToken 전달 가능).
- `AdminSalon = Salon + salonEntryToken·salonEntryPath·designers: AdminDesigner[]`. `AdminDesigner = Designer + entryToken·entryPath·consultationCount`.
- `ConsultationListItem(headline·maskedPhone·designerToken·hasReport·nationality·status·customerLocale·createdAt·designerId?·designerName?)`.
- `Repo`(memory/supabase 동일 구현): 기존 `getDesignerByStaffToken/getDesignerById/listDesigners/assignConsultation`(유지). **신규**: `getSalonByOwnerToken(token)`, `createSalon(input)`, `createDesigner(input)`, `updateDesigner(designer)`, `listServiceCategories(salonSlug)`, `listServices(salonSlug)`, `upsertServiceCategory(c)`, `upsertService(s)`, `deleteService(id)`. `listConsultations(opts)` 는 `designerId`/`unassignedOnly` 반영.

도메인 타입 `@/lib/domain/types`(v4):
- `IntakeDraft`: `serviceIds·stylePhotoUrls·styleNote?·faceShape?·crownVolume?·hairDensity?·hairType?·cowlickWhorl?·cowlickSticking?·**treatmentHistory:TreatmentHistoryItem[]**·concernIds·concernNote?·allergy·allergyNote?·phone?·contactOptOut?·consentedAt?`. (구 `hairHistoryIds` 삭제.)
- `TreatmentHistoryItem{type:"cut"|"perm"|"color"|"care"; recency:"2w"|"1m"|"3m"|"older"}`. `YesNoUnknown = "yes"|"no"|"unknown"`. `emptyIntake()` 는 `treatmentHistory:[]` 포함.
- AI `SummarizeInput`: `hairHistoryLabelsKo` 제거 → `treatmentHistoryLabelsKo:string[]`(한국어 "타입(시기)"), 추가 `cowlickKo?·styleNote?·concernNote?·allergyNote?`(자유텍스트는 손님 언어 원문, 요약에서 한국어로 번역). service 레이어가 라벨/예상가를 살롱 메뉴로 해석해 채운다.

## 5. 라우팅 (`@/lib/links`) + 입장 토큰 (`@/lib/entry`)
- **입장 토큰 2종**(`@/lib/entry`): `makeDesignerEntryToken(designerId, version)` (payload `d:{id}.v{n}`) → 진입 시 해당 디자이너 배정. `makeSalonEntryToken(salonSlug, version)` (payload `s:{slug}.v{n}`) → 미배정(살롱 공용). `verifyEntryToken(token) → {kind:"designer",designerId,version} | {kind:"salon",salonSlug,version} | null`(prefix 분기·서명·실패 null). `verifyAdminKey` 유지.
- 손님 QR 진입: `customerEntryPath(entryToken, locale)` = `/{locale}/c/e/{entryToken}` → **C1 언어선택**. 인테이크 `customerIntakePath(entryToken, locale)` = `/{locale}/c/e/{entryToken}/intake` → **C2**. 스레드 `customerThreadPath(token, locale)` = `/{locale}/c/t/{token}` → **C3**. 리포트 `reportPath(token, locale)` = `/{locale}/c/r/{token}` → **C4**.
- 디자이너(ko): 인박스 `designerInboxPath(staffToken)`=`/ko/d/inbox/{staffToken}` (**디자이너 개인** staffToken), 요약 `designerSummaryPath(token)`=`/ko/d/summary/{token}`, 스레드 `designerThreadPath`, 리포트 `designerReportPath`.
- 어드민(ko): `adminPath(key, salonSlug?)`=`/ko/admin?key=…[&salon=…]`. 페이지는 `searchParams.key` 를 읽어 `getAdminData(key, salon)` 호출, 무효/누락이면 키 요구 화면.
- QR 이미지: 어드민 페이지가 `headers()` 의 Host 로 origin 을 만들어 각 디자이너 `entryPath` / 살롱 `salonEntryPath` 앞에 붙여 절대 URL 로 `SalonQR(entryUrl, label)` 에 전달(SSR `QRCodeSVG`). QR 탭은 살롱 그룹 카드 → 디자이너별 QR(라벨=디자이너명) + 살롱 공용 QR(라벨="공용/지정없음").

## 6. 규칙 (FEEDBACK 반영)
- **QR=입장권**: 손님 URL 에 salon slug/디자이너 id 노출 금지, entryToken 만. C1 은 getSalonByEntry 로 검증·표시(무효/폐기 토큰=친절한 안내). 디자이너 토큰이면 C1 에 디자이너명 표시.
- **시드 staffToken·rankId·ownerToken**(memory + supabase seed 동일, 데모 안정):

  | 살롱 | ownerToken | 디자이너(id) | staffToken | rankId |
  |---|---|---|---|---|
  | salon-demo (소통 헤어 신사점) | `owner_sinsa_a1b2c3d4e5f6` | 김민지(`d_sinsa_minji`) | `staff_minji_2b9f5c1a4e7d` | director(원장) |
  | | | 박지수(`d_sinsa_jisoo`) | `staff_jisoo_8a31c7e4f0d2` | designer(디자이너) |
  | salon-hongdae (소통 헤어 홍대점) | `owner_hongdae_f6e5d4c3b2a1` | 이서준(`d_hongdae_seojun`) | `staff_seojun_7c4e1f9a2d6b` | senior(실장) |
  | | | 최하나(`d_hongdae_hana`) | `staff_hana_5d0b3e8a1f64` | designer(디자이너) |

  직급(designerRanks, 양 살롱 동일): `[{director,원장},{senior,실장},{designer,디자이너}]`. 디자이너 인박스 = `/ko/d/inbox/{staffToken}`.
- **살롱 메뉴(per-salon)**: 양 살롱 동일 시드(기존 catalog id·가격 그대로) — 컷[여성35000/남성28000] 펌[일반80000/디지털120000] 염색[전체90000/뿌리60000/포인트70000/탈색100000] 클리닉[트리트먼트50000] 스타일링[드라이30000/매직90000]. id=`${salonSlug}:${catalogId}`. director 직급가 예시: 여성컷 42000·남성컷 33600(+20%). 콘솔에서 `upsertService`/`deleteService` 로 편집.
- **오너 콘솔(ownerToken)**: 메뉴/디자이너/직급 편집 권한 키. `getSalonByOwnerToken(token)` 로 검증. 콘솔 화면 경로는 Phase 2 에서 빌드(예: `/ko/owner/{ownerToken}`) — 미구현 시 actions/service 에 권한 검증 게이트만 둔다. **손님 URL 에는 노출 금지(어드민 키와 동급 비밀).**
- **동의 필수·전화 선택**: C2 마지막에 손님 언어 1줄 동의(Checkbox, customer.json intake.consent.*) → 통과해야 제출(consentedAt 세팅). 전화번호는 선택(intake.phone?), "연락처 없음(관광객)" 옵션(contactOptOut). 동의 없이는 submit 비활성.
- **사진**: 업로드 시 클라이언트 리사이즈(긴 변 ~1280px, JPEG ~0.8) 후 dataURL 로 intake.stylePhotoUrls/리포트에 저장. 장수 상한·"사진 없이 진행".
- **다국어 출력**: 손님 대면 가격/날짜/주기는 formatPrice/formatDate/formatNextVisit(locale). 칩/카탈로그 라벨은 [locale].
- **스레드**: pollMessages 폴링(마지막 createdAt 이후), aria-live, 낙관적 표시(Skeleton/pending). 디자이너는 QUICK_REPLIES 칩 우선 + price(자동/선택)·time(TIME_PRESETS) + 직접입력.
- **상태/접근성/모션**: 컴포넌트 내장 사용. 색만으로 의미 전달 금지. 모든 인터랙션 키보드 가능.
- **작업 후 자기 디렉토리 밖 금지. TypeScript 컴파일 보장(통합 단계가 pnpm build).**
