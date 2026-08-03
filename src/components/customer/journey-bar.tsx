"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { ConsultationStatus } from "@/lib/domain/types";

/**
 * 손님 여정 진행바(5단계) — 작성완료·확인·상담·시술·리포트.
 * "멈춘 느낌"의 해독제: 지금 어디인지 + 남은 게 몇 갠지 항상 보이는 위치 감각.
 * 지난 단계는 채워짐(✓)·현재는 강조·남은 건 흐리게 → 스텝 채워짐이 진행의 증거(무한 스피너 대체).
 */
export type JourneyStage =
  | "submitted"
  | "reviewing"
  | "consulting"
  | "service"
  | "report";

const STAGES: JourneyStage[] = [
  "submitted",
  "reviewing",
  "consulting",
  "service",
  "report",
];

/**
 * 상담 status + 여정 신호로 현재 5단계를 파생(역순 우선). present·채팅 공용.
 * 열람·입력은 같은 "확인" 단계(세부 카피만 다름), chat_started 부터 "상담".
 */
export function deriveStage(s: {
  status: ConsultationStatus;
  chatStartedAt?: string;
  designerViewedAt?: string;
  designerEditingAt?: string;
}): JourneyStage {
  if (s.status === "completed") return "report";
  if (s.status === "in_service") return "service";
  if (s.chatStartedAt) return "consulting";
  if (s.designerViewedAt || s.designerEditingAt) return "reviewing";
  return "submitted";
}

export function JourneyBar({ stage }: { stage: JourneyStage }) {
  const t = useTranslations("Customer.journey");
  const current = STAGES.indexOf(stage);
  return (
    <div className="flex w-full items-start justify-between px-1">
      {STAGES.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={s} className="flex flex-1 flex-col items-center gap-1">
            <div className="flex w-full items-center">
              <div
                className={cn(
                  "h-0.5 flex-1",
                  i === 0
                    ? "bg-transparent"
                    : i <= current
                      ? "bg-foreground"
                      : "bg-border",
                )}
              />
              <div
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-full border text-[0.6rem] font-bold leading-none",
                  done && "border-foreground bg-foreground text-background",
                  active &&
                    "border-foreground bg-background text-foreground ring-2 ring-foreground/15",
                  !done &&
                    !active &&
                    "border-border bg-background text-muted-foreground",
                )}
              >
                {done ? "✓" : i + 1}
              </div>
              <div
                className={cn(
                  "h-0.5 flex-1",
                  i === STAGES.length - 1
                    ? "bg-transparent"
                    : i < current
                      ? "bg-foreground"
                      : "bg-border",
                )}
              />
            </div>
            <span
              className={cn(
                "whitespace-nowrap text-[0.6rem] font-medium",
                active ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {t(s)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
