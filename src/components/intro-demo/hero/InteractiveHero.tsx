"use client";

import { useRef } from "react";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import Container from "@/components/intro-demo/Container";
import CTAButton from "@/components/intro-demo/CTAButton";
import { DemoPlayer } from "@/components/demo/demo-player";
import { hero } from "@/content/intro-demo";

export default function InteractiveHero() {
  // 폰 프리뷰 뷰포트 — 데모가 화면을 넘길 때마다 이 컨테이너만 최상단으로.
  const phoneViewport = useRef<HTMLDivElement>(null);

  return (
    <section className="relative overflow-hidden bg-mesh">
      <Container className="grid items-center gap-10 py-14 sm:py-18 lg:grid-cols-2 lg:gap-12 lg:py-20">
        {/* ── 카피 (좌측 정렬) ── */}
        <div className="max-w-3xl text-left">
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.05 }}
            className="text-4xl font-bold leading-[1.12] tracking-tight text-ink-900 sm:text-5xl lg:text-6xl"
          >
            {hero.title[0]}
            <br />
            <span className="text-brand-500">{hero.title[1]}</span>
          </motion.h1>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.12 }}
            className="mt-5 max-w-xl space-y-3 text-lg leading-relaxed text-ink-500"
          >
            {hero.subtitle.map((p, i) => (
              <p key={i} className="whitespace-pre-line">
                {p}
              </p>
            ))}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.18 }}
            className="mt-8 flex flex-wrap justify-center gap-3"
          >
            <CTAButton href={hero.primaryCta.href}>
              {hero.primaryCta.label}
              <ArrowRight size={18} />
            </CTAButton>
            <CTAButton href={hero.secondaryCta.href} variant="secondary">
              {hero.secondaryCta.label}
            </CTAButton>
          </motion.div>

          <dl className="mt-10 flex justify-center gap-8">
            {hero.stats.map((s) => (
              <div key={s.label}>
                <dt className="text-2xl font-bold text-ink-900">{s.value}</dt>
                <dd className="text-sm text-ink-400">{s.label}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* ── 폰 프리뷰 — '데모 보기'가 여는 흐름(/demo/play)이 폰 안에서 자동 재생·반복 ── */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="flex justify-center lg:justify-end"
        >
          <div className="relative w-full max-w-[330px] rounded-[2.75rem] bg-ink-900 p-3 shadow-[var(--shadow-phone)]">
            {/* 노치 */}
            <div
              aria-hidden="true"
              className="absolute left-1/2 top-3 z-20 h-6 w-32 -translate-x-1/2 rounded-b-2xl bg-ink-900"
            />
            <div
              ref={phoneViewport}
              className="relative h-[620px] overflow-y-auto overscroll-contain rounded-[2.25rem] bg-background [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              <DemoPlayer
                embedded
                autoPlay
                loop
                scrollHostRef={phoneViewport}
              />
            </div>
          </div>
        </motion.div>
      </Container>
    </section>
  );
}
