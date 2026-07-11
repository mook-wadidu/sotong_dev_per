import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { config } from "@/lib/config";

/**
 * 서버(SSR) 전용 Supabase 클라이언트 — 어드민 세션(getUser)·OAuth 콜백 교환용.
 * anon 키 + httpOnly 쿠키로 사용자 세션을 읽고, 토큰 리프레시를 쿠키에 되쓴다.
 *
 * cookies().set 은 RSC 렌더 중엔 불가(라우트핸들러/서버액션에서만 가능)이라
 *   setAll 을 try/catch 로 감싼다. 실제 세션 리프레시 write 는 콜백/라우트핸들러에서 일어난다.
 */
export function createSsrServerClient() {
  return createServerClient(config.supabaseUrl, config.supabaseAnonKey, {
    cookies: {
      getAll: async () => (await cookies()).getAll(),
      setAll: async (toSet) => {
        const c = await cookies();
        toSet.forEach(({ name, value, options }) => {
          try {
            c.set(name, value, options);
          } catch {
            // RSC 렌더 중 set 불가 — 무시(리프레시 write 는 라우트핸들러/콜백에서).
          }
        });
      },
    },
  });
}
