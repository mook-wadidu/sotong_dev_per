import { defineRouting } from "next-intl/routing";

/**
 * 소통 로케일 — 한국어(ko)를 기준 피벗으로 두고, 손님 노출 언어는 일본어/영어/중국어.
 * 중국어(zh)는 손님 4번째 언어로 정식 추가(데이터 모델·라우팅 모두 포함).
 */
export const routing = defineRouting({
  locales: ["ko", "ja", "en", "zh"],
  defaultLocale: "ko",
  localePrefix: "always",
});

export type AppLocale = (typeof routing.locales)[number];
