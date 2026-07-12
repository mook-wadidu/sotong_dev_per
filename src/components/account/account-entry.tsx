"use client";

import { useState } from "react";
import { Button, Input, FormField, toast } from "@/components/ui";
import { signUpDesigner } from "@/lib/actions";
import { createAdminBrowserClient } from "@/lib/supabase/browser";

export interface AccountEntryLabels {
  email: string;
  password: string;
  name: string;
  login: string;
  signup: string;
  toSignup: string;
  toLogin: string;
  pending: string;
  error: string;
  signupHint: string;
}

/**
 * 통합 진입 — 로그인 / 디자이너 신규 가입 토글.
 * 로그인: signInWithPassword → reload(/login 이 role 라우팅).
 * 가입: signUpDesigner(미소속 계정) → signInWithPassword → reload(소속 대기 홈).
 */
export function AccountEntry({
  locale,
  labels,
}: {
  locale: string;
  labels: AccountEntryLabels;
}) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);

  const reload = () => {
    window.location.href = `/${locale}/login`;
  };

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    const supabase = createAdminBrowserClient();

    if (mode === "signup") {
      const res = await signUpDesigner({
        name: name.trim(),
        email: email.trim(),
        password,
      });
      if (!res.ok) {
        toast.error(res.error);
        setPending(false);
        return;
      }
    }
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) {
      toast.error(labels.error);
      setPending(false);
      return;
    }
    reload();
  };

  return (
    <div className="space-y-4">
      <form onSubmit={onSubmit} className="space-y-4 text-left">
        {mode === "signup" ? (
          <FormField id="acc-name" label={labels.name}>
            <Input
              id="acc-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="name"
            />
          </FormField>
        ) : null}
        <FormField id="acc-email" label={labels.email}>
          <Input
            id="acc-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="username"
          />
        </FormField>
        <FormField id="acc-password" label={labels.password}>
          <Input
            id="acc-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={mode === "signup" ? 8 : undefined}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
          />
        </FormField>
        <Button type="submit" disabled={pending} className="w-full">
          {pending
            ? labels.pending
            : mode === "signup"
              ? labels.signup
              : labels.login}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        {mode === "login" ? (
          <>
            {labels.signupHint}{" "}
            <button
              type="button"
              onClick={() => setMode("signup")}
              className="font-medium text-foreground underline underline-offset-4"
            >
              {labels.toSignup}
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setMode("login")}
            className="font-medium text-foreground underline underline-offset-4"
          >
            {labels.toLogin}
          </button>
        )}
      </p>
    </div>
  );
}
