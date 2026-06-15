import "server-only";
import { config } from "@/lib/config";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { MemoryRepo } from "./memory";
import { SupabaseRepo } from "./supabase";
import type { Repo } from "./types";

export * from "./types";

let cached: Repo | null = null;

/** 현재 설정에 맞는 Repo (memory 기본, env로 supabase 전환) */
export function getRepo(): Repo {
  if (cached) return cached;
  if (config.dbDriver === "supabase") {
    const client = getSupabaseAdmin();
    if (client) {
      cached = new SupabaseRepo(client);
      return cached;
    }
    console.warn(
      "[sotong] DB_DRIVER=supabase 이지만 Supabase env가 비어 있어 memory 로 폴백합니다.",
    );
  }
  cached = new MemoryRepo();
  return cached;
}
