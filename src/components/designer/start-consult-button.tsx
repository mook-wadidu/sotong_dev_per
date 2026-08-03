"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { buttonVariants, Spinner } from "@/components/ui";
import { cn } from "@/lib/utils";
import { markChatStarted } from "@/lib/actions";
import { designerThreadPath } from "@/lib/links";

/**
 * D2 — "상담 시작" 버튼. 기존 단순 Link 를 교체:
 * chat_started_at 신호를 남긴 뒤(markChatStarted) 디자이너 채팅으로 이동 →
 * 손님 present 화면이 그 신호를 폴로 감지해 **함께 채팅방에 자동입장**한다.
 * (신호 기록은 best-effort — 실패해도 이동은 진행.)
 */
export function StartConsultButton({
  designerToken,
  label,
}: {
  designerToken: string;
  label: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const onClick = () => {
    startTransition(async () => {
      try {
        await markChatStarted(designerToken);
      } catch {
        /* 신호 실패해도 이동은 진행 */
      }
      router.push(designerThreadPath(designerToken));
    });
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className={cn(
        buttonVariants({ variant: "accent", size: "lg" }),
        "w-full gap-1.5",
      )}
    >
      {pending ? <Spinner className="size-4" /> : null}
      {label}
    </button>
  );
}
