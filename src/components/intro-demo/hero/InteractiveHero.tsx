"use client";

import { motion } from "framer-motion";
import { ArrowRight, Hand } from "lucide-react";
import Container from "@/components/intro-demo/Container";
import CTAButton from "@/components/intro-demo/CTAButton";
import DemoStage from "@/components/intro-demo/demo/DemoStage";
import { hero } from "@/content/intro-demo";

export default function InteractiveHero() {
  return (
    <section className="relative overflow-hidden bg-mesh">
      <Container className="py-14 sm:py-18 lg:py-20">
        {/* ── 카피 ── */}
        <div className="mx-auto max-w-3xl text-center">
          <motion.span
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-sm font-semibold text-brand-600 shadow-sm ring-1 ring-brand-500/10"
          >
            <Hand size={14} />
            직접 해보는 데모
          </motion.span>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.05 }}
            className="mt-5 text-4xl font-bold leading-[1.12] tracking-tight text-ink-900 sm:text-5xl lg:text-6xl"
          >
            {hero.title[0]}
            <br />
            <span className="text-brand-500">{hero.title[1]}</span>
          </motion.h1>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.12 }}
            className="mx-auto mt-5 max-w-xl space-y-3 text-lg leading-relaxed text-ink-500"
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

        {/* ── 인터랙티브 티저 (요약 도착까지 맛보기 → 전체 데모로) ── */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="mx-auto mt-12 max-w-4xl"
        >
          <div className="mb-3 flex items-center justify-center gap-2 text-sm font-medium text-ink-500">
            <motion.span
              animate={{ y: [0, -3, 0] }}
              transition={{ repeat: Infinity, duration: 1.6 }}
            >
              👆
            </motion.span>
            손님이 되어 직접 탭해보세요
          </div>
          <DemoStage
            variant="teaser"
            ctaHref="#demo"
            ctaLabel="전체 데모 보기"
          />
        </motion.div>
      </Container>
    </section>
  );
}
