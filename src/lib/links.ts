import type { Locale } from "@/lib/domain/types";

/**
 * 손님 QR 입장 경로: **로케일리스** `/c/e/{entryToken}` (Phase 3).
 * entryToken 은 lib/entry.ts 의 makeDesignerEntryToken/makeSalonEntryToken 으로 생성된 서명 토큰.
 * (추측 가능한 slug/id 를 URL 에 노출하지 않는다 — "QR = 입장권")
 *
 * 로케일을 일부러 빼는 이유: 손님이 이 경로(QR)로 들어오면 proxy(next-intl 미들웨어)가
 * 폰 언어(Accept-Language)를 보고 ko/ja/en/zh 중 최적 로케일로 리다이렉트한다
 * → 외국인이 첫 화면부터 자기 언어로 본다. 어디에도 안 맞는 폰은 en 으로 떨어진다(proxy 참고).
 * 기존에 발급된 `/ja/c/e/...` 같은 로케일 포함 QR 도 계속 동작한다(미들웨어가 그 로케일 그대로 사용).
 */
export function customerEntryPath(entryToken: string) {
  return `/c/e/${entryToken}`;
}

/** 손님 인테이크 경로 (입장 토큰 검증 후) */
export function customerIntakePath(entryToken: string, locale: Locale) {
  return `/${locale}/c/e/${entryToken}/intake`;
}

/** 손님 상담 스레드 경로 */
export function customerThreadPath(token: string, locale: Locale) {
  return `/${locale}/c/t/${token}`;
}

/** 손님 리포트 경로 (1회용 토큰) */
export function reportPath(token: string, locale: Locale) {
  return `/${locale}/c/r/${token}`;
}

/** 디자이너 개인 인박스 (디자이너 staffToken) */
export function designerInboxPath(staffToken: string) {
  return `/ko/d/inbox/${staffToken}`;
}

/** 디자이너 요약/스레드/리포트 경로 (카톡 링크 진입, consultation 별 designerToken) */
export function designerSummaryPath(token: string) {
  return `/ko/d/summary/${token}`;
}
export function designerThreadPath(token: string) {
  return `/ko/d/t/${token}`;
}
export function designerReportPath(token: string) {
  return `/ko/d/report/${token}`;
}
/** 디자이너용 리포트 '보기'(읽기전용) — 손님 reportToken 재사용, 별점은 읽기전용. */
export function designerReportViewPath(reportToken: string) {
  return `/ko/d/r/${reportToken}`;
}

/**
 * 살롱 오너 콘솔 경로 (ownerToken 필수 — 메뉴/디자이너/직급 편집 권한 키).
 * ko 고정. 손님 URL 에는 노출 금지(어드민 키와 동급 비밀).
 */
export function salonConsolePath(ownerToken: string) {
  return `/ko/s/${ownerToken}`;
}

/**
 * 어드민 키 입력 게이트 경로 (키 미포함 — 공개 링크용).
 * 홈/공개 페이지에서는 adminPath(key) 대신 이 경로로만 링크해 키 노출을 막는다(P0).
 */
export function adminGatePath(locale: Locale = "ko") {
  // 어드민/콘솔은 다국어(헤더 LocaleSwitch 로 전환) — 게이트 진입도 현재 locale 유지.
  return `/${locale}/admin`;
}

/** 어드민 사이드바 뷰 키 — URL `view` 파라미터(새로고침/북마크 견딤). */
export type AdminView =
  | "dashboard"
  | "salons"
  | "inquiries"
  | "errors"
  | "onboarding";

/**
 * 어드민 경로 (key 필수 — MVP 단일 공유 키). 게이트 통과 후 내부 네비게이션 전용.
 * - 2번째 인자: 기존 호환을 위해 문자열(`salonSlug`) 또는 `{ salon?, view? }` 옵션을 받는다.
 *   - 문자열 → 지점 필터(`?salon=`)로 해석(기존 호출부 보존).
 *   - 객체 → `view`(사이드바 섹션) + `salon`(선택 살롱) 동시 지정.
 */
export function adminPath(
  key: string,
  opts?: string | { salon?: string; view?: AdminView },
) {
  const q = new URLSearchParams({ key });
  const normalized =
    typeof opts === "string" ? { salon: opts } : opts ?? {};
  if (normalized.view) q.set("view", normalized.view);
  if (normalized.salon) q.set("salon", normalized.salon);
  return `/ko/admin?${q.toString()}`;
}

/** origin 을 붙여 절대 URL 로 (QR 인코딩용; 클라이언트에서 window.location.origin 전달) */
export function absolute(origin: string, path: string) {
  return `${origin.replace(/\/$/, "")}${path}`;
}
