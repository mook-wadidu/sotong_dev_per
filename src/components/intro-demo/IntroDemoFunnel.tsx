import type { ReactNode } from "react";
import {
  Clock,
  Languages,
  QrCode,
  PencilLine,
  Smartphone,
  MessagesSquare,
  FileText,
} from "lucide-react";
import ContactPicker from "@/components/intro-demo/ContactPicker";
import Container from "@/components/intro-demo/Container";
import Section, {
  Reveal,
  SectionHeading,
} from "@/components/intro-demo/Section";
import Nav from "@/components/intro-demo/Nav";
import Footer from "@/components/intro-demo/Footer";
import IntroSequence from "@/components/intro-demo/intro/IntroSequence";
import InteractiveHero from "@/components/intro-demo/hero/InteractiveHero";
import { benefits, demoPage, how } from "@/content/intro-demo";

const benefitIcons: Record<string, ReactNode> = {
  clock: <Clock size={26} />,
  languages: <Languages size={26} />,
  qr: <QrCode size={26} />,
};

// 이용 방법 5단계 아이콘(순서대로)
const stepIcons: ReactNode[] = [
  <QrCode key="qr" size={22} />,
  <PencilLine key="write" size={22} />,
  <Smartphone key="phone" size={22} />,
  <MessagesSquare key="chat" size={22} />,
  <FileText key="report" size={22} />,
];

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

      {/* ── 혜택 — 어두운 영역(구분감) ── */}
      <Section id="features" className="bg-ink-900">
        <SectionHeading
          title={benefits.title}
          subtitle={benefits.subtitle}
          tone="dark"
        />
        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {benefits.items.map((b, i) => (
            <Reveal key={b.title} delay={i * 0.12}>
              <div className="group relative h-full overflow-hidden rounded-[1.75rem] bg-white/[0.04] p-8 ring-1 ring-white/10 transition-all hover:-translate-y-1.5 hover:bg-white/[0.07] hover:ring-white/20">
                {/* 코너 바이올렛 글로우 — 어두운 배경 위 은은한 강조 */}
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute -right-10 -top-10 size-32 rounded-full bg-brand-500/25 blur-3xl transition-transform duration-500 group-hover:scale-125"
                />
                <div className="relative flex items-center gap-4">
                  <span className="grid size-16 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-accent text-white shadow-lg shadow-accent/30">
                    {benefitIcons[b.icon]}
                  </span>
                  <h3 className="text-xl font-bold leading-snug text-white">
                    {b.title}
                  </h3>
                </div>
                <p className="relative mt-4 leading-relaxed text-white/60">
                  {b.desc}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* ── 이용 방법 ── */}
      <Section id="how" className="bg-brand-50/40">
        <SectionHeading title={how.title} />
        {/* 세로 타임라인 — 5단계가 순서대로 이어지는 흐름 */}
        <div className="mx-auto mt-14 max-w-2xl">
          {how.steps.map((s, i) => {
            const last = i === how.steps.length - 1;
            return (
              <Reveal key={s.n} delay={i * 0.08}>
                <div className="flex gap-5">
                  {/* 노드 + 연결선 */}
                  <div className="flex flex-col items-center">
                    <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-brand-500 to-accent text-white shadow-lg shadow-accent/25">
                      {stepIcons[i]}
                    </span>
                    {!last && (
                      <span
                        aria-hidden="true"
                        className="mt-1.5 w-0.5 grow rounded-full bg-gradient-to-b from-brand-300 to-brand-100"
                      />
                    )}
                  </div>
                  {/* 내용 카드 */}
                  <div className={last ? "flex-1" : "flex-1 pb-6"}>
                    <div className="rounded-2xl bg-white p-5 shadow-[var(--shadow-soft)] ring-1 ring-ink-900/5 transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-float)]">
                      <span className="text-xs font-extrabold uppercase tracking-[0.14em] text-brand-400">
                        STEP {s.n}
                      </span>
                      <h3 className="mt-1.5 text-lg font-bold leading-snug text-ink-900">
                        {s.title}
                      </h3>
                      <p className="mt-1.5 text-sm leading-relaxed text-ink-500">
                        {s.desc}
                      </p>
                    </div>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>
      </Section>

      {/* ── 인터랙티브 데모(단계별 자동재생) ── */}
      <section id="demo" className="bg-mesh">
        <Container className="py-14 sm:py-20">
          <Reveal>
            <div className="mx-auto max-w-3xl overflow-hidden rounded-[2rem] bg-ink-900 px-8 py-12 text-center sm:px-14">
              <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                {demoPage.finalCta.title}
              </h2>
              <p className="mx-auto mt-3 max-w-lg text-ink-400">
                {demoPage.finalCta.desc}
              </p>
              <ContactPicker
                label={demoPage.finalCta.label}
                className="mt-7 inline-flex items-center gap-2 rounded-full bg-brand-500 px-7 py-3.5 text-base font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-brand-400"
              />
            </div>
          </Reveal>
        </Container>
      </section>

      <Footer />
    </div>
  );
}
