import "server-only";
import { randomBytes, randomUUID } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getRepo } from "@/lib/db";
import type { AccountRole } from "@/lib/db/types";

/**
 * 계정 프로비저닝 — Supabase Auth 유저 생성(자동확인) + profiles 레지스트리 upsert.
 * 초대/온보딩이 보증하므로 email_confirm:true(확인메일 왕복 없음).
 * memory 드라이버(dev)는 실제 Auth 가 없어 uuid 만 발급(매핑 데이터만).
 */

export interface ProvisionResult {
  userId: string;
  tempPassword: string; // 어드민/오너가 전달할 초기 비밀번호
}

function tempPassword(): string {
  return `St!${randomBytes(9).toString("base64url")}`;
}

export async function provisionAccount(input: {
  email: string;
  role: AccountRole;
  displayName?: string;
  /** 지정 시 이 비밀번호로 생성(초대 가입 — 디자이너가 직접 설정). 없으면 임시 발급. */
  password?: string;
}): Promise<ProvisionResult> {
  const email = input.email.trim().toLowerCase(); // 정규화 — 저장/조회 일관성.
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new Error("올바른 이메일이 필요합니다.");
  }
  const password = input.password?.trim() || tempPassword();
  if (password.length < 8) throw new Error("비밀번호는 8자 이상이어야 합니다.");

  const admin = getSupabaseAdmin();
  let userId: string;
  if (admin) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error || !data.user) {
      // 원문(예: "User already registered")은 이메일 열거 오라클 → 로그만 남기고
      // 사용자에겐 원인 불문 동일한 generic 메시지(열거 차단).
      console.warn("[provisionAccount] createUser 실패:", error?.message);
      throw new Error("계정을 만들 수 없습니다. 입력을 확인해 주세요.");
    }
    userId = data.user.id;
  } else {
    userId = randomUUID(); // memory(dev): 실제 Auth 없음
  }

  await getRepo().upsertProfile({
    id: userId,
    email,
    role: input.role,
    displayName: input.displayName,
  });
  return { userId, tempPassword: password };
}
