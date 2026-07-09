import { NextResponse, type NextRequest } from "next/server";
import { clearAdminSession } from "@/lib/admin-session";

/**
 * 어드민 로그아웃 — 세션 쿠키를 만료시키고 홈으로 보낸다.
 * 공유 기기에서 운영자 세션을 회수하는 용도.
 */
export const dynamic = "force-dynamic";

function handle(req: NextRequest): NextResponse {
  const dest = req.nextUrl.clone();
  dest.pathname = "/ko";
  dest.search = "";
  const res = NextResponse.redirect(dest);
  clearAdminSession(res);
  return res;
}

export const GET = handle;
