import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

/**
 * 전역 CSP — Next App Router 호환 범위.
 * - default/script/style/img/font/connect 를 self 위주로 제한.
 * - img-src 에 data: 허용(사진 dataURL·QR 인라인). svg+xml dataURL 은 서버에서 거부됨.
 * - style 'unsafe-inline' 은 Next/Tailwind 인라인 스타일·next-intl 등 호환 위해 유지.
 * - frame-ancestors 'none' = clickjacking 차단(X-Frame-Options DENY 와 중복 방어).
 * - object-src 'none', base-uri 'self', form-action 'self'.
 *
 * 폰트: Pretendard(jsdelivr) + Noto Serif KR(Google Fonts) 를 style/font-src 에 허용
 *   (globals.css @import 로 로드 — 원래 Pretendard 의도했던 CDN 포함).
 * dev: webpack Fast Refresh 가 eval 을 쓰므로 개발 환경에서만 script-src 에 'unsafe-eval'.
 *   프로덕션은 eval 이 없어 불필요 → 프로덕션 script-src 는 그대로 엄격 유지.
 */
const IS_DEV = process.env.NODE_ENV !== "production";
const FONT_STYLE_SRC = "https://cdn.jsdelivr.net https://fonts.googleapis.com";
const FONT_SRC = "https://fonts.gstatic.com https://cdn.jsdelivr.net";

const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${IS_DEV ? " 'unsafe-eval'" : ""}`,
  `style-src 'self' 'unsafe-inline' ${FONT_STYLE_SRC}`,
  "img-src 'self' data: blob:",
  `font-src 'self' data: ${FONT_SRC}`,
  // 폰트 CSS(jsdelivr)의 소스맵 fetch 허용 — devtools 열렸을 때 connect 로 요청됨.
  "connect-src 'self' https://cdn.jsdelivr.net",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const nextConfig: NextConfig = {
  images: {
    // 외부 원격 이미지를 쓰지 않는다(사진은 dataURL). 와일드카드 제거.
    remotePatterns: [],
  },
  async headers() {
    // 토큰이 URL 경로에 실리므로 Referer 누출을 막는다(P1).
    // - 전역: strict-origin-when-cross-origin (cross-site 시 경로 제거) + CSP/XFO/nosniff
    // - 토큰 경로(손님 /c/*, 디자이너 /d/*, 콘솔 /s/*, 어드민): no-referrer + noindex
    const baseSecurity = [
      { key: "Content-Security-Policy", value: CSP },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-Content-Type-Options", value: "nosniff" },
    ];
    const tokenHeaders = [
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "X-Robots-Tag", value: "noindex, nofollow" },
    ];
    return [
      {
        source: "/:path*",
        headers: [
          ...baseSecurity,
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
      { source: "/:locale/c/:path*", headers: tokenHeaders },
      { source: "/:locale/d/:path*", headers: tokenHeaders },
      // 오너 콘솔(ownerToken) · 어드민 — 토큰/PII 가 URL·화면에 실리므로 no-referrer+noindex.
      { source: "/:locale/s/:path*", headers: tokenHeaders },
      { source: "/:locale/admin/:path*", headers: tokenHeaders },
      { source: "/:locale/admin", headers: tokenHeaders },
    ];
  },
};

export default withNextIntl(nextConfig);
