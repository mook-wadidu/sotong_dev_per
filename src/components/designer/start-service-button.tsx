"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button, Spinner, toast } from "@/components/ui";
import { CareIcon, CheckIcon } from "@/components/icons";
import {
  startService,
  requestConsent,
  getConsentState,
} from "@/lib/actions";
import type { ConsultationStatus } from "@/lib/domain/types";

type Labels = {
  /** 시작 버튼 — "시술 시작" */
  start: string;
  /** 진행 중 표시 — "시술 중" */
  inService: string;
  /** 실패 토스트 */
  failed: string;
  /** 동의 대기(비활성 사유) — "손님 동의 대기 중" */
  waiting: string;
};

/**
 * D2 — "시술 시작"(in_service 진입) + 동의 핸드셰이크(B동의).
 * 1차 press: 손님이 이미 확인했으면 곧바로 startService. 아니면 requestConsent(plan_ready_at)
 * 로 손님에게 확인 요청 + 버튼을 **"손님 동의 대기 중"(비활성+사유)** 로 바꾸고 폴링 →
 * 손님 [확인했어요] 감지 시 **자동으로 startService**. (사유 없는 회색 버튼으로 디자이너가
 * 멈추지 않게 — 왜 못 누르는지 항상 보인다.)
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
  const [phase, setPhase] = React.useState<"idle" | "waiting" | "starting">(
    "idle",
  );

  const startNow = React.useCallback(async () => {
    setPhase("starting");
    try {
      const { ok } = await startService(designerToken);
      if (ok) {
        router.refresh();
        return true;
      }
      toast.error(labels.failed);
    } catch {
      toast.error(labels.failed);
    }
    setPhase("idle");
    return false;
  }, [designerToken, labels.failed, router]);

  // 동의 대기 중 폴 — 손님 [확인했어요] 감지 시 자동 시술 시작.
  React.useEffect(() => {
    if (phase !== "waiting") return;
    let active = true;
    const id = setInterval(async () => {
      try {
        const st = await getConsentState(designerToken);
        if (!active) return;
        if (st?.consented) {
          clearInterval(id);
          void startNow();
        }
      } catch {
        /* 폴 실패 무시 */
      }
    }, 2000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [phase, designerToken, startNow]);

  if (status === "in_service") {
    return (
      <div className="flex items-center justify-center gap-1.5 rounded-xl border border-foreground bg-foreground px-4 py-3 text-sm font-semibold text-background">
        <CheckIcon className="size-4" />
        {labels.inService}
      </div>
    );
  }

  const onPress = async () => {
    setPhase("starting"); // 확인 조회 동안 비활성
    try {
      const st = await getConsentState(designerToken);
      if (st?.consented) {
        await startNow();
        return;
      }
      await requestConsent(designerToken); // 손님에게 확인 요청(plan_ready_at)
      setPhase("waiting");
    } catch {
      toast.error(labels.failed);
      setPhase("idle");
    }
  };

  if (phase === "waiting") {
    // 비활성 + 사유(왜 못 누르는지) — 디자이너가 멈추지 않게.
    return (
      <div className="flex items-center justify-center gap-1.5 rounded-xl border border-border bg-muted px-4 py-3 text-sm font-medium text-muted-foreground">
        <Spinner className="size-4" />
        {labels.waiting}
      </div>
    );
  }

  return (
    <Button
      variant="default"
      size="lg"
      className="w-full gap-1.5"
      onClick={onPress}
      disabled={phase === "starting"}
    >
      {phase === "starting" ? (
        <Spinner className="size-4" />
      ) : (
        <CareIcon className="size-4" />
      )}
      {labels.start}
    </Button>
  );
}
