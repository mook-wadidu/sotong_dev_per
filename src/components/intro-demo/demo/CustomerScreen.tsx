"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, Send, Sparkles, Star } from "lucide-react";
import {
  customerLangs,
  demoOptions,
  demoQuestion,
  demoReply,
  demoReport,
  demoReportScore,
  DEMO_STEP_INDEX,
  type CustomerLang,
  type DemoTapTarget,
} from "@/content/intro-demo";
import { cn } from "@/lib/utils";

const I = DEMO_STEP_INDEX;

const uiText: Record<
  CustomerLang,
  {
    header: string;
    pickLang: string;
    service: string;
    detail: string;
    ask: string;
    tap: string;
    chatTitle: string;
    sending: string;
    translated: string;
  }
> = {
  en: {
    header: "Welcome! Tell us about your style",
    pickLang: "Your language",
    service: "What would you like today?",
    detail: "Any details?",
    ask: "Ask anything",
    tap: "👆 Tap",
    chatTitle: "Consultation",
    sending: "Sending…",
    translated: "Translated for you",
  },
  zh: {
    header: "欢迎！告诉我们您想要的造型",
    pickLang: "您的语言",
    service: "今天想做什么？",
    detail: "还有其他要求吗？",
    ask: "有任何问题都可以问",
    tap: "👆 点击",
    chatTitle: "咨询",
    sending: "发送中…",
    translated: "已为您翻译",
  },
  ja: {
    header: "ようこそ！ご希望のスタイルを教えてください",
    pickLang: "あなたの言語",
    service: "本日は何をご希望ですか？",
    detail: "ご要望はありますか？",
    ask: "何でも聞いてください",
    tap: "👆 タップ",
    chatTitle: "相談",
    sending: "送信中…",
    translated: "あなたのために翻訳しました",
  },
};

type Props = {
  /** 전체 순서상의 인덱스 (DEMO_STEP_INDEX) */
  stepIndex: number;
  lang: CustomerLang;
  /** 일시정지(직접 탭) 여부 */
  interactive: boolean;
  /** 이번 스텝의 탭 대상 (손님 화면이 focus일 때만 값) */
  focusTarget: DemoTapTarget | null;
  onTap: (t: DemoTapTarget) => void;
};

export default function CustomerScreen({
  stepIndex,
  lang,
  interactive,
  focusTarget,
  onTap,
}: Props) {
  const t = uiText[lang];
  const phase =
    stepIndex >= I.report ? "report" : stepIndex >= I.summary ? "chat" : "intake";

  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-brand-50/60 to-white">
      <AnimatePresence mode="wait">
        {phase === "intake" && (
          <IntakeView
            key="intake"
            t={t}
            lang={lang}
            stepIndex={stepIndex}
            interactive={interactive}
            focusTarget={focusTarget}
            onTap={onTap}
          />
        )}
        {phase === "chat" && (
          <ChatView key="chat" t={t} lang={lang} stepIndex={stepIndex} />
        )}
        {phase === "report" && <ReportView key="report" lang={lang} />}
      </AnimatePresence>
    </div>
  );
}

/* ───────────────────────── 접수 (intake) ───────────────────────── */

function IntakeView({
  t,
  lang,
  stepIndex,
  interactive,
  focusTarget,
  onTap,
}: {
  t: (typeof uiText)[CustomerLang];
  lang: CustomerLang;
  stepIndex: number;
  interactive: boolean;
  focusTarget: DemoTapTarget | null;
  onTap: (target: DemoTapTarget) => void;
}) {
  const showService = stepIndex >= I.service;
  const serviceSelected = stepIndex > I.service;
  const showDetail = stepIndex >= I.detail;
  const detailSelected = stepIndex > I.detail;
  const showSend = stepIndex >= I.question;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex h-full flex-col"
    >
      <div className="px-5 pb-2 pt-2">
        <p className="text-[13px] font-semibold leading-snug text-ink-900">
          {t.header}
        </p>
      </div>

      <div className="flex-1 space-y-3 overflow-hidden px-5 pb-4">
        {/* 언어 (선택 반영, 탭은 상단 토글에서) */}
        <div>
          <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-ink-400">
            {t.pickLang}
          </p>
          <div className="flex gap-1.5">
            {customerLangs.map((l) => (
              <div
                key={l.code}
                className={cn(
                  "flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-all",
                  l.code === lang
                    ? "bg-brand-500 text-white shadow-sm"
                    : "bg-white text-ink-400 ring-1 ring-ink-900/5"
                )}
              >
                <span>{l.flag}</span>
                <span>{l.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 시술 */}
        <AnimatePresence>
          {showService && (
            <TapField
              key="service"
              label={t.service}
              value={demoOptions.service.label[lang]}
              selected={serviceSelected}
              target="service"
              focusTarget={focusTarget}
              interactive={interactive}
              tapHint={t.tap}
              onTap={onTap}
            />
          )}
        </AnimatePresence>

        {/* 디테일 */}
        <AnimatePresence>
          {showDetail && (
            <TapField
              key="detail"
              label={t.detail}
              value={demoOptions.detail.label[lang]}
              selected={detailSelected}
              target="detail"
              focusTarget={focusTarget}
              interactive={interactive}
              tapHint={t.tap}
              onTap={onTap}
            />
          )}
        </AnimatePresence>

        {/* 질문 전송 */}
        <AnimatePresence>
          {showSend && (
            <motion.div
              key="send"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 26 }}
              className="pt-0.5"
            >
              <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-ink-400">
                {t.ask}
              </p>
              <SendButton
                text={demoQuestion[lang]}
                target="send"
                focusTarget={focusTarget}
                interactive={interactive}
                tapHint={t.tap}
                onTap={onTap}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function TapField({
  label,
  value,
  selected,
  target,
  focusTarget,
  interactive,
  tapHint,
  onTap,
}: {
  label: string;
  value: string;
  selected: boolean;
  target: DemoTapTarget;
  focusTarget: DemoTapTarget | null;
  interactive: boolean;
  tapHint: string;
  onTap: (t: DemoTapTarget) => void;
}) {
  const spotlighted = focusTarget === target && !selected;
  const clickable = interactive && spotlighted;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={{ type: "spring", stiffness: 320, damping: 26 }}
    >
      <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-ink-400">
        {label}
      </p>
      <motion.button
        type="button"
        whileTap={clickable ? { scale: 0.97 } : undefined}
        onClick={() => clickable && onTap(target)}
        className={cn(
          "flex w-full items-center gap-2 rounded-2xl px-3 py-2.5 text-left transition-all",
          selected
            ? "bg-brand-500/10 ring-1 ring-brand-500/25"
            : "bg-white ring-1 ring-ink-900/10",
          spotlighted &&
            (interactive
              ? "ring-2 ring-brand-400 shadow-[0_0_0_4px_rgba(130,134,248,0.18)]"
              : "ring-2 ring-brand-300"),
          clickable ? "cursor-pointer" : "cursor-default"
        )}
      >
        <span
          className={cn(
            "grid h-5 w-5 shrink-0 place-items-center rounded-full transition-colors",
            selected ? "bg-brand-500 text-white" : "bg-ink-900/5 text-transparent"
          )}
        >
          <Check size={13} strokeWidth={3} />
        </span>
        <span
          className={cn(
            "text-[12.5px] font-semibold",
            selected ? "text-brand-700" : "text-ink-700"
          )}
        >
          {value}
        </span>
        {clickable && (
          <span className="ml-auto shrink-0 text-[10px] font-bold text-brand-500">
            {tapHint}
          </span>
        )}
      </motion.button>
    </motion.div>
  );
}

function SendButton({
  text,
  target,
  focusTarget,
  interactive,
  tapHint,
  onTap,
}: {
  text: string;
  target: DemoTapTarget;
  focusTarget: DemoTapTarget | null;
  interactive: boolean;
  tapHint: string;
  onTap: (t: DemoTapTarget) => void;
}) {
  const spotlighted = focusTarget === target;
  const clickable = interactive && spotlighted;

  return (
    <motion.button
      type="button"
      whileTap={clickable ? { scale: 0.97 } : undefined}
      onClick={() => clickable && onTap(target)}
      className={cn(
        "flex w-full items-center justify-between rounded-2xl bg-white px-3.5 py-2.5 text-left ring-1 ring-ink-900/10 transition-all",
        spotlighted &&
          (interactive
            ? "ring-2 ring-brand-400 shadow-[0_0_0_4px_rgba(130,134,248,0.18)]"
            : "ring-2 ring-brand-300"),
        clickable ? "cursor-pointer" : "cursor-default"
      )}
    >
      <span className="truncate text-[12.5px] font-medium text-ink-500">
        “{text}”
      </span>
      <span className="ml-2 flex shrink-0 items-center gap-1.5">
        {clickable && (
          <span className="text-[10px] font-bold text-brand-500">{tapHint}</span>
        )}
        <span className="grid h-7 w-7 place-items-center rounded-full bg-brand-500 text-white">
          <Send size={13} />
        </span>
      </span>
    </motion.button>
  );
}

/* ───────────────────────── 대화 (chat) ───────────────────────── */

function ChatView({
  t,
  lang,
  stepIndex,
}: {
  t: (typeof uiText)[CustomerLang];
  lang: CustomerLang;
  stepIndex: number;
}) {
  const replied = stepIndex >= I.replied;

  return (
    <motion.div
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -16 }}
      className="flex h-full flex-col"
    >
      <div className="border-b border-ink-900/5 px-5 pb-2 pt-2">
        <p className="text-[13px] font-bold text-ink-900">{t.chatTitle}</p>
      </div>

      <div className="flex flex-1 flex-col gap-2.5 overflow-hidden px-4 py-4">
        {/* 손님 질문 */}
        <div className="ml-auto max-w-[82%] rounded-2xl rounded-tr-sm bg-brand-500 px-3.5 py-2.5 text-[13px] font-medium text-white shadow-sm">
          {demoQuestion[lang]}
        </div>

        {/* 디자이너 답장 */}
        <AnimatePresence mode="wait">
          {!replied ? (
            <motion.div
              key="typing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="mr-auto flex items-center gap-1 rounded-2xl rounded-tl-sm bg-white px-3.5 py-3 shadow-sm ring-1 ring-ink-900/5"
            >
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="h-1.5 w-1.5 rounded-full bg-ink-400"
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ repeat: Infinity, duration: 1.1, delay: i * 0.18 }}
                />
              ))}
            </motion.div>
          ) : (
            <motion.div
              key="reply"
              initial={{ opacity: 0, y: 12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 24 }}
              className="mr-auto max-w-[82%]"
            >
              <div className="rounded-2xl rounded-tl-sm bg-white px-3.5 py-2.5 text-[13px] font-medium text-ink-800 shadow-sm ring-1 ring-ink-900/5">
                {demoReply.answer[lang]}
              </div>
              <p className="mt-1 flex items-center gap-1 pl-1 text-[10px] font-medium text-brand-500">
                <Sparkles size={10} />
                {t.translated} · {demoReply.customerNote[lang]}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

/* ───────────────────────── 리포트 (report) ───────────────────────── */

function ReportView({ lang }: { lang: CustomerLang }) {
  const r = demoReport[lang];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="h-full overflow-y-auto px-4 py-3"
    >
      {/* 헤더 */}
      <div className="rounded-2xl bg-gradient-to-br from-brand-500 to-brand-600 px-4 py-3.5 text-white shadow-[var(--shadow-soft)]">
        <p className="text-[15px] font-bold">{r.title}</p>
        <p className="mt-0.5 text-[11px] text-brand-100">{r.salon}</p>
      </div>

      {/* 헤어 상태 점수 */}
      <div className="mt-3 flex items-center gap-3 rounded-2xl bg-white p-3.5 shadow-[var(--shadow-soft)] ring-1 ring-ink-900/5">
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-brand-50">
          <span className="text-[18px] font-extrabold leading-none text-brand-600">
            {demoReportScore}
          </span>
        </div>
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wide text-ink-400">
            {r.scoreLabel}
          </p>
          <p className="text-[15px] font-bold text-ink-900">{r.grade}</p>
        </div>
      </div>

      {/* 시술 + 제품 */}
      <div className="mt-3 space-y-3 rounded-2xl bg-white p-3.5 shadow-[var(--shadow-soft)] ring-1 ring-ink-900/5">
        <ReportRow label={r.serviceLabel}>
          <span className="text-[12.5px] font-semibold text-ink-800">
            {r.service}
          </span>
        </ReportRow>
        <div className="h-px bg-ink-900/5" />
        <ReportRow label={r.productsLabel}>
          <ul className="space-y-1">
            {r.products.map((p) => (
              <li
                key={p}
                className="flex items-start gap-1.5 text-[12px] text-ink-700"
              >
                <Check
                  size={12}
                  strokeWidth={3}
                  className="mt-0.5 shrink-0 text-brand-500"
                />
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </ReportRow>
        <div className="h-px bg-ink-900/5" />
        <ReportRow label={r.homeCareLabel}>
          <p className="text-[12px] leading-snug text-ink-700">{r.homeCare}</p>
        </ReportRow>
        <div className="h-px bg-ink-900/5" />
        <ReportRow label={r.nextVisitLabel}>
          <span className="text-[12.5px] font-semibold text-accent-500">
            {r.nextVisit}
          </span>
        </ReportRow>
      </div>

      {/* 인사 */}
      <div className="mt-3 flex items-center gap-2 rounded-2xl bg-accent-50 px-3.5 py-3 text-[12px] font-medium text-accent-600">
        <Star size={14} className="shrink-0 fill-accent-400 text-accent-400" />
        <span>{r.thanks}</span>
      </div>
    </motion.div>
  );
}

function ReportRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-ink-400">
        {label}
      </p>
      {children}
    </div>
  );
}
