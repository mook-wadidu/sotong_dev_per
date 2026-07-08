"use client";

import { useEffect, useState } from "react";
import type { Segment } from "@/content/intro-demo";
import { cn } from "@/lib/utils";

/**
 * 세그먼트 배열을 글자 단위로 타이핑. highlight 세그먼트는 브랜드 컬러.
 * 줄바꿈(\n)은 <br/>로 렌더. 끝에 깜빡이는 커서.
 */
export default function Typewriter({
  segments,
  speedMs = 55,
  startDelayMs = 250,
  className,
}: {
  segments: Segment[];
  speedMs?: number;
  startDelayMs?: number;
  className?: string;
}) {
  const full = segments.map((s) => s.text).join("");
  const total = full.length;
  const [count, setCount] = useState(0);
  // 텍스트가 바뀌면 렌더 중 카운트 리셋(이펙트 내 setState 회피 — React 권장 패턴).
  const [prevFull, setPrevFull] = useState(full);
  if (prevFull !== full) {
    setPrevFull(full);
    setCount(0);
  }

  useEffect(() => {
    let i = 0;
    let interval: ReturnType<typeof setInterval>;
    const start = setTimeout(() => {
      interval = setInterval(() => {
        i += 1;
        setCount(i);
        if (i >= total) clearInterval(interval);
      }, speedMs);
    }, startDelayMs);
    return () => {
      clearTimeout(start);
      clearInterval(interval);
    };
  }, [full, total, speedMs, startDelayMs]);

  const done = count >= total;

  return (
    <span className={className} aria-label={full}>
      {segments.map((seg, si) => {
        // 앞 세그먼트 길이 합(순수 계산 — 렌더 중 변수 재할당 회피)
        const before = segments
          .slice(0, si)
          .reduce((a, s) => a + s.text.length, 0);
        const take = Math.max(0, Math.min(seg.text.length, count - before));
        const shown = seg.text.slice(0, take);
        return (
          <span
            key={si}
            className={cn(seg.highlight && "text-brand-400")}
          >
            {renderWithBreaks(shown)}
          </span>
        );
      })}
      <span
        className={cn(
          "ml-0.5 inline-block w-[3px] -translate-y-[2px] self-center bg-current align-middle",
          done ? "animate-[blink_1s_step-end_infinite]" : "opacity-100"
        )}
        style={{ height: "0.9em" }}
        aria-hidden
      />
    </span>
  );
}

function renderWithBreaks(text: string) {
  const parts = text.split("\n");
  return parts.map((p, i) => (
    <span key={i}>
      {p}
      {i < parts.length - 1 && <br />}
    </span>
  ));
}
