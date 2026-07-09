"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { routing } from "@/i18n/routing";

/** 각 언어를 그 언어 자신의 이름으로 표기(현재 로케일과 무관). */
const LOCALE_LABELS: Record<string, string> = {
  ko: "한국어",
  ja: "日本語",
  en: "English",
  zh: "中文",
};

/**
 * 운영자 화면(어드민·오너 콘솔) 언어 전환 토글.
 * 현재 경로의 [locale] 세그먼트만 바꿔 재이동한다(쿼리·나머지 경로 보존).
 * 링크 생성기는 ko 고정이므로, 진입 후 여기서 원하는 언어로 바꾼다.
 * 쿼리는 클릭 시 window.location.search 로 읽어 보존(어드민 ?view=/?salon= 유지) —
 * useSearchParams 의 Suspense 경계 요구를 피한다.
 */
export function LocaleSwitch() {
  const pathname = usePathname();
  const router = useRouter();

  // pathname = "/ko/admin", "/ja/s/<token>" … 첫 세그먼트가 로케일.
  const segments = pathname.split("/");
  const locales = routing.locales as readonly string[];
  const current = locales.includes(segments[1])
    ? segments[1]
    : routing.defaultLocale;

  const switchTo = (loc: string) => {
    if (loc === current) return;
    const next = [...segments];
    next[1] = loc;
    const qs =
      typeof window !== "undefined" ? window.location.search : "";
    router.replace(next.join("/") + qs);
  };

  return (
    <div
      className="flex items-center gap-0.5 rounded-lg border border-border/70 p-0.5"
      role="group"
      aria-label="Language"
    >
      {routing.locales.map((loc) => {
        const active = loc === current;
        return (
          <button
            key={loc}
            type="button"
            onClick={() => switchTo(loc)}
            aria-current={active ? "true" : undefined}
            className={
              active
                ? "rounded-md bg-foreground px-2 py-1 text-xs font-semibold text-background"
                : "rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            }
          >
            {LOCALE_LABELS[loc] ?? loc}
          </button>
        );
      })}
    </div>
  );
}
