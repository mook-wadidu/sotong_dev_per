import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { config } from "@/lib/config";

/* ── 어드민 세션 쿠키(운영자 인증 앵커) ───────────────────────
 * 어드민 인증을 URL `?key=` stateless 에서 httpOnly 쿠키 세션으로 전환.
 * - 발급: /api/admin/enter 라우트핸들러가 `?key=` 1회 검증 후 setAdminSession.
 * - 검증: readAdminSession 이 쿠키를 읽어 파생 마커와 상수시간 비교(서버컴포넌트/서버액션 OK).
 * - 회수: /api/admin/exit 가 clearAdminSession.
 *
 * 쿠키 값은 마스터 키 원문이 아니라 (entrySecret, adminToken) 파생 HMAC 마커다.
 * → 쿠키가 유출돼도 어드민 키 자체는 새지 않고, adminToken 회전 시 기존 세션이 자동 무효화된다.
 *
 * 주의(Next 16 / async cookies): 쿠키 .set 은 라우트핸들러/서버액션에서만 가능.
 *   → set/clear 는 라우트핸들러의 NextResponse 에 직접 실어 리다이렉트 응답과 함께 보낸다. */

/** 어드민 세션 쿠키 이름. */
export const ADMIN_COOKIE = "sotong_admin";

/** 쿠키 수명(초) — 30일. 운영자 편의 ↔ 어드민 민감도 균형. */
const THIRTY_DAYS_SEC = 60 * 60 * 24 * 30;

const COOKIE_OPTS = {
  httpOnly: true,
  secure: true,
  sameSite: "lax",
  path: "/",
  maxAge: THIRTY_DAYS_SEC,
} as const;

/** 세션 마커 — 마스터 키를 담지 않는 (entrySecret, adminToken) 파생값. */
function adminSessionValue(): string {
  return createHmac("sha256", config.entrySecret)
    .update(`admin:${config.adminToken}`)
    .digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/** 키 검증 통과 후 응답에 세션 쿠키를 실는다(라우트핸들러 전용). */
export function setAdminSession(res: NextResponse): void {
  res.cookies.set(ADMIN_COOKIE, adminSessionValue(), COOKIE_OPTS);
}

/** 세션 쿠키를 즉시 만료시킨다(로그아웃, 라우트핸들러 전용). */
export function clearAdminSession(res: NextResponse): void {
  res.cookies.set(ADMIN_COOKIE, "", { ...COOKIE_OPTS, maxAge: 0 });
}

/**
 * 현재 요청에 유효한 어드민 세션 쿠키가 있는지(상수시간 비교).
 * 읽기 전용 — 서버컴포넌트/서버액션/라우트핸들러 어디서든 호출 가능.
 */
export async function readAdminSession(): Promise<boolean> {
  const store = await cookies();
  const val = store.get(ADMIN_COOKIE)?.value;
  if (!val) return false;
  return safeEqual(val, adminSessionValue());
}
