/**
 * 디자이너 인박스별 동적 매니페스트 (PWA).
 * iOS 16.4+ 는 '홈 화면에 추가' 시 매니페스트의 start_url 로 앱을 띄운다.
 * 전역 매니페스트(start_url=/ko, 손님 랜딩)를 쓰면 디자이너가 인박스를 추가해도
 * 손님 화면이 열린다 → 인박스마다 start_url 을 그 인박스로 둔 매니페스트를 내려준다.
 * scope=/ 로 두어 인박스→상담 스레드 등 내부 이동은 앱 안에서 유지된다.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ locale: string; staffToken: string }> },
) {
  const { locale, staffToken } = await params;
  const inbox = `/${locale}/d/inbox/${staffToken}`;
  const manifest = {
    name: "소통 디자이너",
    short_name: "소통",
    description: "외국인 손님 접수 알림 — 새 손님이 오면 푸시로 알려드려요.",
    start_url: inbox,
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#111111",
    lang: "ko",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
  return new Response(JSON.stringify(manifest), {
    headers: {
      "content-type": "application/manifest+json; charset=utf-8",
      "cache-control": "public, max-age=300",
    },
  });
}
