"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { SpinnerIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

/**
 * D1 인박스 경량 실시간화(P1) — 알림을 못 켠 iOS 디자이너가 새 손님을 놓치지 않도록.
 * 서버 컴포넌트 인박스를 주기적으로 router.refresh() 로 재요청한다(폴링 대비 가벼움).
 * + 수동 새로고침 버튼(헤더 trailing). 탭이 백그라운드면 폴링 중단(visibility).
 *
 * 폴링 주기는 스레드(2s)보다 느리게(인박스는 빈번할 필요 없음) — 서버 부하·과금 절감.
 */
const POLL_MS = 12_000;

export function InboxRefresh({ label, refreshingLabel }: { label: string; refreshingLabel: string }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  const refresh = React.useCallback(() => {
    startTransition(() => {
      router.refresh();
    });
  }, [router]);

  // 백그라운드 폴링 — 탭이 보일 때만 동작.
  React.useEffect(() => {
    let id: ReturnType<typeof setInterval> | undefined;
    const start = () => {
      if (id) return;
      id = setInterval(() => {
        if (document.visibilityState === "visible") refresh();
      }, POLL_MS);
    };
    const stop = () => {
      if (id) clearInterval(id);
      id = undefined;
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        refresh(); // 복귀 즉시 1회 갱신
        start();
      } else {
        stop();
      }
    };
    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  return (
    <button
      type="button"
      onClick={refresh}
      disabled={pending}
      aria-label={pending ? refreshingLabel : label}
      className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-xs font-medium text-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60"
    >
      <RefreshIcon className={cn("size-4", pending && "animate-spin")} pending={pending} />
      <span aria-hidden="true">{pending ? refreshingLabel : label}</span>
    </button>
  );
}

function RefreshIcon({ className, pending }: { className?: string; pending: boolean }) {
  if (pending) return <SpinnerIcon className={className} aria-hidden="true" />;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M3 12a9 9 0 0 1 15.5-6.2L21 8" />
      <path d="M21 4v4h-4" />
      <path d="M21 12a9 9 0 0 1-15.5 6.2L3 16" />
      <path d="M3 20v-4h4" />
    </svg>
  );
}
