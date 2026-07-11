import "server-only";
import { createSsrServerClient } from "@/lib/supabase/ssr-server";

/**
 * 어드민 Google SSO 게이트(스캐폴딩) — 기존 공유키 세션과 병행하는 추가 경로.
 *
 * Google OAuth 프로바이더/세션이 설정되기 전에는 getUser() 가 세션 없음으로 null 을
 *   반환하므로 getAdminUser() 도 null → 기존 공유키(sotong_admin) 경로가 그대로 유지된다(비파괴).
 */

/** 허용 어드민 이메일. env로 이동 가능, 지금은 싱글 어드민. */
const ADMIN_ALLOWLIST = ["bill@wadidu.com"];

/**
 * 현재 요청에 유효한 Google 어드민 세션이 있으면 { email } 을, 없으면 null.
 * - 세션 없음 → getUser() 가 null user + AuthSessionMissingError(정상, 로깅 대상 아님).
 * - user.email 이 ADMIN_ALLOWLIST(대소문자 무시)에 있을 때만 인증으로 인정.
 * - 어떤 실패든 null 반환(비파괴 — 공유키 경로로 폴백).
 */
export async function getAdminUser(): Promise<{ email: string } | null> {
  try {
    const supabase = createSsrServerClient();
    const { data } = await supabase.auth.getUser();
    const email = data.user?.email;
    if (!email) return null;
    const allowed = ADMIN_ALLOWLIST.some(
      (e) => e.toLowerCase() === email.toLowerCase(),
    );
    return allowed ? { email } : null;
  } catch {
    return null;
  }
}
