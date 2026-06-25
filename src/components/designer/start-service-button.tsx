"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button, Spinner, toast } from "@/components/ui";
import { CareIcon, CheckIcon } from "@/components/icons";
import { startService } from "@/lib/actions";
import type { ConsultationStatus } from "@/lib/domain/types";

type Labels = {
  /** 시작 버튼 — "시술 시작" */
  start: string;
  /** 진행 중 표시 — "시술 중" */
  inService: string;
  /** 실패 토스트 */
  failed: string;
};

/**
 * D2 — 요약 화면 "시술 시작" 버튼(흑백).
 * 자동 in_service 전이가 제거됐으므로, 디자이너가 명시적으로 누르는 이 버튼이
 * in_service 진입의 유일 경로다. startService(designerToken) 액션 → 성공 시
 * router.refresh() 로 서버 컴포넌트(상태 배지·요약 스테퍼)를 다시 그린다.
 *
 * 이미 in_service 면 버튼 대신 "시술 중" 정적 표시(채움 박스, 색 미도입)를 보인다.
 * 완료(completed)건은 호출부에서 이 컴포넌트를 렌더하지 않는다(읽기 전용).
 */
export function StartServiceButton({
  designerToken,
  status,
  labels,
}: {
  designerToken: string;
  status: ConsultationStatus;
  labels: Labels;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  if (status === "in_service") {
    return (
      <div className="flex items-center justify-center gap-1.5 rounded-xl border border-foreground bg-foreground px-4 py-3 text-sm font-semibold text-background">
        <CheckIcon className="size-4" />
        {labels.inService}
      </div>
    );
  }

  const onStart = () => {
    startTransition(async () => {
      try {
        const { ok } = await startService(designerToken);
        if (!ok) {
          toast.error(labels.failed);
          return;
        }
        router.refresh();
      } catch {
        toast.error(labels.failed);
      }
    });
  };

  return (
    <Button
      variant="default"
      size="lg"
      className="w-full gap-1.5"
      onClick={onStart}
      disabled={pending}
    >
      {pending ? (
        <Spinner className="size-4" />
      ) : (
        <CareIcon className="size-4" />
      )}
      {labels.start}
    </Button>
  );
}
