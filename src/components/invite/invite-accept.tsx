"use client";

import { useState } from "react";
import { Button, Input, FormField, toast } from "@/components/ui";
import { acceptSalonInvite } from "@/lib/actions";
import { createAdminBrowserClient } from "@/lib/supabase/browser";

export interface InviteAcceptLabels {
  name: string;
  email: string;
  password: string;
  submit: string;
  pending: string;
}

/**
 * 초대 수락 폼 — 가입(이름/이메일/비번) → acceptSalonInvite(계정+소속 생성)
 * → 곧바로 signInWithPassword 로 로그인 → /login 이 역할(디자이너)로 인박스 라우팅.
 */
export function InviteAccept({
  token,
  locale,
  labels,
}: {
  token: string;
  locale: string;
  labels: InviteAcceptLabels;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    const res = await acceptSalonInvite({
      token,
      name: name.trim(),
      email: email.trim(),
      password,
    });
    if (!res.ok) {
      toast.error(res.error);
      setPending(false);
      return;
    }
    // 방금 만든 계정으로 로그인 → 세션 쿠키 → /login 이 인박스로 라우팅.
    try {
      const supabase = createAdminBrowserClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        // 계정은 생성됨 — 로그인 페이지로 안내.
        window.location.href = `/${locale}/login`;
        return;
      }
      window.location.href = `/${locale}/login`;
    } catch {
      window.location.href = `/${locale}/login`;
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4 text-left">
      <FormField id="invite-name" label={labels.name}>
        <Input
          id="invite-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoComplete="name"
        />
      </FormField>
      <FormField id="invite-email" label={labels.email}>
        <Input
          id="invite-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="username"
        />
      </FormField>
      <FormField id="invite-password" label={labels.password}>
        <Input
          id="invite-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
        />
      </FormField>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? labels.pending : labels.submit}
      </Button>
    </form>
  );
}
