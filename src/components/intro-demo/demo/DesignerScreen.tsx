"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Bell, Check, MessageSquareText, Sparkles } from "lucide-react";
import {
  demoDesignerSummary,
  demoReply,
  DEMO_STEP_INDEX,
  type CustomerLang,
  type DemoTapTarget,
} from "@/content/intro-demo";
import { cn } from "@/lib/utils";

const I = DEMO_STEP_INDEX;

type Props = {
  stepIndex: number;
  lang: CustomerLang;
  interactive: boolean;
  /** 이번 스텝의 탭 대상 (디자이너 화면이 focus일 때만 값) */
  focusTarget: DemoTapTarget | null;
  onTap: (t: DemoTapTarget) => void;
};

export default function DesignerScreen({
  stepIndex,
  lang,
  interactive,
  focusTarget,
  onTap,
}: Props) {
  const phase =
    stepIndex >= I.report
      ? "complete"
      : stepIndex >= I.reply
        ? "chat"
        : stepIndex >= I.summary
          ? "summary"
          : "waiting";

  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-accent-50/50 to-white">
      <div className="flex items-center justify-between px-5 pb-2 pt-2">
        <p className="text-[13px] font-bold text-ink-900">디자이너</p>
        <Bell size={15} className="text-ink-400" />
      </div>

      <div className="flex-1 overflow-hidden px-4 pb-4">
        <AnimatePresence mode="wait">
          {phase === "waiting" && <WaitingView key="waiting" />}
          {phase === "summary" && <SummaryView key="summary" lang={lang} />}
          {phase === "chat" && (
            <ChatView
              key="chat"
              stepIndex={stepIndex}
              interactive={interactive}
              focusTarget={focusTarget}
              onTap={onTap}
            />
          )}
          {phase === "complete" && <CompleteView key="complete" />}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ───────────────────────── 대기 ───────────────────────── */

function WaitingView() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex h-full flex-col items-center justify-center gap-2 text-center"
    >
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-ink-900/5 text-ink-400">
        <Bell size={20} />
      </span>
      <p className="text-[12px] leading-relaxed text-ink-400">
        손님이 상담을 시작하면
        <br />
        여기로 알림이 옵니다
      </p>
    </motion.div>
  );
}

/* ───────────────────────── 한국어 요약 도착 ───────────────────────── */

function SummaryView({ lang }: { lang: CustomerLang }) {
  const s = demoDesignerSummary;

  return (
    <motion.div
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -16 }}
      className="space-y-3"
    >
      {/* 푸시 배너 */}
      <motion.div
        initial={{ opacity: 0, y: -14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 24 }}
        className="flex items-start gap-2.5 rounded-2xl bg-white p-3 shadow-[var(--shadow-soft)] ring-1 ring-ink-900/5"
      >
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-accent-500 text-white">
          <Bell size={15} />
        </span>
        <div className="min-w-0">
          <p className="text-[12px] font-bold text-ink-900">{s.headline}</p>
          <p className="truncate text-[11px] text-ink-500">
            {s.nationalityByLang[lang]} {s.guest} · 방금 전
          </p>
        </div>
      </motion.div>

      {/* 한국어 정리 카드 */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, type: "spring", stiffness: 260, damping: 24 }}
        className="rounded-2xl bg-white p-3.5 shadow-[var(--shadow-soft)] ring-1 ring-ink-900/5"
      >
        <div className="mb-2 flex items-center gap-1.5">
          <Sparkles size={13} className="text-brand-500" />
          <p className="text-[11px] font-bold uppercase tracking-wide text-brand-600">
            {s.requestLabel}
          </p>
        </div>
        <ul className="space-y-1.5">
          {s.bullets.map((b, i) => (
            <motion.li
              key={b}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + i * 0.12 }}
              className="flex items-start gap-2 text-[12.5px] leading-snug text-ink-700"
            >
              <Check
                size={13}
                strokeWidth={3}
                className="mt-0.5 shrink-0 text-brand-500"
              />
              <span>{b}</span>
            </motion.li>
          ))}
        </ul>
      </motion.div>

      {/* 번역된 질문 */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.55, type: "spring", stiffness: 260, damping: 24 }}
        className="rounded-2xl bg-brand-500 p-3.5 text-white shadow-[var(--shadow-soft)]"
      >
        <p className="text-[10px] font-semibold uppercase tracking-wide text-brand-100">
          {s.translatedQuestionLabel}
        </p>
        <p className="mt-1 text-[15px] font-bold">“{s.translatedQuestion}”</p>
      </motion.div>
    </motion.div>
  );
}

/* ───────────────────────── 양방향 대화 (한국어) ───────────────────────── */

function ChatView({
  stepIndex,
  interactive,
  focusTarget,
  onTap,
}: {
  stepIndex: number;
  interactive: boolean;
  focusTarget: DemoTapTarget | null;
  onTap: (t: DemoTapTarget) => void;
}) {
  const s = demoDesignerSummary;
  const replied = stepIndex >= I.replied;
  const spotlighted = focusTarget === "reply" && !replied;
  const clickable = interactive && spotlighted;

  return (
    <motion.div
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -16 }}
      className="flex h-full flex-col"
    >
      <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-ink-400">
        <MessageSquareText size={13} className="text-brand-500" />
        상담 대화 · 자동 번역
      </div>

      {/* 스레드 */}
      <div className="flex flex-1 flex-col gap-2 overflow-hidden">
        {/* 손님 질문 (번역돼 도착) */}
        <div className="mr-auto max-w-[85%]">
          <div className="rounded-2xl rounded-tl-sm bg-white px-3.5 py-2.5 text-[13px] font-medium text-ink-800 shadow-sm ring-1 ring-ink-900/5">
            {s.translatedQuestion}
          </div>
          <p className="mt-0.5 pl-1 text-[10px] text-ink-400">
            {s.guest} · 번역됨
          </p>
        </div>

        {/* 디자이너 답장 */}
        <AnimatePresence>
          {replied && (
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 24 }}
              className="ml-auto max-w-[85%]"
            >
              <div className="rounded-2xl rounded-tr-sm bg-brand-500 px-3.5 py-2.5 text-[13px] font-medium text-white shadow-sm">
                {demoReply.answerKo}
              </div>
              <p className="mt-0.5 flex items-center justify-end gap-1 pr-1 text-[10px] font-medium text-brand-500">
                <Check size={11} strokeWidth={3} />
                손님 언어로 전송됨
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 빠른 답장 칩 (아직 답 안 했을 때) */}
      <AnimatePresence>
        {!replied && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="mt-2 border-t border-ink-900/5 pt-2.5"
          >
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-400">
              {demoReply.label}
            </p>
            <div className="flex flex-col gap-1.5">
              {demoReply.chips.map((chip, i) => {
                const isTarget = i === 0;
                const chipSpot = isTarget && spotlighted;
                const chipClickable = isTarget && clickable;
                return (
                  <motion.button
                    key={chip}
                    type="button"
                    whileTap={chipClickable ? { scale: 0.97 } : undefined}
                    onClick={() => chipClickable && onTap("reply")}
                    className={cn(
                      "flex items-center justify-between rounded-full px-3.5 py-2 text-left text-[12px] font-semibold transition-all",
                      isTarget
                        ? "bg-brand-500 text-white"
                        : "bg-white text-ink-500 ring-1 ring-ink-900/10",
                      chipSpot &&
                        (interactive
                          ? "ring-2 ring-brand-400 shadow-[0_0_0_4px_rgba(130,134,248,0.18)]"
                          : "ring-2 ring-brand-300"),
                      chipClickable ? "cursor-pointer" : "cursor-default"
                    )}
                  >
                    <span>{chip}</span>
                    {chipClickable && (
                      <span className="ml-2 shrink-0 text-[10px] font-bold text-brand-100">
                        👆 탭
                      </span>
                    )}
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ───────────────────────── 시술 완료 · 리포트 발송 ───────────────────────── */

function CompleteView() {
  return (
    <motion.div
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -16 }}
      className="flex h-full flex-col"
    >
      {/* 완료 배너 */}
      <div className="flex items-center gap-2.5 rounded-2xl bg-white p-3 shadow-[var(--shadow-soft)] ring-1 ring-ink-900/5">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-brand-500 text-white">
          <Check size={16} strokeWidth={3} />
        </span>
        <div>
          <p className="text-[12.5px] font-bold text-ink-900">시술 완료</p>
          <p className="text-[11px] text-ink-500">30초 기록으로 마무리</p>
        </div>
      </div>

      {/* 30초 기록 (전/후) */}
      <div className="mt-3 rounded-2xl bg-white p-3.5 shadow-[var(--shadow-soft)] ring-1 ring-ink-900/5">
        <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-ink-400">
          전 · 후 기록
        </p>
        <div className="grid grid-cols-2 gap-2">
          <BeforeAfter label="Before" from="from-ink-200" to="to-ink-100" />
          <BeforeAfter label="After" from="from-brand-200" to="to-accent-100" />
        </div>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {["컷 + 펌", "보습 펌약", "손상케어"].map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-brand-50 px-2 py-0.5 text-[10.5px] font-semibold text-brand-600"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* 리포트 발송 */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mt-3 flex items-center gap-2 rounded-2xl bg-brand-500 px-3.5 py-3 text-white shadow-[var(--shadow-soft)]"
      >
        <Sparkles size={15} className="shrink-0" />
        <p className="text-[12px] font-semibold leading-snug">
          손님 언어로 헤어 리포트를
          <br />
          자동 발송했어요 →
        </p>
      </motion.div>
    </motion.div>
  );
}

function BeforeAfter({
  label,
  from,
  to,
}: {
  label: string;
  from: string;
  to: string;
}) {
  return (
    <div
      className={cn(
        "relative grid h-20 place-items-center rounded-xl bg-gradient-to-br",
        from,
        to
      )}
    >
      <span className="absolute left-1.5 top-1.5 rounded-md bg-white/70 px-1.5 py-0.5 text-[9px] font-bold text-ink-700">
        {label}
      </span>
    </div>
  );
}
