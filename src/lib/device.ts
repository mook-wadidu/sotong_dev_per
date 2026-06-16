import "server-only";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";

/* ── 기기 토큰(신원 앵커) 쿠키 ─────────────────────────────────
 * 손님을 살롱별로 식별하는 단 하나의 앵커 = httpOnly secure 쿠키.
 * 미인증 전화번호는 절대 신원에 쓰지 않는다(쿠키만이 앵커).
 *
 * - 발급 시점: 첫 인테이크 제출(startConsultation, 서버액션 컨텍스트)
 * - 재진입: 서버가 쿠키를 읽어 (salonSlug, deviceToken) 으로 customers 조회 → 재방문 판정
 *
 * 주의(Next 16 / async cookies):
 * - 쿠키 .set 은 서버액션/라우트 핸들러에서만 가능(서버컴포넌트 렌더 중 불가).
 *   → ensureDeviceToken(발급) 은 액션 경로(startConsultation)에서만 호출한다.
 *   → readDeviceToken(읽기 전용) 은 서버컴포넌트에서도 안전하게 호출 가능. */

/** 기기 토큰 쿠키 이름. */
export const DEVICE_COOKIE = "sotong_did";

/** 쿠키 수명(초) — 2년. */
const TWO_YEARS_SEC = 60 * 60 * 24 * 365 * 2;

/** 기기 토큰 길이(랜덤 바이트). base64url 인코딩되어 더 길어진다. */
const TOKEN_BYTES = 32;

/** 강한 랜덤 기기 토큰 생성(base64url, 패딩 없음). */
function generateDeviceToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

/**
 * 현재 요청의 기기 토큰을 읽는다(쿠키 set 안 함 — 읽기 전용).
 * 서버컴포넌트/서버액션 어디서든 호출 가능. 없으면 undefined.
 */
export async function readDeviceToken(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(DEVICE_COOKIE)?.value || undefined;
}

/**
 * 기기 토큰을 보장한다 — 있으면 그대로 반환, 없으면 새로 발급(쿠키 set)하고 반환.
 * 쿠키 .set 은 서버액션/라우트 핸들러 컨텍스트에서만 동작하므로,
 * 반드시 액션 경로(예: startConsultation)에서만 호출할 것.
 */
export async function ensureDeviceToken(): Promise<string> {
  const store = await cookies();
  const existing = store.get(DEVICE_COOKIE)?.value;
  if (existing) return existing;

  const token = generateDeviceToken();
  store.set(DEVICE_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: TWO_YEARS_SEC,
  });
  return token;
}
