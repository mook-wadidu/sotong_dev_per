import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import type { AbstractIntlMessages } from "next-intl";
import { routing } from "./routing";

/**
 * 메시지를 네임스페이스 파일로 분리해 머지한다.
 * (Common = spine 소유 / Customer·Designer·Admin = 각 FE 에이전트 소유 → 충돌 없음)
 * 컴포넌트에서는 useTranslations("Customer") 처럼 네임스페이스로 접근.
 */
const NAMESPACES = ["common", "customer", "designer", "admin"] as const;

/** 권위 로케일 — ja/en 키가 비면 여기로 폴백한다 */
const FALLBACK_LOCALE = routing.defaultLocale; // "ko"

async function loadMessages(locale: string): Promise<AbstractIntlMessages> {
  const entries = await Promise.all(
    NAMESPACES.map(async (ns) => {
      const key = ns.charAt(0).toUpperCase() + ns.slice(1);
      // 아직 메시지 파일이 없는 신규 손님 로케일(예: zh — Phase 3 에서 채움)은
      // import 가 실패한다 → ko(권위) 네임스페이스로 폴백해 라우트가 깨지지 않게 한다.
      // (FALLBACK_LOCALE 자체가 없으면 진짜 버그이므로 폴백 없이 그대로 던진다.)
      try {
        const mod = await import(`../messages/${locale}/${ns}.json`);
        return [key, mod.default] as const;
      } catch (err) {
        if (locale === FALLBACK_LOCALE) throw err;
        const mod = await import(`../messages/${FALLBACK_LOCALE}/${ns}.json`);
        return [key, mod.default] as const;
      }
    }),
  );
  return Object.fromEntries(entries);
}

/** 중첩 객체에서 점 경로로 값 조회 ("Customer.intake.step.phone") */
function lookup(
  messages: AbstractIntlMessages,
  path: string,
): string | undefined {
  let node: unknown = messages;
  for (const part of path.split(".")) {
    if (node && typeof node === "object" && part in node) {
      node = (node as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return typeof node === "string" ? node : undefined;
}

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  const messages = await loadMessages(locale);
  // 비권위 로케일은 ko(권위) 메시지를 폴백 조회용으로 보관
  const fallbackMessages =
    locale === FALLBACK_LOCALE ? messages : await loadMessages(FALLBACK_LOCALE);

  return {
    locale,
    messages,

    /**
     * 키 누락 시 ko(권위) 값으로 폴백, 그래도 없으면 전체 키 경로를 그대로 노출.
     * key 는 네임스페이스 기준 상대 경로이므로 namespace 와 합쳐 full path 를 만든다.
     */
    getMessageFallback({ namespace, key }) {
      const fullKey = namespace ? `${namespace}.${key}` : key;
      return lookup(fallbackMessages, fullKey) ?? fullKey;
    },

    /**
     * 프로덕션에서는 MISSING_MESSAGE 로 화면이 깨지지 않게 무시(폴백으로 처리됨).
     * 개발 중에는 콘솔에 남겨 누락 키를 발견할 수 있게 한다.
     */
    onError(error) {
      if (
        process.env.NODE_ENV === "production" &&
        error.code === "MISSING_MESSAGE"
      ) {
        return;
      }
      console.error(error);
    },
  };
});
