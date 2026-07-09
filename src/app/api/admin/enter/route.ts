import { NextResponse, type NextRequest } from "next/server";
import { verifyAdminKey } from "@/lib/entry";
import { setAdminSession } from "@/lib/admin-session";

/**
 * 어드민 진입 — `?key=<KEY>` 를 1회 검증해 httpOnly 세션 쿠키를 발급한다.
 * 성공/실패 무관하게 깨끗한 `/ko/admin`(키 없는 URL)으로 리다이렉트한다.
 *   - 유효 키 → 세션 쿠키 set(이후 재입력 없이 대시보드).
 *   - 무효/누락 → 쿠키 없이 이동 → 페이지가 "잘못된 접근입니다" 렌더.
 * (no-key·wrong-key 를 구분하지 않아 오라클 제거.)
 *
 * 라우트핸들러 = Node 런타임 → config(server-only)·node:crypto 사용 가능.
 * api/* 는 proxy 미들웨어 매처에서 제외되어 로케일 재작성 간섭 없음.
 */
export const dynamic = "force-dynamic";

function handle(req: NextRequest): NextResponse {
  const key = req.nextUrl.searchParams.get("key");
  const dest = req.nextUrl.clone();
  dest.pathname = "/ko/admin";
  dest.search = ""; // ?key= 를 히스토리/URL 에서 제거
  const res = NextResponse.redirect(dest);
  if (verifyAdminKey(key)) {
    setAdminSession(res);
  }
  return res;
}

export const GET = handle;
