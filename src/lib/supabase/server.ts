import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "@/lib/config";

/**
 * 서버 전용 Supabase 클라이언트 (service role).
 * MVP에서는 모든 데이터 접근을 서버(Route Handler/Server Action)에서 수행하고
 * 손님은 토큰 스코프로만 접근하므로, RLS를 우회하는 service role을 서버에서만 쓴다.
 *
 * env가 비어 있으면(=memory 드라이버) null 을 반환한다.
 */
let cached: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient | null {
  if (config.dbDriver !== "supabase") return null;
  if (!config.supabaseUrl || !config.supabaseServiceKey) return null;
  if (cached) return cached;
  cached = createClient(config.supabaseUrl, config.supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      // Next 는 App Router 안의 `fetch` 를 감싼다. supabase-js 도 그 fetch 를
      // 타므로, 프레임워크가 GET 을 캐시하기로 하면 **DB 읽기가 통째로 캐시된다.**
      //
      // 지금(Next 16)은 기본값이 `no-store` 라 안전하다. 하지만 그 안전이
      // 프레임워크 기본값에 얹혀 있다는 게 문제다 — Next 14 에서는 기본이
      // `force-cache` 였고, 같은 코드가 자매 레포(MAKEDOL, 14.2.15)에서 실제로
      // 사고를 냈다: 예약을 취소해도 손님 화면이 "조율 중" 을 계속 보여줬고,
      // 서버를 재시작해도 `.next/cache/fetch-cache` 에서 되살아났다.
      //
      // 여기서 캐시가 켜지면 증상이 더 나쁘다 — 손님 여정 상태(`designer_viewed_at`,
      // `chat_started_at`)와 `/h/{token}` 핸드오프가 전부 이 읽기에 걸려 있어,
      // "라이브 전환이 멈춘 채로 현장에서 발견" 이 된다.
      //
      // 그래서 기본값에 기대지 않고 명시한다. 버전이 올라가며 기본이 또 바뀌어도
      // 이 줄이 있는 한 동작이 안 바뀐다.
      fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
    },
  });
  return cached;
}
