"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  RotateCcw,
} from "lucide-react";
import PhoneFrame from "@/components/intro-demo/PhoneFrame";
import CustomerScreen from "./CustomerScreen";
import DesignerScreen from "./DesignerScreen";
import GuidedHint from "./GuidedHint";
import { useDemoPlayer } from "./useDemoPlayer";
import {
  customerLangs,
  demoActs,
  demoSteps,
  type DemoTapTarget,
} from "@/content/intro-demo";
import { cn } from "@/lib/utils";

/** 티저는 액트①(요청)~②(도착)까지 = 요약 도착 시점에서 멈춤 */
const TEASER_STEPS = demoSteps.slice(
  0,
  demoSteps.findIndex((s) => s.id === "summary") + 1
);

const tapInstruction: Record<DemoTapTarget, string> = {
  lang: "위에서 손님 언어를 골라보세요",
  service: "하이라이트된 시술을 눌러보세요",
  detail: "하이라이트된 디테일을 눌러보세요",
  send: "‘보내기’를 눌러 전송하세요",
  reply: "‘빠른 답장’을 눌러보세요",
};

export default function DemoStage({
  variant = "full",
  autoStart = true,
  ctaHref = "#demo",
  ctaLabel = "전체 데모 보기",
  className,
}: {
  variant?: "full" | "teaser";
  autoStart?: boolean;
  ctaHref?: string;
  ctaLabel?: string;
  className?: string;
}) {
  const steps = variant === "teaser" ? TEASER_STEPS : demoSteps;
  const p = useDemoPlayer(steps, { autoStart });

  const current = p.current;
  const act = demoActs[current.act];
  const interactive = !p.playing;
  const focusCustomer = current.focus === "customer";
  const customerTarget: DemoTapTarget | null =
    focusCustomer ? current.tapTarget : null;
  const designerTarget: DemoTapTarget | null =
    !focusCustomer ? current.tapTarget : null;

  // 진행: 액트 세그먼트
  const actsInPlay: number[] = Array.from(new Set(steps.map((s) => s.act)));
  const currentActPos = actsInPlay.indexOf(current.act);

  const actFraction = (actId: number) => {
    if (actId < current.act) return 1;
    if (actId > current.act) return 0;
    const idxs = steps
      .map((s, i) => (s.act === actId ? i : -1))
      .filter((i) => i >= 0);
    const first = idxs[0];
    const span = idxs[idxs.length - 1] - first;
    return span === 0 ? 1 : (p.cursor - first) / span;
  };

  const isSystemStep = current.tapTarget === null;
  const teaserDone = variant === "teaser" && p.atEnd;

  // 언어 토글 클릭: 언어 변경 + 처음부터 다시 재생 (자동재생)
  const onPickLang = (code: (typeof customerLangs)[number]["code"]) => {
    p.setLang(code);
    p.restart();
  };

  return (
    <div
      className={cn(
        "rounded-3xl bg-white p-5 shadow-[var(--shadow-float)] ring-1 ring-ink-900/5 sm:p-7",
        className
      )}
    >
      {/* ── 챕터 헤더 + 진행 세그먼트 ── */}
      <div className="mb-5">
        <div className="mb-2 flex items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-brand-500">
              STEP {currentActPos + 1} / {actsInPlay.length}
            </p>
            <h3 className="mt-0.5 text-base font-bold text-ink-900 sm:text-lg">
              {act.title}
            </h3>
          </div>
          {/* 손님 언어 토글 */}
          <div className="flex flex-col items-end gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-400">
              손님 언어
            </span>
            <GuidedHint
              active={interactive && current.tapTarget === "lang"}
              label="언어 선택"
              position="bottom"
            >
              <div className="flex gap-1 rounded-full bg-brand-50 p-1">
                {customerLangs.map((l) => (
                  <button
                    key={l.code}
                    type="button"
                    onClick={() => onPickLang(l.code)}
                    className={cn(
                      "flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-semibold transition-all",
                      l.code === p.lang
                        ? "bg-white text-brand-700 shadow-sm"
                        : "text-ink-400 hover:text-ink-700"
                    )}
                  >
                    <span>{l.flag}</span>
                    <span className="hidden sm:inline">{l.label}</span>
                  </button>
                ))}
              </div>
            </GuidedHint>
          </div>
        </div>

        {/* 세그먼트 진행바 */}
        <div className="flex gap-1.5">
          {actsInPlay.map((a) => (
            <div
              key={a}
              className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-900/10"
            >
              <motion.div
                className="h-full rounded-full bg-brand-500"
                initial={false}
                animate={{ width: `${actFraction(a) * 100}%` }}
                transition={{ type: "spring", stiffness: 180, damping: 26 }}
              />
            </div>
          ))}
        </div>
        <p className="mt-2 text-[12.5px] leading-snug text-ink-500">
          {act.valueNote}
        </p>
      </div>

      {/* ── 폰 2대 ── */}
      <div className="flex flex-col items-center justify-center gap-5 sm:flex-row sm:gap-7 lg:gap-10">
        <PhoneStage active={focusCustomer}>
          <PhoneFrame label="손님 화면" tone="brand">
            <CustomerScreen
              stepIndex={p.stepIndex}
              lang={p.lang}
              interactive={interactive}
              focusTarget={customerTarget}
              onTap={p.tap}
            />
          </PhoneFrame>
        </PhoneStage>

        {/* 연결 화살표 */}
        <div className="flex shrink-0 flex-col items-center gap-1">
          <motion.div
            animate={{ scale: p.stepIndex >= 4 ? [1, 1.12, 1] : 1 }}
            transition={{
              repeat: p.stepIndex >= 4 ? Infinity : 0,
              duration: 1.4,
            }}
            className={cn(
              "grid h-10 w-10 place-items-center rounded-full text-white transition-colors",
              p.stepIndex >= 4 ? "bg-brand-500" : "bg-ink-900/15"
            )}
          >
            <ArrowRight size={20} className="hidden sm:block" />
            <ChevronRight size={20} className="rotate-90 sm:hidden" />
          </motion.div>
          <span className="text-[10px] font-medium text-ink-400">자동 번역</span>
        </div>

        <PhoneStage active={!focusCustomer}>
          <PhoneFrame label="디자이너 화면" tone="accent">
            <DesignerScreen
              stepIndex={p.stepIndex}
              lang={p.lang}
              interactive={interactive}
              focusTarget={designerTarget}
              onTap={p.tap}
            />
          </PhoneFrame>
        </PhoneStage>
      </div>

      {/* ── 자막 + 지시 ── */}
      <div className="mt-6 text-center">
        <p className="mx-auto min-h-[1.5rem] max-w-md text-[15px] font-semibold text-ink-900">
          {current.caption}
        </p>
        <div className="mt-1.5 flex min-h-[1.25rem] items-center justify-center">
          {teaserDone ? null : p.playing ? (
            <span className="text-[12px] font-medium text-ink-400">
              자동 재생 중…
            </span>
          ) : p.atEnd ? (
            <span className="text-[12px] font-medium text-brand-500">
              끝까지 보셨어요! 다시 볼 수 있어요
            </span>
          ) : isSystemStep ? (
            <span className="text-[12px] font-medium text-brand-500">
              ‘계속’을 눌러 다음으로
            </span>
          ) : (
            <span className="text-[12px] font-semibold text-brand-500">
              👆 {tapInstruction[current.tapTarget as DemoTapTarget]}
            </span>
          )}
        </div>
      </div>

      {/* ── 티저 종료 CTA ── */}
      <AnimatePresence>
        {teaserDone && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 flex flex-col items-center gap-3"
          >
            <Link
              href={ctaHref}
              className="inline-flex items-center gap-2 rounded-full bg-brand-500 px-6 py-3 text-sm font-semibold text-white shadow-[0_8px_24px_-6px_rgba(91,91,214,0.6)] transition-all hover:-translate-y-0.5 hover:bg-brand-600"
            >
              {ctaLabel}
              <ArrowRight size={17} />
            </Link>
            <button
              type="button"
              onClick={p.restart}
              className="inline-flex items-center gap-1.5 text-[12px] font-medium text-ink-400 hover:text-ink-700"
            >
              <RotateCcw size={13} />
              다시 해보기
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── 컨트롤 ── */}
      {!teaserDone && (
        <div className="mt-5 flex items-center justify-center gap-3">
          <ControlButton onClick={p.prev} disabled={p.isFirst} label="이전">
            <ChevronLeft size={18} />
          </ControlButton>

          <CenterAction
            playing={p.playing}
            atEnd={p.atEnd}
            isSystemStep={isSystemStep}
            continueLabel={current.continueLabel}
            onContinue={p.next}
            onPlay={p.play}
            onPause={p.pause}
            onRestart={p.restart}
          />

          <ControlButton onClick={p.next} disabled={p.isLast} label="다음">
            <ChevronRight size={18} />
          </ControlButton>
        </div>
      )}

      {/* ── 진행 점 ── */}
      {!teaserDone && (
        <div className="mt-4 flex items-center justify-center gap-1.5">
          {steps.map((s, i) => (
            <button
              key={s.id}
              type="button"
              aria-label={`${i + 1}단계로 이동`}
              onClick={() => {
                p.pause();
                p.goto(i);
              }}
              className={cn(
                "h-2 rounded-full transition-all",
                i === p.cursor
                  ? "w-6 bg-brand-500"
                  : i < p.cursor
                    ? "w-2 bg-brand-300"
                    : "w-2 bg-ink-900/10"
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* 포커스된 폰을 강조, 반대쪽은 살짝 흐리게 */
function PhoneStage({
  active,
  children,
}: {
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      animate={{ opacity: active ? 1 : 0.62, scale: active ? 1 : 0.97 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

function CenterAction({
  playing,
  atEnd,
  isSystemStep,
  continueLabel,
  onContinue,
  onPlay,
  onPause,
  onRestart,
}: {
  playing: boolean;
  atEnd: boolean;
  isSystemStep: boolean;
  continueLabel?: string;
  onContinue: () => void;
  onPlay: () => void;
  onPause: () => void;
  onRestart: () => void;
}) {
  const base =
    "inline-flex min-w-[128px] items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-all";

  if (atEnd) {
    return (
      <button
        type="button"
        onClick={onRestart}
        className={cn(base, "bg-brand-500 text-white hover:bg-brand-600")}
      >
        <RotateCcw size={16} />
        다시 보기
      </button>
    );
  }
  if (playing) {
    return (
      <button
        type="button"
        onClick={onPause}
        className={cn(base, "bg-brand-500 text-white hover:bg-brand-600")}
      >
        <Pause size={16} />
        일시정지
      </button>
    );
  }
  if (isSystemStep) {
    return (
      <button
        type="button"
        onClick={onContinue}
        className={cn(base, "bg-brand-500 text-white hover:bg-brand-600")}
      >
        {continueLabel ?? "계속"}
        <ArrowRight size={16} />
      </button>
    );
  }
  // 탭 스텝: 직접 탭이 기본, 대신 자동재생 제공
  return (
    <button
      type="button"
      onClick={onPlay}
      className={cn(
        base,
        "bg-white text-ink-700 ring-1 ring-inset ring-ink-900/10 hover:ring-brand-300"
      )}
    >
      <Play size={16} />
      자동재생
    </button>
  );
}

function ControlButton({
  onClick,
  disabled,
  label,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="grid h-10 w-10 place-items-center rounded-full text-ink-700 ring-1 ring-inset ring-ink-900/10 transition-all hover:bg-ink-900/5 disabled:opacity-30"
    >
      {children}
    </button>
  );
}
