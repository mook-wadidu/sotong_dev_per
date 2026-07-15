import type { MetadataRoute } from "next";

/**
 * robots.txt — **안전 기본값: 전면 차단(Disallow: /).**
 *
 * 이유: 현재 배포(sotong-dev-per.vercel.app 등 dev/스테이징/프리뷰)가 검색에 색인되면
 * ① 실도메인과 검색 결과를 경쟁하고 ② 손님이 잘못된 호스트로 유입돼 QR/링크가 어긋난다.
 * next.config.ts 의 `X-Robots-Tag: noindex` 는 **토큰 라우트에만** 걸려 있어
 * `/ko`·`/ko/demo`·`/ko/login` 같은 공개 페이지는 무방비였다.
 *
 * 정식 공개 도메인에서만 `SOTONG_PUBLIC_SITE=1` 을 설정해 색인을 연다(opt-in).
 * → dev 에 새 코드가 배포돼도 기본은 계속 차단이라 안전.
 */
export default function robots(): MetadataRoute.Robots {
  const isPublicSite = process.env.SOTONG_PUBLIC_SITE === "1";

  if (!isPublicSite) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // 손님/디자이너/오너 토큰 경로와 어드민은 색인 대상 아님
      // (헤더 X-Robots-Tag: noindex 와 병행 — 링크가 없어 크롤 도달 자체가 희박).
      disallow: ["/api/", "/*/c/", "/*/d/", "/*/s/", "/*/admin"],
    },
  };
}
