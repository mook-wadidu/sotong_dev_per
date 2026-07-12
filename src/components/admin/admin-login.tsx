"use client";

import { useState } from "react";
import { Button, Input, FormField } from "@/components/ui";
import { createAdminBrowserClient } from "@/lib/supabase/browser";

export interface AdminLoginLabels {
  email: string;
  password: string;
  submit: string;
  pending: string;
  error: string;
}

/**
 * 어드민 로그인 폼 — 이메일+비밀번호(Supabase Auth signInWithPassword).
 * 성공 시 브라우저 클라가 세션 쿠키를 세팅 → 현재 경로를 리로드해 서버(RSC)가 세션을 읽는다.
 * 실패 시 중립 에러 한 줄(이메일/비번 구분 없음 — 계정 존재 여부 노출 방지).
 * 라벨은 서버 페이지(getTranslations)에서 주입 — 클라에 i18n provider 의존 없음.
 */
export function AdminLogin({ labels }: { labels: AdminLoginLabels }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    setError(false);
    setPending(true);
    try {
      const supabase = createAdminBrowserClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) {
        setError(true);
        setPending(false);
        return;
      }
      // 세션 쿠키 설정 완료 → 리로드로 서버 게이트(getAdminUser)가 세션을 읽게 한다.
      window.location.reload();
    } catch {
      setError(true);
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 text-left">
      <FormField id="admin-email" label={labels.email}>
        <Input
          id="admin-email"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={pending}
        />
      </FormField>
      <FormField
        id="admin-password"
        label={labels.password}
        error={error ? labels.error : undefined}
      >
        <Input
          id="admin-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={pending}
        />
      </FormField>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? labels.pending : labels.submit}
      </Button>
    </form>
  );
}
