"use client";

import { useRouter } from "next/navigation";
import { LanguageButton } from "@/components/ui";
import { customerIntakePath } from "@/lib/links";
import { tx, type Locale } from "@/lib/domain/types";

/** "이 언어로 계속하기" 의 각 언어 표기 (subLabel — 손님이 자기 언어를 알아보게) */
const LANG_CONTINUE = {
  ko: "이 언어로 계속하기",
  ja: "この言語で続ける",
  en: "Continue in this language",
  zh: "用这个语言继续",
};

/** 손님 노출 언어 — 순서는 CUSTOMER_LOCALES(ja/en/zh/ko)를 따른다. */
const LANG_OPTIONS: { locale: Locale; nativeLabel: string }[] = [
  { locale: "ja", nativeLabel: "日本語" },
  { locale: "en", nativeLabel: "English" },
  { locale: "zh", nativeLabel: "中文" },
  { locale: "ko", nativeLabel: "한국어" },
];

/**
 * C1 언어 선택 — LanguageButton(<button>)을 anchor 안에 넣으면 무효 중첩(<a><button>)이 되므로
 * 프로그래매틱 내비게이션으로 인테이크 경로로 이동한다(FEEDBACK P1-22).
 */
export function LanguageChoices({ entryToken }: { entryToken: string }) {
  const router = useRouter();
  return (
    <div className="space-y-2.5">
      {LANG_OPTIONS.map((opt) => (
        <LanguageButton
          key={opt.locale}
          nativeLabel={opt.nativeLabel}
          subLabel={tx(LANG_CONTINUE, opt.locale)}
          lang={opt.locale}
          onClick={() => router.push(customerIntakePath(entryToken, opt.locale))}
        />
      ))}
    </div>
  );
}
