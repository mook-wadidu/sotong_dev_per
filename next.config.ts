import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  async headers() {
    // 토큰이 URL 경로에 실리므로 Referer 누출을 막는다(P1).
    // - 전역: strict-origin-when-cross-origin (cross-site 시 경로 제거)
    // - 토큰 경로(손님 /c/*, 디자이너 /d/*, 리포트): no-referrer + noindex
    const tokenHeaders = [
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "X-Robots-Tag", value: "noindex" },
    ];
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
      { source: "/:locale/c/:path*", headers: tokenHeaders },
      { source: "/:locale/d/:path*", headers: tokenHeaders },
    ];
  },
};

export default withNextIntl(nextConfig);
