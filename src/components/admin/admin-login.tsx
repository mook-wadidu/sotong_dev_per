"use client";

import { Button } from "@/components/ui";
import { createAdminBrowserClient } from "@/lib/supabase/browser";

/**
 * 어드민 Google SSO 로그인 버튼(스캐폴딩) — 클릭 시 signInWithOAuth 로 Google 리다이렉트.
 * 콜백은 /auth/callback 이 code→세션 교환 후 /ko/admin 으로 되돌린다.
 * 스켈레톤: 버튼 하나, 최소 처리(에러 UX 없음).
 */
export function AdminLogin() {
  async function signIn() {
    const supabase = createAdminBrowserClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  return (
    <Button type="button" onClick={signIn} className="w-full">
      Google로 로그인
    </Button>
  );
}
