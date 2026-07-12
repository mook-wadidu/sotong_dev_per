import { NextResponse, type NextRequest } from "next/server";
import { createSsrServerClient } from "@/lib/supabase/ssr-server";

/**
 * 계정 로그아웃 — Supabase Auth 세션 쿠키를 만료(signOut)시키고 로그인으로.
 * 라우트핸들러라 cookies().set 이 가능 → signOut 의 쿠키 제거가 응답에 반영된다.
 * CSRF 방지 위해 **POST 전용**(GET 이미지 프리페치로 강제 로그아웃 불가).
 */
export const dynamic = "force-dynamic";

const LOCALES = new Set(["ko", "ja", "en", "zh"]);

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const supabase = createSsrServerClient();
    await supabase.auth.signOut();
  } catch {
    // 무시 — 세션 없거나 실패해도 로그인으로 보낸다.
  }
  // 로케일 보존 — 폼 hidden 값(화이트리스트 검증, 미검증 시 ko).
  let locale = "ko";
  try {
    const form = await req.formData();
    const l = String(form.get("locale") ?? "");
    if (LOCALES.has(l)) locale = l;
  } catch {
    // 폼 없음 → ko 폴백.
  }
  const dest = req.nextUrl.clone();
  dest.pathname = `/${locale}/login`;
  dest.search = "";
  return NextResponse.redirect(dest, { status: 303 });
}
