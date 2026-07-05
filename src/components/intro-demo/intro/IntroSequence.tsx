"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Languages } from "lucide-react";
import Typewriter from "./Typewriter";
import CustomerScene from "./CustomerScene";
import { intro, type IntroSlide, type Segment } from "@/content/intro-demo";
import { cn } from "@/lib/utils";

const slides = intro.slides;
const LAST = slides.length - 1;
const EASE = [0.22, 1, 0.36, 1] as const;

/** 공통 등장 모션: 블러가 풀리며 부드럽게 올라옴 */
const rise = {
  initial: { opacity: 0, y: 16, filter: "blur(10px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)" },
};

export default function IntroSequence() {
  const [index, setIndex] = useState(0);
  const [done, setDone] = useState(false);

  const finish = useCallback(() => setDone(true), []);

  // 자동 진행
  useEffect(() => {
    if (done) return;
    const t = setTimeout(() => {
      setIndex((i) => {
        if (i >= LAST) {
          finish();
          return i;
        }
        return i + 1;
      });
    }, slides[index].durationMs);
    return () => clearTimeout(t);
  }, [index, done, finish]);

  // 인트로 동안 배경 스크롤 잠금
  useEffect(() => {
    if (done) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [done]);

  const isDark = slides[index].bg === "dark";

  return (
    <AnimatePresence>
      {!done && (
        <motion.div
          key="intro"
          className="fixed inset-0 z-[100] overflow-hidden"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8, ease: "easeInOut" }}
        >
          {/* 불투명 배경 (슬라이드 색에 맞춰 전환) */}
          <motion.div
            className="absolute inset-0"
            animate={{ backgroundColor: isDark ? "#0e0f1e" : "#ffffff" }}
            transition={{ duration: 0.6 }}
          />
          {/* 어두운 화면의 은은한 글로우 */}
          <motion.div
            className="absolute inset-0"
            animate={{ opacity: isDark ? 1 : 0 }}
            transition={{ duration: 0.6 }}
            style={{
              background:
                "radial-gradient(38rem 30rem at 50% 42%, rgba(91,91,214,0.18), transparent 70%)",
            }}
          />

          {/* 슬라이드 */}
          <AnimatePresence initial={false}>
            <motion.div
              key={index}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6, ease: "easeInOut" }}
              className="absolute inset-0"
            >
              <Slide slide={slides[index]} />
            </motion.div>
          </AnimatePresence>

        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Slide({ slide }: { slide: IntroSlide }) {
  if (slide.kind === "hook") return <HookSlide slide={slide} />;
  if (slide.kind === "brand") return <BrandSlide />;
  return <EmpathySlide slide={slide} />;
}

/* ── 슬라이드 1: 타자기 훅 ── */
function HookSlide({ slide }: { slide: Extract<IntroSlide, { kind: "hook" }> }) {
  return (
    <div className="flex h-full items-center justify-center px-8">
      <div className="text-center">
        <Typewriter
          segments={slide.segments}
          className="whitespace-pre-line text-[2rem] font-bold leading-[1.4] tracking-tight text-white sm:text-5xl sm:leading-[1.35]"
        />
      </div>
    </div>
  );
}

/* ── 슬라이드 2·3: 공감 (헤드라인 + 사진 + 상황 연출) ── */
function EmpathySlide({
  slide,
}: {
  slide: Extract<IntroSlide, { kind: "empathy" }>;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-10 px-6 py-16">
      <motion.h2
        variants={rise}
        initial="initial"
        animate="animate"
        transition={{ delay: 0.15, duration: 0.7, ease: EASE }}
        className="whitespace-pre-line text-center text-[1.6rem] font-bold leading-[1.5] tracking-tight text-ink-900 sm:text-[1.9rem]"
      >
        {slide.segments.map((seg: Segment, i) => (
          <span key={i} className={cn(seg.highlight && "text-brand-500")}>
            {seg.text}
          </span>
        ))}
      </motion.h2>

      <motion.div
        variants={rise}
        initial="initial"
        animate="animate"
        transition={{ delay: 0.35, duration: 0.8, ease: EASE }}
        className="relative w-full max-w-[280px]"
      >
        <EmpathyImage src={slide.image} dim={slide.scene === "translator"} />

        {slide.scene === "missed" && (
          <MissedScene
            customerBubble={slide.customerBubble}
            staffBubble={slide.staffBubble}
          />
        )}
        {slide.scene === "translator" && (
          <TranslatorScene
            caption={slide.translatorCaption}
            rows={slide.translations ?? []}
          />
        )}
      </motion.div>
    </div>
  );
}

/**
 * 사진 표시. 파일이 있으면 사진, 없으면 디자인된 폴백(그라디언트 + 인물 아이콘)이 보입니다.
 * dim=true면 위에 오버레이 카드가 잘 읽히도록 살짝 어둡게.
 */
function EmpathyImage({ src, dim }: { src: string; dim?: boolean }) {
  return (
    <div className="relative aspect-[4/5] w-full overflow-hidden rounded-[1.75rem] shadow-[0_30px_70px_-30px_rgba(20,21,43,0.4)] ring-1 ring-ink-900/[0.06]">
      {/* 일러스트 (뒤) — 사진 없이도 완성된 화면 */}
      <CustomerScene className="absolute inset-0 h-full w-full" />
      {/* 사진 (앞) — 파일 넣으면 일러스트 위를 덮음 */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url('${src}')` }}
      />
      {/* 하단 스크림 (오버레이 가독성) */}
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-ink-900/45 to-transparent transition-opacity",
          dim ? "opacity-100" : "opacity-0"
        )}
      />
    </div>
  );
}

/* 슬라이드 2: 손님 질문 → 매장이 답하지 못함 */
function MissedScene({
  customerBubble,
  staffBubble,
}: {
  customerBubble?: string;
  staffBubble?: string;
}) {
  return (
    <>
      {customerBubble && (
        <motion.div
          initial={{ opacity: 0, scale: 0.85, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ delay: 0.7, type: "spring", stiffness: 280, damping: 18 }}
          className="absolute -right-2 -top-5 z-20 rounded-2xl rounded-br-sm bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_12px_32px_-10px_rgba(91,91,214,0.7)]"
        >
          {customerBubble}
        </motion.div>
      )}
      {staffBubble && (
        <motion.div
          initial={{ opacity: 0, scale: 0.85, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ delay: 1.5, type: "spring", stiffness: 280, damping: 20 }}
          className="absolute -bottom-4 -left-2 z-20 flex items-center gap-2 rounded-2xl rounded-bl-sm bg-white px-4 py-2.5 text-sm font-medium text-ink-400 shadow-[0_12px_32px_-12px_rgba(20,21,43,0.35)] ring-1 ring-ink-900/5"
        >
          {staffBubble}
          <span className="flex gap-0.5">
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="h-1 w-1 rounded-full bg-ink-400"
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{
                  duration: 1.1,
                  repeat: Infinity,
                  delay: i * 0.18,
                }}
              />
            ))}
          </span>
        </motion.div>
      )}
    </>
  );
}

/* 슬라이드 3: 번역기로 한 마디씩 힘겹게 주고받는 장면 */
function TranslatorScene({
  caption,
  rows,
}: {
  caption?: string;
  rows: { src: string; dst: string; from: "guest" | "staff" }[];
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: 0.7, duration: 0.6, ease: EASE }}
      className="absolute inset-x-3 bottom-3 z-20 rounded-2xl bg-white/85 p-3 shadow-[0_16px_40px_-16px_rgba(20,21,43,0.5)] ring-1 ring-ink-900/5 backdrop-blur-md"
    >
      {caption && (
        <div className="mb-2 flex items-center gap-1.5 px-0.5">
          <Languages size={13} className="text-brand-500" />
          <span className="text-[11px] font-semibold text-ink-500">
            {caption}
          </span>
        </div>
      )}
      <div className="space-y-1.5">
        {rows.map((r, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: r.from === "guest" ? -8 : 8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.95 + i * 0.55, duration: 0.4 }}
            className={cn(
              "flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-[11px]",
              r.from === "guest"
                ? "bg-ink-900/[0.04] text-ink-500"
                : "bg-brand-500/10 text-brand-700"
            )}
          >
            <span className="truncate">{r.src}</span>
            <ArrowRight size={11} className="shrink-0 text-ink-400" />
            <span className="truncate font-semibold text-ink-700">{r.dst}</span>
          </motion.div>
        ))}
        {/* 번역 중 shimmer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 0] }}
          transition={{ delay: 2.1, duration: 1.6, repeat: Infinity }}
          className="flex items-center gap-1 px-2.5 pt-0.5 text-[10px] font-medium text-ink-400"
        >
          <span className="h-1 w-1 animate-pulse rounded-full bg-brand-400" />
          번역 중…
        </motion.div>
      </div>
    </motion.div>
  );
}

/* ── 슬라이드 4: 브랜드 ── */
function BrandSlide() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2">
      <motion.div
        initial={{ opacity: 0, scale: 0.7, filter: "blur(8px)" }}
        animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
        transition={{ type: "spring", stiffness: 180, damping: 18 }}
      >
        <Image
          src="/logo.png"
          alt="소통 로고"
          width={112}
          height={112}
          className="h-28 w-28 object-contain drop-shadow-[0_12px_36px_rgba(91,91,214,0.5)]"
          priority
          unoptimized
        />
      </motion.div>

      <motion.div
        variants={rise}
        initial="initial"
        animate="animate"
        transition={{ delay: 0.35, duration: 0.7, ease: EASE }}
        className="flex flex-col items-center gap-2"
      >
        <span className="font-serif text-5xl font-light tracking-tight text-white sm:text-6xl">
          소통
        </span>
        <span className="text-[0.8rem] font-medium tracking-[0.35em] text-white/40">
          SOTONG
        </span>
      </motion.div>
    </div>
  );
}
