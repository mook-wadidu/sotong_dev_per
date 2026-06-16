import type { Locale } from "@/lib/domain/types";

/**
 * 손님 QR 입장 경로: /{locale}/c/e/{entryToken}
 * entryToken 은 lib/entry.ts 의 makeDesignerEntryToken/makeSalonEntryToken 으로 생성된 서명 토큰.
 * (추측 가능한 slug/id 를 URL 에 노출하지 않는다 — "QR = 입장권")
 */
export function customerEntryPath(entryToken: string, locale: Locale = "ja") {
  return `/${locale}/c/e/${entryToken}`;
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
  // 어드민 UI 는 ko 고정이지만, 게이트 진입 자체는 현재 locale 유지.
  return `/${locale}/admin`;
}

/** 어드민 경로 (key 필수 — MVP 단일 공유 키). 게이트 통과 후 내부 네비게이션 전용. */
export function adminPath(key: string, salonSlug?: string) {
  const q = new URLSearchParams({ key });
  if (salonSlug) q.set("salon", salonSlug);
  return `/ko/admin?${q.toString()}`;
}

/** origin 을 붙여 절대 URL 로 (QR 인코딩용; 클라이언트에서 window.location.origin 전달) */
export function absolute(origin: string, path: string) {
  return `${origin.replace(/\/$/, "")}${path}`;
}
