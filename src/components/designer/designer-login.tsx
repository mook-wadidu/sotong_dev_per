"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button, FormField, Input } from "@/components/ui";
import { designerInboxPath } from "@/lib/links";

/**
 * 디자이너 토큰 로그인 — 살롱이 발급한 staffToken 을 입력하면 본인 인박스로 이동.
 * 어드민 키 게이트와 동일한 UX(입력 → 이동). 토큰 유효성은 인박스 페이지가 판정
 * (틀리면 inbox.invalid + '다시 로그인' 링크). 토큰은 경로(=기존 인박스 URL)로 전달.
 */
export function DesignerLogin({
  labels,
}: {
  labels: { label: string; placeholder: string; submit: string };
}) {
  const router = useRouter();
  const [token, setToken] = React.useState("");

  const go = () => {
    const t = token.trim();
    if (!t) return;
    router.push(designerInboxPath(t));
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        go();
      }}
      className="space-y-4"
    >
      <FormField label={labels.label}>
        <Input
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder={labels.placeholder}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          required
        />
      </FormField>
      <Button
        type="submit"
        size="lg"
        className="w-full"
        disabled={!token.trim()}
      >
        {labels.submit}
      </Button>
    </form>
  );
}
