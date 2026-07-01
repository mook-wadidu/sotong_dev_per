"use client";

import * as React from "react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  Chip,
  Input,
  LanguageButton,
  MessageBubble,
  MobileFrame,
  PictoChip,
  ProgressSteps,
  ScreenBody,
  ScreenFooter,
  ScreenHeader,
  SectionLabel,
  SystemNote,
} from "@/components/ui";
import { ConsultationSummary } from "@/components/shared/consultation-summary";
import { ReportView } from "@/components/customer/report-view";
import {
  AlertIcon,
  CareIcon,
  ChatIcon,
  CheckIcon,
  CutIcon,
  ColorIcon,
  FaceDiamondIcon,
  FaceHeartIcon,
  FaceLongIcon,
  FaceOvalIcon,
  FaceRoundIcon,
  FaceSquareIcon,
  GlobeIcon,
  SparkleIcon,
} from "@/components/icons";
import { cn } from "@/lib/utils";
import {
  DEMO_ABOUT_SELECTED,
  DEMO_AGE_BANDS,
  DEMO_CHAT,
  DEMO_CONCERNS_SELECTED,
  DEMO_CONSENT,
  DEMO_CONSENT_HINT,
  DEMO_FACE_SELECTED,
  DEMO_FACE_SHAPES,
  DEMO_GENDERS,
  DEMO_INBOX,
  DEMO_INTAKE,
  DEMO_INTAKE_CONCERNS,
  DEMO_INTAKE_SERVICES,
  DEMO_INTAKE_SERVICES_SELECTED,
  DEMO_INTAKE_TITLES,
  DEMO_RECEIVED_NOTE,
  DEMO_RECORD_KO,
  DEMO_REPORT_KO,
  DEMO_REPORT_HAIR,
  DEMO_REPORT_LABELS_KO,
  DEMO_REPORT_DATE_LABEL_KO,
  DEMO_REPORT_PROFILE_KO,
  DEMO_REPORT_VISIT_KO,
  DEMO_SUMMARY_KO,
  DEMO_SUMMARY_LABELS,
  DEMO_SUMMARY_LABELS_KO,
  DEMO_LANGS,
  DEMO_INTRO,
  DEMO_NARRATION,
  type ChatEntry,
} from "./demo-script";

type Track = "customer" | "designer";
type Phase = "narration" | "content";
type Stage =
  | "intro"
  | "lang"
  | "intake"
  | "summary"
  | "d-inbox"
  | "d-summary"
  | "d-chat"
  | "d-record"
  | "d-report";

const TYPE_MS = 38;
const INTAKE_STEPS = 6;
const reduceMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// 정적 화면 읽기 dwell(ms) — 콘텐츠 양에 비례(빽빽할수록 길게). reduceMotion 시 단축.
const READ_MS: Partial<Record<Stage, number>> = {
  summary: 4500, // 상담 요약 카드
  "d-inbox": 3000, // 대기 손님 카드 1개(짧게)
  "d-summary": 6500, // 주의 + AI요약 문단 + 상담정보(가장 빽빽)
  "d-record": 5000, // 제품 + 스탯 + 전후 사진
};

const trackOf = (stage: Stage): Track =>
  stage.startsWith("d-") ? "designer" : "customer";
const isOwn = (entry: ChatEntry, t: Track): boolean =>
  t === "customer" ? entry.kind === "customer" : entry.kind === "designer";

const FACE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  oval: FaceOvalIcon,
  round: FaceRoundIcon,
  square: FaceSquareIcon,
  long: FaceLongIcon,
  heart: FaceHeartIcon,
  diamond: FaceDiamondIcon,
};

/**
 * MVP 데모 — 5비트: 큰 그레이 나래이션(디자이너/원장에게 말 걸기) + "이어서 보기" 한 번이면
 * 그 구간(인테이크 자동채움·채팅 자동전송·정적화면)이 탭 없이 자동 재생 → 다음 나래이션.
 * 손님 화면(입력) → 디자이너 화면(받음·상담·시술지·리포트). 완전 하드코딩.
 * 정적 화면 dwell 은 콘텐츠 양 비례(READ_MS).
 */
export function DemoPlayer() {
  const [stage, setStage] = React.useState<Stage>("intro");
  const [phase, setPhase] = React.useState<Phase>("content"); // intro = 랜딩(content)
  const [intakeStep, setIntakeStep] = React.useState(0);
  const [intakeFilled, setIntakeFilled] = React.useState(false);
  const [intakeNote, setIntakeNote] = React.useState("");
  const [typing, setTyping] = React.useState<string | null>(null);
  const [incoming, setIncoming] = React.useState(false); // 상대 메시지 도착 중(···)
  const [chatCount, setChatCount] = React.useState(0);
  const countRef = React.useRef(0);
  const timer = React.useRef<number | null>(null);
  const topRef = React.useRef<HTMLDivElement>(null);
  const track = trackOf(stage);

  const clearTimer = React.useCallback(() => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
  }, []);

  React.useEffect(() => () => clearTimer(), [clearTimer]);

  // stage/phase/인테이크 스텝 전환 시 스크롤 상단 복귀.
  React.useEffect(() => {
    topRef.current?.scrollIntoView({ block: "start" });
  }, [stage, phase, intakeStep]);

  const typeOut = React.useCallback(
    (text: string, onChar: (s: string) => void, onDone: () => void) => {
      if (reduceMotion()) {
        onChar(text);
        timer.current = window.setTimeout(onDone, 150);
        return;
      }
      let i = 0;
      onChar("");
      const tick = () => {
        i += 1;
        onChar(text.slice(0, i));
        if (i < text.length) timer.current = window.setTimeout(tick, TYPE_MS);
        else timer.current = window.setTimeout(onDone, 260);
      };
      timer.current = window.setTimeout(tick, TYPE_MS);
    },
    [],
  );

  // ── 자동재생 엔진 ────────────────────────────────────────
  // 아래 함수들은 서로를 런타임(타이머/클릭)에서만 호출 → const 선언 순서 무관(TDZ 안전).

  // 인테이크 6스텝 자동채움 + 자동 진행.
  const runIntakeStep = (k: number) => {
    clearTimer();
    setIntakeStep(k);
    setIntakeFilled(false);
    const afterFill = () => {
      setIntakeFilled(true);
      timer.current = window.setTimeout(
        () => (k < INTAKE_STEPS - 1 ? runIntakeStep(k + 1) : goTo("summary")),
        reduceMotion() ? 550 : 1400,
      );
    };
    if (k === 1) typeOut(DEMO_INTAKE.styleNoteEn, setIntakeNote, afterFill);
    else timer.current = window.setTimeout(afterFill, reduceMotion() ? 300 : 650);
  };

  // 채팅 자동 타이핑 + 자동 전송(수동 Send 없음).
  const pump = (t: Track) => {
    const step = () => {
      const i = countRef.current;
      const entry = DEMO_CHAT[i];
      if (!entry) {
        setIncoming(false);
        goTo("d-record");
        return;
      }
      const commit = (delay: number) => {
        timer.current = window.setTimeout(() => {
          setIncoming(false);
          setTyping(null);
          countRef.current = i + 1;
          setChatCount(i + 1);
          step();
        }, delay);
      };
      if (isOwn(entry, t)) {
        // 내 메시지 — 입력바 자동 타이핑 후 잠깐 뒤 자동 전송.
        typeOut(t === "customer" ? entry.en : entry.ko, setTyping, () =>
          commit(reduceMotion() ? 300 : 950),
        );
      } else {
        // 상대 메시지 — "···" 인디케이터 후 도착(시스템 노트 제외).
        const showDots = entry.kind !== "system";
        if (showDots) setIncoming(true);
        commit(showDots ? (reduceMotion() ? 400 : 1200) : 600);
      }
    };
    step();
  };

  const startChat = (t: Track) => {
    clearTimer();
    setTyping(null);
    setIncoming(false);
    countRef.current = 0;
    setChatCount(0);
    pump(t);
  };

  // stage 콘텐츠 진입 시 자동재생 시작(정적 화면은 READ_MS 딜레이 후 다음 비트로).
  const startContent = (s: Stage) => {
    clearTimer();
    const rest = (next: Stage) => {
      const base = READ_MS[s] ?? 3000;
      timer.current = window.setTimeout(
        () => goTo(next),
        reduceMotion() ? Math.round(base * 0.4) : base,
      );
    };
    switch (s) {
      case "lang":
        timer.current = window.setTimeout(
          () => goTo("intake"),
          reduceMotion() ? 500 : 1100,
        );
        break;
      case "intake":
        runIntakeStep(0);
        break;
      case "summary":
        rest("d-inbox");
        break;
      case "d-inbox":
        rest("d-summary");
        break;
      case "d-summary":
        rest("d-chat");
        break;
      case "d-chat":
        startChat("designer");
        break;
      case "d-record":
        rest("d-report");
        break;
      // intro / d-report — 자체 버튼(자동재생 없음).
      default:
        break;
    }
  };

  // 다음 stage 로 이동 — 나래이션 있으면 그레이 게이트, 없으면 바로 콘텐츠 자동재생.
  const goTo = (s: Stage) => {
    clearTimer();
    setTyping(null);
    setIncoming(false);
    countRef.current = 0;
    setChatCount(0);
    setStage(s);
    if (DEMO_NARRATION[s]) {
      setPhase("narration");
    } else {
      setPhase("content");
      startContent(s);
    }
  };

  const continueFromNarration = () => {
    setPhase("content");
    startContent(stage);
  };

  const reset = () => {
    clearTimer();
    setTyping(null);
    setIncoming(false);
    countRef.current = 0;
    setChatCount(0);
    setIntakeStep(0);
    setIntakeFilled(false);
    setIntakeNote("");
    setStage("intro");
    setPhase("content");
  };

  // ── 최종 리포트(자체 MobileFrame) — d-report content phase 에서만 ──
  if (stage === "d-report" && phase === "content") {
    return (
      <div className="relative">
        <ReportView
          report={DEMO_REPORT_KO}
          labels={DEMO_REPORT_LABELS_KO}
          dateLabel={DEMO_REPORT_DATE_LABEL_KO}
          profile={DEMO_REPORT_PROFILE_KO}
          visit={DEMO_REPORT_VISIT_KO}
          hair={DEMO_REPORT_HAIR}
          demo
        />
        <div className="pointer-events-none fixed inset-x-0 bottom-4 z-10 flex justify-center">
          <Button
            variant="default"
            size="sm"
            className="pointer-events-auto shadow-lg"
            onClick={reset}
          >
            ↺ Replay demo
          </Button>
        </div>
      </div>
    );
  }

  return (
    <MobileFrame
      tone="muted"
      lang={track === "designer" || stage === "intro" ? "ko" : "en"}
    >
      <ScreenHeader
        title="소통 · Sotong"
        subtitle={track === "designer" ? "디자이너 화면 (KO)" : "손님 화면 미리보기"}
        trailing={<TrackBadge track={track} />}
      />

      <ScreenBody className="space-y-4 pb-2">
        <div ref={topRef} aria-hidden="true" />
        {phase === "narration" ? (
          <NarrationScreen text={DEMO_NARRATION[stage] ?? ""} />
        ) : (
          <>
            {stage === "intro" ? <IntroScreen /> : null}
            {stage === "lang" ? <LangScreen /> : null}
            {stage === "intake" ? (
              <IntakeFlow
                step={intakeStep}
                filled={intakeFilled}
                note={intakeNote}
              />
            ) : null}
            {stage === "summary" ? <CustomerSummaryScreen /> : null}
            {stage === "d-chat" ? (
              <ChatScreen visible={chatCount} track={track} incoming={incoming} />
            ) : null}
            {stage === "d-inbox" ? <InboxScreen /> : null}
            {stage === "d-summary" ? <DesignerSummaryScreen /> : null}
            {stage === "d-record" ? <RecordScreen /> : null}
          </>
        )}
      </ScreenBody>

      <ScreenFooter>
        <DemoFooter
          stage={stage}
          phase={phase}
          typing={typing}
          onContinue={continueFromNarration}
          onStart={() => goTo("lang")}
        />
      </ScreenFooter>
    </MobileFrame>
  );
}

/* ── 나래이션(큰 그레이 화면) ────────────────────────────── */

function NarrationScreen({ text }: { text: string }) {
  return (
    <div
      lang="ko"
      className="flex min-h-[22rem] flex-col items-center justify-center gap-5 px-2 py-10 text-center"
    >
      <span className="flex size-11 items-center justify-center rounded-full border border-foreground bg-foreground text-background">
        <SparkleIcon className="size-5" />
      </span>
      <p className="max-w-[19rem] text-xl font-bold leading-relaxed tracking-tight text-foreground sm:text-[1.55rem]">
        {text}
      </p>
    </div>
  );
}

/* ── 손님 화면 ───────────────────────────────────────────── */

function IntroScreen() {
  return (
    <div className="flex flex-col gap-5 py-4" lang="ko">
      <div className="space-y-1.5 text-center">
        <h1 className="text-2xl font-bold leading-snug tracking-tight">
          {DEMO_INTRO.title}
        </h1>
        <p className="text-sm text-muted-foreground">{DEMO_INTRO.subtitle}</p>
      </div>

      {/* 핵심 장면 — "한 메시지"가 번역됨: 원문(영어) → 자동 번역 → 한국어. 한 말풍선에 스택. */}
      <div className="rounded-2xl border border-border bg-card p-3">
        <div className="rounded-2xl rounded-bl-sm bg-muted px-3.5 py-2.5">
          <p className="text-sm text-muted-foreground" lang="en">
            {DEMO_INTRO.previewGuest}
          </p>
          <div className="my-1.5 flex items-center gap-1 border-t border-border/60 pt-1.5 text-[0.7rem] font-medium text-muted-foreground">
            <SparkleIcon className="size-3" />
            {DEMO_INTRO.previewTag}
          </div>
          <p className="text-sm font-semibold text-foreground">
            {DEMO_INTRO.previewOwner}
          </p>
        </div>
      </div>

      {/* 가치 3줄 — "볼 이유" */}
      <ul className="space-y-2">
        {DEMO_INTRO.values.map((v) => (
          <li key={v} className="flex items-start gap-2 text-sm text-foreground">
            <CheckIcon
              className="mt-0.5 size-4 shrink-0 text-accent-strong"
              strokeWidth={3}
            />
            <span className="leading-snug">{v}</span>
          </li>
        ))}
      </ul>

      <p className="text-center text-xs text-muted-foreground">
        {DEMO_INTRO.duration}
      </p>
    </div>
  );
}

function LangScreen() {
  // 자동 선택(약 1.1s) — 버튼은 비인터랙티브 표시용(영어 강조).
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground">
          <GlobeIcon className="size-5" />
          How can we help you today?
        </h1>
        <p className="text-base text-muted-foreground">
          No app, no sign-up. Just pick your language.
        </p>
      </div>
      <div className="grid gap-3 [&_button]:pointer-events-none">
        {DEMO_LANGS.map((l) => (
          <LanguageButton
            key={l.locale}
            nativeLabel={l.native}
            subLabel={l.sub}
            onClick={() => {}}
            className={cn(
              l.highlight &&
                "border-foreground ring-2 ring-foreground ring-offset-2 ring-offset-muted",
            )}
          />
        ))}
      </div>
    </div>
  );
}

/* ── 인테이크 자동채움 스텝 ──────────────────────────────── */

function IntakeFlow({
  step,
  filled,
  note,
}: {
  step: number;
  filled: boolean;
  note: string;
}) {
  return (
    // 자동채움 — 칩/입력은 비인터랙티브(진행은 자동).
    <div className="space-y-4 [&_button]:pointer-events-none">
      <ProgressSteps total={INTAKE_STEPS} current={step + 1} label="Intake" />
      <p className="text-base font-semibold text-foreground">
        {DEMO_INTAKE_TITLES[step]}
      </p>

      {step === 0 ? (
        <div className="space-y-2">
          {DEMO_INTAKE_SERVICES.map((s) => (
            <Chip
              key={s.id}
              label={s.label}
              sublabel={s.price}
              icon={s.id === "color" ? <ColorIcon /> : <CutIcon />}
              selectMode="multi"
              selected={filled && DEMO_INTAKE_SERVICES_SELECTED.includes(s.id)}
              tabIndex={-1}
            />
          ))}
        </div>
      ) : null}

      {step === 1 ? (
        <div className="space-y-3">
          <PhotoGrid label="Reference photos" photos={DEMO_INTAKE.photos} />
          <Field label="Style note">
            <Input value={note} readOnly aria-label="Style note" placeholder="…" />
          </Field>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="grid grid-cols-3 gap-2">
          {DEMO_FACE_SHAPES.map((f) => {
            const Icon = FACE_ICONS[f.id];
            return (
              <PictoChip
                key={f.id}
                label={f.label}
                icon={<Icon />}
                selectMode="single"
                selected={filled && f.id === DEMO_FACE_SELECTED}
                tabIndex={-1}
              />
            );
          })}
        </div>
      ) : null}

      {step === 3 ? (
        <div className="space-y-2">
          {DEMO_INTAKE_CONCERNS.map((c) => (
            <Chip
              key={c.id}
              label={c.label}
              selectMode="multi"
              selected={filled && DEMO_CONCERNS_SELECTED.includes(c.id)}
              tabIndex={-1}
            />
          ))}
        </div>
      ) : null}

      {step === 4 ? (
        <div className="space-y-4">
          <Field label="Gender">
            <div className="grid grid-cols-3 gap-2">
              {DEMO_GENDERS.map((g) => (
                <PictoChip
                  key={g.id}
                  label={g.label}
                  selectMode="single"
                  selected={filled && g.id === DEMO_ABOUT_SELECTED.gender}
                  tabIndex={-1}
                />
              ))}
            </div>
          </Field>
          <Field label="Age">
            <div className="grid grid-cols-3 gap-2">
              {DEMO_AGE_BANDS.map((a) => (
                <PictoChip
                  key={a}
                  label={a}
                  selectMode="single"
                  selected={filled && a === DEMO_ABOUT_SELECTED.age}
                  tabIndex={-1}
                />
              ))}
            </div>
          </Field>
        </div>
      ) : null}

      {step === 5 ? (
        <Card>
          <CardContent className="flex items-start gap-3 p-4">
            <span
              aria-hidden="true"
              className={cn(
                "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors",
                filled
                  ? "border-accent-strong bg-accent-strong text-accent-strong-foreground"
                  : "border-border",
              )}
            >
              {filled ? <CheckIcon className="size-3.5" strokeWidth={3} /> : null}
            </span>
            <div className="space-y-1">
              <p className="text-sm font-medium leading-snug text-foreground">
                {DEMO_CONSENT}
              </p>
              <p className="text-xs text-muted-foreground">{DEMO_CONSENT_HINT}</p>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function CustomerSummaryScreen() {
  return (
    <div className="space-y-4">
      <SystemNote>{DEMO_RECEIVED_NOTE}</SystemNote>
      <ConsultationSummary
        language="English"
        services={DEMO_INTAKE.servicesEn}
        styleText={DEMO_INTAKE.styleNoteEn}
        photos={DEMO_INTAKE.photos}
        memo={DEMO_INTAKE.memoEn}
        gender={DEMO_INTAKE.genderEn}
        age={DEMO_INTAKE.age}
        status="consulting"
        labels={DEMO_SUMMARY_LABELS}
      />
    </div>
  );
}

/* ── 디자이너 화면 ──────────────────────────────────────── */

function InboxScreen() {
  return (
    <div className="space-y-3">
      <p className="flex items-center gap-1.5 text-base font-semibold text-foreground">
        <ChatIcon className="size-4" />
        대기 손님
      </p>
      <Card>
        <CardContent className="space-y-2 p-4">
          <div className="flex items-center justify-between">
            <Badge variant="outline">대기 중</Badge>
            <span className="text-xs text-muted-foreground">
              {DEMO_INBOX.time}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="accent">신규</Badge>
            <Badge variant="outline">{DEMO_INBOX.nationalityKo}</Badge>
            <Badge variant="outline">{DEMO_INBOX.language}</Badge>
          </div>
          <p className="text-lg font-bold leading-snug">
            {DEMO_INBOX.headlineKo}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function DesignerSummaryScreen() {
  return (
    <div className="space-y-4">
      <div className="space-y-2.5">
        <h1 className="text-xl font-bold leading-snug tracking-tight">
          {DEMO_SUMMARY_KO.headline}
        </h1>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline">국적: {DEMO_INBOX.nationalityKo}</Badge>
          <Badge variant="accent">신규</Badge>
          <Badge variant="info">예상가 {DEMO_SUMMARY_KO.estimatedPrice}</Badge>
        </div>
      </div>

      <Card className="border-l-4 border-l-foreground bg-accent-soft">
        <CardContent className="space-y-1 p-4">
          <p className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-foreground">
            <AlertIcon className="size-4" />
            주의사항
          </p>
          <p className="text-sm leading-relaxed text-foreground">
            {DEMO_SUMMARY_KO.cautions}
          </p>
          <p className="text-xs text-muted-foreground">
            알레르기: {DEMO_SUMMARY_KO.allergy}
          </p>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <SectionLabel className="mb-0">상담 정보</SectionLabel>
        <ConsultationSummary
          language={DEMO_INBOX.language}
          services={DEMO_INTAKE.servicesKo}
          styleText={DEMO_INTAKE.styleNoteKo}
          photos={DEMO_INTAKE.photos}
          memo={DEMO_INTAKE.memoKo}
          gender={DEMO_INTAKE.genderKo}
          age={DEMO_INTAKE.age}
          status="consulting"
          labels={DEMO_SUMMARY_LABELS_KO}
        />
      </div>

      <Card>
        <CardContent className="p-4">
          <p className="mb-1.5 flex items-center gap-1.5 text-base font-bold text-foreground">
            <SparkleIcon className="size-4" />
            AI 요약
          </p>
          <p className="whitespace-pre-wrap text-[0.95rem] leading-relaxed text-muted-foreground">
            {DEMO_SUMMARY_KO.aiSummary}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function RecordScreen() {
  return (
    <div className="space-y-4">
      {/* 고객 프로필 */}
      <Card>
        <CardContent className="flex items-center justify-between gap-3 p-4">
          <div className="space-y-0.5">
            <p className="text-base font-bold text-foreground">
              {DEMO_INBOX.name}
            </p>
            <p className="text-xs text-muted-foreground">
              {DEMO_INBOX.nationalityKo} · {DEMO_INTAKE.genderKo} ·{" "}
              {DEMO_INTAKE.age}세
            </p>
          </div>
          <Badge variant="accent">신규</Badge>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <SectionLabel className="mb-0 flex items-center gap-1.5">
          <CareIcon className="size-4" />
          시술 기록
        </SectionLabel>
        <div className="flex flex-wrap gap-2">
          {DEMO_RECORD_KO.products.map((p) => (
            <Pill key={p} text={p} />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">모발 상태</p>
            <p className="text-sm font-semibold text-foreground">
              {DEMO_RECORD_KO.stateGrade}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">만족도</p>
            <p className="text-sm font-semibold text-foreground">
              {DEMO_RECORD_KO.satisfaction}점
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-2">
        <SectionLabel className="mb-0">비포 / 애프터</SectionLabel>
        <div className="grid grid-cols-2 gap-3">
          {[
            { url: DEMO_REPORT_KO.beforePhotoUrl, cap: "시술 전" },
            { url: DEMO_REPORT_KO.afterPhotoUrl, cap: "시술 후" },
          ].map((p) => (
            <figure key={p.cap} className="space-y-1.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.url}
                alt={p.cap}
                className="aspect-square w-full rounded-xl border border-border object-cover"
              />
              <figcaption className="text-center text-xs font-medium text-muted-foreground">
                {p.cap}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── 채팅(디자이너 렌즈) — 스레드만 렌더(자동 타이핑은 입력바) ── */

function ChatScreen({
  visible,
  track,
  incoming,
}: {
  visible: number;
  track: Track;
  incoming: boolean;
}) {
  const shown = DEMO_CHAT.slice(0, visible);
  return (
    <div className="flex flex-col gap-3">
      {shown.map((entry, i) => (
        <ChatRow key={i} entry={entry} track={track} />
      ))}
      {incoming ? (
        <MessageBubble
          side="them"
          text="···"
          textLang={track === "customer" ? "en" : "ko"}
          pending
          pendingLabel=""
        />
      ) : null}
    </div>
  );
}

function ChatRow({ entry, track }: { entry: ChatEntry; track: Track }) {
  if (entry.kind === "system")
    return <SystemNote>{track === "customer" ? entry.en : entry.ko}</SystemNote>;

  const mine = isOwn(entry, track);
  if (mine) {
    return (
      <MessageBubble
        side="me"
        text={track === "customer" ? entry.en : entry.ko}
        textLang={track === "customer" ? "en" : "ko"}
      />
    );
  }
  return (
    <MessageBubble
      side="them"
      text={track === "customer" ? entry.en : entry.ko}
      original={track === "customer" ? entry.ko : entry.en}
      textLang={track === "customer" ? "en" : "ko"}
      originalLang={track === "customer" ? "ko" : "en"}
    />
  );
}

/* ── 푸터 ─────────────────────────────────────────────────── */

function DemoFooter({
  stage,
  phase,
  typing,
  onContinue,
  onStart,
}: {
  stage: Stage;
  phase: Phase;
  typing: string | null;
  onContinue: () => void;
  onStart: () => void;
}) {
  if (phase === "narration") {
    return (
      <Button variant="accent" size="lg" className="w-full" onClick={onContinue}>
        이어서 보기 ›
      </Button>
    );
  }

  if (stage === "intro") {
    return (
      <Button variant="accent" size="lg" className="w-full" onClick={onStart}>
        {DEMO_INTRO.cta}
      </Button>
    );
  }

  if (stage === "d-chat") {
    // 자동 타이핑 입력바(전송 버튼 없음 — 자동 전송).
    return (
      <div
        className="w-full"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <Input
          value={typing ?? ""}
          readOnly
          aria-label="작성 중인 메시지"
          placeholder="메시지 입력…"
        />
      </div>
    );
  }

  // 자동 진행 정적 구간 — 진행 중 안내(탭 불필요).
  return (
    <p className="w-full text-center text-xs text-muted-foreground">
      잠시 후 자동으로 이어져요…
    </p>
  );
}

/* ── 작은 헬퍼 ───────────────────────────────────────────── */

function TrackBadge({ track }: { track: Track }) {
  return (
    <Badge variant="outline" className="gap-1">
      {track === "designer" ? (
        <>
          <CareIcon className="size-3" />
          디자이너
        </>
      ) : (
        <>
          <ChatIcon className="size-3" />
          손님
        </>
      )}
    </Badge>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      {children}
    </div>
  );
}

function Pill({ text }: { text: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-foreground bg-foreground px-3 py-1.5 text-sm font-medium text-background">
      {text}
    </span>
  );
}

function PhotoGrid({ label, photos }: { label: string; photos: string[] }) {
  return (
    <Field label={label}>
      <div className="grid grid-cols-3 gap-2">
        {photos.map((src, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={i}
            src={src}
            alt={`${label} ${i + 1}`}
            className="aspect-square w-full rounded-xl border border-border object-cover"
          />
        ))}
      </div>
    </Field>
  );
}
