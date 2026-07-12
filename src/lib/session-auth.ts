import "server-only";
import { createSsrServerClient } from "@/lib/supabase/ssr-server";
import { getRepo } from "@/lib/db";
import { getAdminUser } from "@/lib/admin-auth";
import type { Salon, Designer } from "@/lib/db/types";

/**
 * 계정 세션 해석 — Supabase Auth 세션 email 을 역할로 매핑.
 * 우선순위(오배정 방지): admin(allowlist) > owner > designer(소속) > designer(미소속).
 * 어떤 실패든 null(비파괴 — 기존 토큰/공유키 경로가 유지된다).
 */

async function getSessionEmail(): Promise<string | null> {
  try {
    const supabase = createSsrServerClient();
    const { data } = await supabase.auth.getUser();
    return data.user?.email ?? null;
  } catch {
    return null;
  }
}

export type SessionAccount =
  | { role: "admin"; email: string }
  | { role: "owner"; email: string; salon: Salon }
  | { role: "designer"; email: string; designer: Designer }
  | { role: "designer-unaffiliated"; email: string }
  | null;

export async function getSessionAccount(): Promise<SessionAccount> {
  const email = await getSessionEmail();
  if (!email) return null;

  // admin 우선(allowlist).
  const admin = await getAdminUser();
  if (admin) return { role: "admin", email: admin.email };

  const repo = getRepo();
  const salon = await repo.getSalonByOwnerEmail(email);
  if (salon) return { role: "owner", email, salon };

  const designer = await repo.getStaffByEmail(email);
  if (designer) return { role: "designer", email, designer };

  const profile = await repo.getProfileByEmail(email);
  if (profile?.role === "designer") {
    return { role: "designer-unaffiliated", email };
  }
  return null;
}

/** 오너 세션이면 { email, salon }, 아니면 null. */
export async function getSalonUser(): Promise<{
  email: string;
  salon: Salon;
} | null> {
  const acc = await getSessionAccount();
  return acc && acc.role === "owner"
    ? { email: acc.email, salon: acc.salon }
    : null;
}

/** 소속 디자이너 세션이면 { email, designer }, 아니면 null. */
export async function getDesignerUser(): Promise<{
  email: string;
  designer: Designer;
} | null> {
  const acc = await getSessionAccount();
  return acc && acc.role === "designer"
    ? { email: acc.email, designer: acc.designer }
    : null;
}
