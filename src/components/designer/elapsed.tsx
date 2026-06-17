"use client";

import * as React from "react";

/**
 * 상담 시작 시각(절대) 표기 — "982분 전" 같은 상대 경과는 무의미해 절대 시각으로.
 * 오늘이면 "HH:MM", 다른 날이면 "M/D HH:MM" (ko-KR Intl).
 * 클라이언트에서 포맷(타임존 일치 + suppressHydrationWarning 으로 하이드레이션 안전).
 * createdAt 은 고정값이라 mount 시 1회만 계산한다.
 */
function formatAbsolute(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const now = new Date();
  const sameDay =
    now.getFullYear() === d.getFullYear() &&
    now.getMonth() === d.getMonth() &&
    now.getDate() === d.getDate();
  const time = new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
  return sameDay ? time : `${d.getMonth() + 1}/${d.getDate()} ${time}`;
}

export function Elapsed({ iso }: { iso: string }) {
  const [label, setLabel] = React.useState<string>("");

  React.useEffect(() => {
    // 마운트 후 비동기로 계산(effect 본문 내 동기 setState 회피 + 서버/클라 클럭 차이로 인한
    // 하이드레이션 미스매치 방지). createdAt 은 고정이라 한 번이면 충분.
    const id = requestAnimationFrame(() => setLabel(formatAbsolute(iso)));
    return () => cancelAnimationFrame(id);
  }, [iso]);

  return (
    <span className="tabular-nums" suppressHydrationWarning>
      {label}
    </span>
  );
}
