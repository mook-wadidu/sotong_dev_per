import { NextResponse, type NextRequest } from "next/server";
import { clearAdminSession } from "@/lib/admin-session";

/**
 * 어드민 로그아웃 — 세션 쿠키를 만료시키고 홈으로 보낸다.
 * 공유 기기에서 운영자 세션을 회수하는 용도.
 * CSRF 방지 위해 **POST 전용**(GET 이미지 프리페치로 강제 회수 불가).
 */
export const dynamic = "force-dynamic";

const LOCALES = new Set(["ko", "ja", "en", "zh"]);

export async function POST(req: NextRequest): Promise<NextResponse> {
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
  dest.pathname = `/${locale}`;
  dest.search = "";
  const res = NextResponse.redirect(dest, { status: 303 });
  clearAdminSession(res);
  return res;
}
