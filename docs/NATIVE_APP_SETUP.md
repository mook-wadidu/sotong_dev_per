# 네이티브 앱 (Capacitor) 셋업 런북

직원 화면(디자이너 인박스 + 오너 콘솔)을 App Store/Play 등록 네이티브 앱으로 만드는 실행 절차.
**손님 QR→상담지는 웹 유지**(설치·로그인 불필요). Phase 0(계정 로그인/소속)은 **완료·배포됨** — 앱은 이 로그인 위에 얹힌다.

아키텍처: **Capacitor + `server.url` = 배포된 프로덕션 도메인**(네이티브 WebView가 배포 사이트를 원격 로드하는 셸). SSR/RSC 앱이라 정적 번들 불가 → 원격 URL 방식만 유효. 네이티브 가치(스토어 통과 근거)는 **네이티브 푸시**.

---

## ⛔ 먼저 확보해야 할 외부 항목 (이게 없으면 시작 불가)
- [ ] **고정 프로덕션 도메인** — 현재 `sotong-dev-per.vercel.app`(dev). 앱이 물릴 안정 도메인 확정(커스텀 도메인 권장). 이 URL이 `server.url`이 된다.
- [ ] **Apple Developer Program** ($99/yr) + macOS **Xcode** + **APNs 인증키(.p8)**
- [ ] **Google Play Console** ($25 1회) + **Android Studio/SDK**
- [ ] **Firebase 프로젝트**(FCM): `google-services.json`(Android) / `GoogleService-Info.plist`(iOS) + 서버 전송용 **서비스계정 키**
- [ ] **개인정보처리방침 URL**(스토어 필수 — `docs/PRIVACY.md` 기반 공개 URL) + 앱 아이콘 1024 원본 + 스토어 스크린샷

---

## Phase 1 — Capacitor 셸 (설치되는 앱)
```bash
pnpm add @capacitor/core @capacitor/app @capacitor/splash-screen @capacitor/status-bar
pnpm add -D @capacitor/cli @capacitor/ios @capacitor/android @capacitor/assets
npx cap init 소통 com.wadidu.sotong
```
- `capacitor.config.ts`:
  ```ts
  import type { CapacitorConfig } from '@capacitor/cli';
  const config: CapacitorConfig = {
    appId: 'com.wadidu.sotong',
    appName: '소통',
    webDir: 'public',            // 원격 로드라 미사용이지만 필수 필드
    server: {
      url: process.env.SOTONG_APP_URL,   // = 고정 프로덕션 도메인
      allowNavigation: ['*.supabase.co'],
      cleartext: false,
    },
    backgroundColor: '#ffffff',
  };
  export default config;
  ```
- 플랫폼 생성 + 아이콘/스플래시(기존 `public/logo.png`·`public/icon-512.png` 흑백 활용):
  ```bash
  npx cap add ios && npx cap add android
  npx @capacitor/assets generate --iconBackgroundColor '#ffffff'
  npx cap sync
  ```
- `.gitignore`에 `ios/App/Pods`, `android/.gradle`, 빌드 산출물 추가.
- 앱 진입점 = **`/{locale}/login`**(이미 구현). 로그인 → 세션 → 오너는 `/s`(클린 URL, 구현됨), 디자이너는 인박스.
- 실행/조기 검증:
  ```bash
  npx cap run ios       # 실기기/시뮬 — 로그인 로드 확인
  npx cap run android
  ```
- **원격 WebView에서 Supabase 세션쿠키 동작 조기 확인**(SameSite/쿠키). 이슈 시 Supabase Auth 쿠키 옵션 점검.
- **TestFlight 내부 빌드 1개 올려 Apple 4.2(웹 래퍼) 리젝 리스크 조기 감지** — 전면 진행 전.

### 남은 웹측 소작업 (Phase 1에 포함)
- `src/lib/native.ts` — `isNativeApp()` 감지(`window.Capacitor?.isNativePlatform?.()`), Capacitor JS를 웹 번들에 포함.
- (선택) 디자이너 인박스 클린 URL: 현재 `/d/inbox/[staffToken]`(토큰). 세션형 `/d/inbox`로 옮기려면 인박스 렌더를 공유 컴포넌트로 추출 후 세션 페이지 추가(오너 `/s` 패턴과 동일).

## Phase 2 — 네이티브 푸시 (APNs/FCM) — 핵심
```bash
pnpm add @capacitor/push-notifications
```
- iOS/Android에 `GoogleService-Info.plist`/`google-services.json` 배치, APNs 키를 Firebase에 업로드.
- **웹↔네이티브 분기**: `src/components/designer/notification-setup.tsx`에서 `isNativeApp()`이면 web-push(SW) 대신 `PushNotifications.register()` → 디바이스 토큰 수신 → 서버 액션으로 저장. 브라우저 PWA 경로는 그대로 병행.
- **저장**: 마이그 `device_push_tokens(id, designer_id, platform 'ios'|'android', token unique, created_at)` + repo(`push_subscriptions` 미러).
- **전송**: `notifyDesigner`(`src/lib/service.ts`)에 FCM(Firebase Admin HTTP v1) 경로 추가 — `src/lib/push.ts`에 `sendFcm`. 서버 서비스계정 env. 알림 발송 로그(0019, 이미 계측됨)에 네이티브 결과도 기록.
- **검증**: 실기기(시뮬 불가)에서 토큰 등록 → 테스트 상담 생성 → 네이티브 알림 수신 + 탭 시 인박스 딥링크.

## Phase 3 — 스토어 제출
- 서명: iOS 자동서명/프로비저닝, Android keystore 생성.
- 스토어 메타: 아이콘/스플래시/스크린샷, **개인정보처리방침 URL**, App Privacy(iOS)/Data safety(Android) 데이터수집 신고, 연령등급.
- TestFlight(iOS 내부) / Play 내부테스트 → 심사 제출(재심사 1~2회 예산).

---

## 저리스크 폴백 = PWA
Apple 4.2 리젝이 반복되면, 스토어 없이도 **디자이너 인박스는 이미 ~80% PWA**(동적 manifest + web-push, `public/sw.js`). '홈 화면에 추가'로 설치형 앱 경험 + 푸시를 즉시 제공 가능. 네이티브의 유일한 추가가치는 스토어 등록.

## 참고 (이미 배포된 토대)
- 계정 로그인/소속: `src/lib/session-auth.ts`, `/login`, `/s`(오너 세션), 초대(`/invite/[token]`), 자가가입·소속요청.
- 알림 발송 로그(0019) + 어드민 현황 카드는 구현됨 — Phase 2 네이티브 발송도 같은 로그에 적재.
