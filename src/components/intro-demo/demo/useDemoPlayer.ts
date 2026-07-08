"use client";

import { useCallback, useEffect, useState } from "react";
import {
  demoSteps,
  DEMO_STEP_INDEX,
  type CustomerLang,
  type DemoStep,
  type DemoStepId,
  type DemoTapTarget,
} from "@/content/intro-demo";

/** 자동재생 시 스텝 유지 시간 (탭 스텝은 짧게, 시스템 스텝은 길게) */
const TAP_MS = 1900;
const SYSTEM_MS = 2900;

export type DemoPlayer = {
  steps: readonly DemoStep[];
  /** steps 배열 안에서의 커서 */
  cursor: number;
  current: DemoStep;
  /** 전체 순서상의 인덱스 (화면 노출 로직 기준) */
  stepIndex: number;
  stepId: DemoStepId;
  lang: CustomerLang;
  playing: boolean;
  isFirst: boolean;
  isLast: boolean;
  atEnd: boolean;
  next: () => void;
  prev: () => void;
  goto: (i: number) => void;
  restart: () => void;
  setLang: (l: CustomerLang) => void;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  /** 탭 대상이 현재 스텝의 tapTarget과 일치하면 다음 단계로 진행 */
  tap: (target: DemoTapTarget) => void;
};

/**
 * 데모 재생 엔진.
 * - 히어로 티저 / /demo 풀 데모가 같은 로직을 공유한다.
 * - `steps`에 전체(demoSteps) 또는 일부(slice)를 넘겨 재사용.
 * - 일시정지(기본) = 직접 탭 진행, 재생 = 자동 진행.
 */
export function useDemoPlayer(
  steps: readonly DemoStep[] = demoSteps,
  opts?: { autoStart?: boolean }
): DemoPlayer {
  const last = steps.length - 1;
  const autoStart = opts?.autoStart ?? false;

  const [cursor, setCursor] = useState(0);
  const [lang, setLang] = useState<CustomerLang>("en");
  const [playing, setPlaying] = useState(autoStart);

  const next = useCallback(
    () => setCursor((c) => Math.min(c + 1, last)),
    [last]
  );
  const prev = useCallback(() => setCursor((c) => Math.max(c - 1, 0)), []);
  const goto = useCallback(
    (i: number) => setCursor(Math.max(0, Math.min(i, last))),
    [last]
  );
  const restart = useCallback(() => {
    setCursor(0);
    setPlaying(autoStart);
  }, [autoStart]);

  const play = useCallback(() => setPlaying(true), []);
  const pause = useCallback(() => setPlaying(false), []);
  const togglePlay = useCallback(() => setPlaying((p) => !p), []);

  const current = steps[cursor];

  const tap = useCallback(
    (target: DemoTapTarget) => {
      if (target === steps[cursor].tapTarget) next();
    },
    [steps, cursor, next]
  );

  // 자동재생: playing일 때만 타이머로 다음 스텝 진행. 끝에 도달하면 정지.
  // 정지 setState는 이펙트 본문이 아니라 타이머 콜백에서 호출(set-state-in-effect 회피).
  useEffect(() => {
    if (!playing || cursor >= last) return;
    const ms = steps[cursor].tapTarget ? TAP_MS : SYSTEM_MS;
    const t = setTimeout(() => {
      setCursor((c) => Math.min(c + 1, last));
      if (cursor + 1 >= last) setPlaying(false); // 이번 진행으로 끝 도달 → 정지
    }, ms);
    return () => clearTimeout(t);
  }, [playing, cursor, last, steps]);

  return {
    steps,
    cursor,
    current,
    stepIndex: DEMO_STEP_INDEX[current.id as DemoStepId],
    stepId: current.id as DemoStepId,
    lang,
    playing,
    isFirst: cursor === 0,
    isLast: cursor === last,
    atEnd: cursor >= last,
    next,
    prev,
    goto,
    restart,
    setLang,
    play,
    pause,
    togglePlay,
    tap,
  };
}
