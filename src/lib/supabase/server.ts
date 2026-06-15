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
  });
  return cached;
}
