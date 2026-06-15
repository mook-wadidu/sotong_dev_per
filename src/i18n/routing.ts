import { defineRouting } from "next-intl/routing";

/**
 * 소통 로케일 — 한국어(ko)를 기준 피벗으로 두고, 손님 노출 언어는 일본어/영어 우선.
 * 중국어(zh)는 데이터 모델에는 포함되지만 v1 UI 노출은 후순위라 라우팅에서는 제외한다.
 */
export const routing = defineRouting({
  locales: ["ko", "ja", "en"],
  defaultLocale: "ko",
  localePrefix: "always",
});

export type AppLocale = (typeof routing.locales)[number];
