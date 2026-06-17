import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./i18n/routing";

const intlMiddleware = createMiddleware(routing);

/** 손님 진입(QR) 경로 — 로케일 프리픽스 없는 `/c/e/...`. */
const CUSTOMER_ENTRY_RE = /^\/c\/e(\/|$)/;
/** 이미 로케일 프리픽스가 붙은 경로인지 (예: /ja/..., /zh/...). */
const LOCALE_PREFIX_RE = new RegExp(`^/(${routing.locales.join("|")})(/|$)`);

/**
 * 손님 진입에서 폰 언어가 ko/ja/en/zh 어디에도 안 맞을 때의 폴백.
 * next-intl 기본은 defaultLocale(ko)로 떨어뜨리지만, 손님(외국인)에게는 ko 보다 en 이 친화적이다.
 */
const CUSTOMER_FALLBACK_LOCALE = "en";

/**
 * next-intl 의 로케일 쿠키 이름(기본값). routing 에서 localeCookie 를 끄거나 이름을
 * 바꾸지 않았으므로 기본값 "NEXT_LOCALE" 이다. (defineRouting 은 입력을 그대로 반환하므로
 * routing.localeCookie 는 undefined — createMiddleware 내부에서만 기본값으로 해석된다.)
 */
const LOCALE_COOKIE_NAME = "NEXT_LOCALE";

/**
 * Accept-Language 헤더를 파싱해 우리 로케일(ko/ja/en/zh) 중 최적 매칭을 고른다.
 * - 외부 의존성 없이(런타임 deps 미선언 회피) 자체 파서로 처리.
 * - "zh-CN","zh-Hans" 등 지역/스크립트 서브태그는 베이스 언어(zh)로 매칭.
 * - q 가중치 내림차순으로 평가, 첫 매칭 반환. 매칭 없으면 undefined.
 */
function matchAcceptLanguage(header: string | null): string | undefined {
  if (!header) return undefined;
  const ranked = header
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const qParam = params.find((p) => p.trim().startsWith("q="));
      const q = qParam ? Number.parseFloat(qParam.trim().slice(2)) : 1;
      return { tag: tag.trim().toLowerCase(), q: Number.isNaN(q) ? 0 : q };
    })
    .filter((x) => x.tag && x.q > 0)
    .sort((a, b) => b.q - a.q);

  for (const { tag } of ranked) {
    if (tag === "*") continue;
    const base = tag.split("-")[0];
    const hit = routing.locales.find(
      (loc) => loc === tag || loc === base,
    );
    if (hit) return hit;
  }
  return undefined;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 손님 진입(QR)이 로케일리스로 들어온 경우에만 특별 처리.
  // 이미 로케일이 붙어 들어온 기존 QR(예: /ja/c/e/...)은 그대로 next-intl 에 위임.
  const isLocalelessEntry =
    CUSTOMER_ENTRY_RE.test(pathname) && !LOCALE_PREFIX_RE.test(pathname);

  if (isLocalelessEntry) {
    // 손님이 이전에 고른 언어 쿠키가 있으면 그 의사를 존중(next-intl 이 처리).
    const hasLocaleCookie = request.cookies.has(LOCALE_COOKIE_NAME);
    if (!hasLocaleCookie) {
      const matched = matchAcceptLanguage(
        request.headers.get("accept-language"),
      );
      // 폰 언어가 우리 로케일 어디에도 안 맞으면 손님 진입은 en 으로(외국인 친화).
      // 맞으면 next-intl 이 같은 로케일로 리다이렉트하므로 그대로 위임한다.
      if (!matched) {
        const url = request.nextUrl.clone();
        url.pathname = `/${CUSTOMER_FALLBACK_LOCALE}${pathname}`;
        return NextResponse.redirect(url);
      }
    }
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: [
    // 정적 파일·API·내부 경로를 제외한 모든 경로에 로케일 라우팅 적용
    "/((?!api|_next|_vercel|.*\\..*).*)",
    // 손님 진입(QR) 로케일리스 경로 — 입장 토큰이 "payload.signature" 라 점(.)을 포함해
    // 위 dot 제외 규칙에 걸린다. 명시 매처로 미들웨어가 반드시 타 로케일 감지/리다이렉트.
    "/c/e/:path*",
  ],
};
