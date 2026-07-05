import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, Check, Clock, Languages, QrCode } from "lucide-react";
import Container from "@/components/intro-demo/Container";
import Section, {
  Reveal,
  SectionHeading,
} from "@/components/intro-demo/Section";
import Nav from "@/components/intro-demo/Nav";
import Footer from "@/components/intro-demo/Footer";
import IntroSequence from "@/components/intro-demo/intro/IntroSequence";
import InteractiveHero from "@/components/intro-demo/hero/InteractiveHero";
import DemoStage from "@/components/intro-demo/demo/DemoStage";
import { benefits, demoPage, how } from "@/content/intro-demo";

const benefitIcons: Record<string, ReactNode> = {
  clock: <Clock size={22} />,
  languages: <Languages size={22} />,
  qr: <QrCode size={22} />,
};

/**
 * demo_intro 랜딩+데모를 하나로 합친 자기완결형 퍼널.
 * 메인 레포 `/[locale]/demo` 라우트에서 렌더된다(로케일 무관, 한국어 마케팅).
 * 내부 링크는 모두 같은 페이지 앵커(#features/#how/#demo).
 */
export default function IntroDemoFunnel() {
  return (
    <div id="top" className="min-h-dvh bg-background">
      <Nav />
      <IntroSequence />
      <InteractiveHero />

      {/* ── 혜택 ── */}
      <Section id="features">
        <SectionHeading title={benefits.title} subtitle={benefits.subtitle} />
        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {benefits.items.map((b, i) => (
            <Reveal key={b.title} delay={i * 0.1}>
              <div className="h-full rounded-3xl bg-white p-7 shadow-[var(--shadow-soft)] ring-1 ring-ink-900/5 transition-all hover:-translate-y-1 hover:shadow-[var(--shadow-float)]">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand-600">
                  {benefitIcons[b.icon]}
                </span>
                <h3 className="mt-5 text-xl font-bold text-ink-900">
                  {b.title}
                </h3>
                <p className="mt-2.5 leading-relaxed text-ink-500">{b.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* ── 이용 방법 ── */}
      <Section id="how" className="bg-brand-50/40">
        <SectionHeading title={how.title} />
        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {how.steps.map((s, i) => (
            <Reveal key={s.n} delay={i * 0.1}>
              <div className="relative h-full rounded-3xl bg-white p-7 shadow-[var(--shadow-soft)] ring-1 ring-ink-900/5">
                <span className="text-3xl font-bold text-brand-200">{s.n}</span>
                <h3 className="mt-3 text-xl font-bold text-ink-900">
                  {s.title}
                </h3>
                <p className="mt-2.5 leading-relaxed text-ink-500">{s.desc}</p>
                {i < how.steps.length - 1 && (
                  <ArrowRight
                    size={20}
                    className="absolute -right-4 top-1/2 hidden -translate-y-1/2 text-brand-300 md:block"
                  />
                )}
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* ── 인터랙티브 데모(단계별 자동재생) ── */}
      <section id="demo" className="bg-mesh">
        <Container className="py-14 sm:py-20">
          <Reveal className="mx-auto max-w-2xl text-center">
            <span className="inline-block rounded-full bg-brand-50 px-3 py-1 text-sm font-semibold text-brand-600">
              {demoPage.eyebrow}
            </span>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-ink-900 sm:text-4xl lg:text-5xl">
              {demoPage.title}
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-ink-500">
              {demoPage.subtitle}
            </p>
          </Reveal>

          <Reveal delay={0.1} className="mx-auto mt-12 max-w-4xl">
            <DemoStage variant="full" />
          </Reveal>

          <Reveal delay={0.1}>
            <div className="mx-auto mt-12 grid max-w-3xl gap-3 sm:grid-cols-3">
              {demoPage.points.map((p) => (
                <div
                  key={p}
                  className="flex items-start gap-2 rounded-2xl bg-white/70 p-4 text-sm font-medium text-ink-700 ring-1 ring-ink-900/5"
                >
                  <Check
                    size={16}
                    strokeWidth={3}
                    className="mt-0.5 shrink-0 text-brand-500"
                  />
                  <span>{p}</span>
                </div>
              ))}
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="mx-auto mt-16 max-w-3xl overflow-hidden rounded-[2rem] bg-ink-900 px-8 py-12 text-center sm:px-14">
              <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                {demoPage.finalCta.title}
              </h2>
              <p className="mx-auto mt-3 max-w-lg text-ink-400">
                {demoPage.finalCta.desc}
              </p>
              <Link
                href={demoPage.finalCta.href}
                className="mt-7 inline-flex items-center gap-2 rounded-full bg-brand-500 px-7 py-3.5 text-base font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-brand-400"
              >
                {demoPage.finalCta.label}
                <ArrowRight size={18} />
              </Link>
            </div>
          </Reveal>
        </Container>
      </section>

      <Footer />
    </div>
  );
}
