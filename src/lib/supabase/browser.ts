import { createBrowserClient } from "@supabase/ssr";

/**
 * 브라우저(클라이언트 컴포넌트) 전용 Supabase 클라이언트 — 어드민 Google SSO 로그인 버튼용.
 *
 * NOTE: 여기서는 `@/lib/config`(server-only, 시크릿 보유)를 import 하지 않는다.
 *   config 를 client 그래프로 끌어오면 server-only 가드가 빌드를 막는다.
 *   URL/anon 키는 NEXT_PUBLIC_* 이라 클라 번들에 그대로 인라인되므로 process.env 를 직접 읽는다.
 */
export function createAdminBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  );
}
