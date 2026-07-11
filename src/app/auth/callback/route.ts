import { NextResponse, type NextRequest } from "next/server";
import { createSsrServerClient } from "@/lib/supabase/ssr-server";

/**
 * Google OAuth 콜백 — PKCE `code` 를 세션으로 교환한다(setAll 이 세션 쿠키를 발급).
 * 성공/실패 무관하게 `/ko/admin` 으로 리다이렉트한다.
 *   - code 유효 → 세션 쿠키 set → 대시보드.
 *   - code 없음/교환 실패 → 쿠키 없이 이동 → 페이지가 로그인 화면 렌더.
 *
 * 에러 파싱·재시도 UX 는 실제 로그인 도입 시로 미룬다(스캐폴딩 최소 처리).
 * auth/* 는 proxy 매처에서 제외되어 로케일 재작성 간섭 없음.
 */
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const code = req.nextUrl.searchParams.get("code");
  if (code) {
    try {
      const supabase = createSsrServerClient();
      await supabase.auth.exchangeCodeForSession(code);
    } catch {
      // 교환 실패 — 로그인 화면으로 그냥 되돌린다(재시도 UX 없음).
    }
  }
  return NextResponse.redirect(new URL("/ko/admin", req.nextUrl));
}
