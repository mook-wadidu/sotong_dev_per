import { NextResponse } from "next/server";
import { getRepo } from "@/lib/db";
import { verifyHandoffToken } from "@/lib/entry";
import { designerSummaryPath } from "@/lib/links";

/**
 * 핸드오프 라우트(로케일리스) — 손님 제시-QR 의 스캔 대상.
 * 이 라우트는 유효·미만료 토큰이면 인증 없이 디자이너 요약을 연다
 * (파일럿 트레이드오프, TTL로 상쇄). Phase 2에서 staffToken claim 인증 추가 예정.
 *
 * proxy(next-intl 미들웨어)는 점(.)을 포함한 경로를 매처에서 제외하므로,
 * 핸드오프 토큰("payload.signature")이 붙은 /h/{token} 은 로케일 프리픽스 없이 그대로 이 핸들러로 온다.
 */

/** 만료·무효 토큰 안내 — 읽는 사람은 디자이너. 최소 ko HTML(자체완결). */
function expiredPage(): Response {
  const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>QR 만료</title>
<style>
  body { margin:0; min-height:100dvh; display:flex; align-items:center; justify-content:center; padding:1.5rem;
    font-family: system-ui, -apple-system, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif;
    background:#f5f5f4; color:#1c1917; }
  main { max-width:22rem; text-align:center; }
  h1 { font-size:1.05rem; font-weight:700; margin:0 0 .6rem; }
  p { font-size:.9rem; line-height:1.7; color:#57534e; margin:0; }
</style>
</head>
<body>
<main>
  <h1>QR이 만료되었어요</h1>
  <p>손님 화면에서 '다시 표시'를 눌러 새 QR을 받아 주세요.</p>
</main>
</body>
</html>`;
  return new Response(html, {
    status: 410,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  const verified = verifyHandoffToken(token);
  if (!verified) return expiredPage();

  const consultation = await getRepo().getConsultationById(verified.consultationId);
  if (!consultation?.designerToken) return expiredPage();

  return NextResponse.redirect(
    new URL(designerSummaryPath(consultation.designerToken), request.url),
    302,
  );
}
