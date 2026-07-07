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
  BeatInputIcon,
  BeatReceiveIcon,
  BeatTranslateIcon,
  BeatCutIcon,
  BeatReportIcon,
} from "./beat-icons";
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
  DEMO_PAST_VISIT_KO,
  DEMO_SUMMARY_KO,
  DEMO_SUMMARY_LABELS,
  DEMO_SUMMARY_LABELS_KO,
  DEMO_LANGS,
  DEMO_INTRO,
  DEMO_NARRATION,
  DEMO_CAPTION,
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
// 자동 진행/화면 dwell 배속(클수록 느림). 타이핑 속도(TYPE_MS)는 제외.
const PACE = 2;
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

// 나래이션 비트 순서(진행 도트) + 비트별 전용 아이콘.
const BEAT_ORDER: Stage[] = ["lang", "d-inbox", "d-chat", "d-record", "d-report"];
const BEAT_ICON: Partial<
  Record<Stage, React.ComponentType<{ className?: string }>>
> = {
  lang: BeatInputIcon,
  "d-inbox": BeatReceiveIcon,
  "d-chat": BeatTranslateIcon,
  "d-record": BeatCutIcon,
  "d-report": BeatReportIcon,
};

/**
 * MVP 데모 — 5비트: 큰 그레이 나래이션(디자이너/원장에게 말 걸기) + "이어서 보기" 한 번이면
 * 그 구간(인테이크 자동채움·채팅 자동전송·정적화면)이 탭 없이 자동 재생 → 다음 나래이션.
 * 손님 화면(입력) → 디자이너 화면(받음·상담·시술지·리포트). 완전 하드코딩.
 * 정적 화면 dwell 은 콘텐츠 양 비례(READ_MS).
 */
export function DemoPlayer({
  embedded = false,
  autoPlay = false,
  loop = false,
  scrollHostRef,
}: {
  /** 폰 목업 안 임베드 — 전체 페이지 대신 폰 화면을 채우고, 스크롤은 폰 뷰포트에서. */
  embedded?: boolean;
  /** 인트로를 잠깐 보여준 뒤 자동으로 흐름을 시작한다(프리뷰용). */
  autoPlay?: boolean;
  /** 리포트까지 도달하면 잠시 후 처음부터 자동 반복(프리뷰용). */
  loop?: boolean;
  /** 임베드 시 화면 전환마다 최상단으로 되돌릴 폰 뷰포트 ref. */
  scrollHostRef?: React.RefObject<HTMLDivElement | null>;
} = {}) {
  const [stage, setStage] = React.useState<Stage>("intro");
  const [phase, setPhase] = React.useState<Phase>("content"); // intro = 랜딩(content)
  const [intakeStep, setIntakeStep] = React.useState(0);
  const [intakeFilled, setIntakeFilled] = React.useState(false);
  const [intakeNote, setIntakeNote] = React.useState("");
  const [typing, setTyping] = React.useState<string | null>(null);
  const [incoming, setIncoming] = React.useState(false); // 상대 메시지 도착 중(···)
  const [chatCount, setChatCount] = React.useState(0);
  // 나래이션(설명 화면) 타이핑 — 헤드라인이 타자기처럼 찍히고 detail은 뒤이어 나타남.
  const [narrationText, setNarrationText] = React.useState("");
  const [narrationDone, setNarrationDone] = React.useState(false);
  // 자동 재생 화면 위 보조 설명 자막(타이핑).
  const [caption, setCaption] = React.useState("");
  const countRef = React.useRef(0);
  const timer = React.useRef<number | null>(null);
  const capTimer = React.useRef<number | null>(null); // 자막 타이핑 전용(콘텐츠 타이머와 분리)
  const topRef = React.useRef<HTMLDivElement>(null);
  const track = trackOf(stage);

  const clearTimer = React.useCallback(() => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const clearCaption = React.useCallback(() => {
    if (capTimer.current) window.clearTimeout(capTimer.current);
    capTimer.current = null;
  }, []);

  // 자막 타자기 — 콘텐츠 자동진행 타이머(timer)와 독립된 capTimer 사용.
  const typeCaption = React.useCallback(
    (text: string) => {
      clearCaption();
      if (reduceMotion()) {
        setCaption(text);
        return;
      }
      let i = 0;
      setCaption("");
      const tick = () => {
        i += 1;
        setCaption(text.slice(0, i));
        if (i < text.length) capTimer.current = window.setTimeout(tick, TYPE_MS);
      };
      capTimer.current = window.setTimeout(tick, TYPE_MS);
    },
    [clearCaption],
  );

  React.useEffect(
    () => () => {
      clearTimer();
      clearCaption();
    },
    [clearTimer, clearCaption],
  );

  // stage/phase/인테이크 스텝 전환 시 최상단으로 복귀.
  // 전역 scroll-behavior:smooth 때문에 window.scrollTo 는 부드럽게 움직여
  // 다음 전환이 끼어들면 최상단에 못 닿는다 → scrollTop 직접 대입(즉시).
  React.useEffect(() => {
    if (embedded) {
      const host = scrollHostRef?.current;
      if (host) host.scrollTop = 0;
      return;
    }
    // 임베드가 아니면 문서 전체 스크롤(MobileFrame min-h-dvh)을 즉시 맨 위로.
    const el = document.scrollingElement || document.documentElement;
    if (el) el.scrollTop = 0;
    if (document.body) document.body.scrollTop = 0;
  }, [stage, phase, intakeStep, embedded, scrollHostRef]);

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
        (reduceMotion() ? 550 : 1400) * PACE,
      );
    };
    if (k === 1) typeOut(DEMO_INTAKE.styleNoteEn, setIntakeNote, afterFill);
    else
      timer.current = window.setTimeout(
        afterFill,
        (reduceMotion() ? 300 : 650) * PACE,
      );
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
          commit((reduceMotion() ? 300 : 950) * PACE),
        );
      } else {
        // 상대 메시지 — "···" 인디케이터 후 도착(시스템 노트 제외).
        const showDots = entry.kind !== "system";
        if (showDots) setIncoming(true);
        commit((showDots ? (reduceMotion() ? 400 : 1200) : 600) * PACE);
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
    // 화면 위 보조 설명 자막 — 진입과 동시에 타이핑 시작(있는 화면만).
    if (DEMO_CAPTION[s]) typeCaption(DEMO_CAPTION[s]!);
    else setCaption("");
    const rest = (next: Stage) => {
      const base = (READ_MS[s] ?? 3000) * PACE;
      timer.current = window.setTimeout(
        () => goTo(next),
        reduceMotion() ? Math.round(base * 0.4) : base,
      );
    };
    switch (s) {
      case "lang":
        timer.current = window.setTimeout(
          () => goTo("intake"),
          (reduceMotion() ? 500 : 1100) * PACE,
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

  // 설명(나래이션) 화면 — 헤드라인을 타자기처럼 찍고, detail을 뒤이어 띄운 뒤
  // 클릭 없이 자동으로 콘텐츠 재생으로 넘어간다. (stage는 인자로 명시 → 스테일 클로저 방지)
  const startNarration = (s: Stage) => {
    clearTimer();
    setCaption("");
    setNarrationDone(false);
    setNarrationText("");
    const n = DEMO_NARRATION[s];
    if (!n) {
      setPhase("content");
      startContent(s);
      return;
    }
    typeOut(n.headline, setNarrationText, () => {
      setNarrationDone(true); // detail 페이드 인
      timer.current = window.setTimeout(
        () => {
          setPhase("content");
          startContent(s);
        },
        (n.detail ? 2600 : 1500) * PACE,
      );
    });
  };

  // 다음 stage 로 이동 — 나래이션 있으면 타이핑 설명 화면(자동 진행), 없으면 바로 콘텐츠.
  const goTo = (s: Stage) => {
    clearTimer();
    setTyping(null);
    setIncoming(false);
    countRef.current = 0;
    setChatCount(0);
    setStage(s);
    if (DEMO_NARRATION[s]) {
      setPhase("narration");
      startNarration(s);
    } else {
      setPhase("content");
      startContent(s);
    }
  };

  // 설명 화면에서 "건너뛰기" — 자동 진행을 기다리지 않고 바로 콘텐츠로.
  const continueFromNarration = () => {
    setPhase("content");
    startContent(stage);
  };

  const reset = () => {
    clearTimer();
    clearCaption();
    setTyping(null);
    setIncoming(false);
    setCaption("");
    setNarrationText("");
    setNarrationDone(false);
    countRef.current = 0;
    setChatCount(0);
    setIntakeStep(0);
    setIntakeFilled(false);
    setIntakeNote("");
    setStage("intro");
    setPhase("content");
  };

  // 프리뷰 자동 시작/반복 — 인트로에서 잠깐 뒤 흐름 시작, 리포트 도달 후 잠시 뒤 처음부터 반복.
  React.useEffect(() => {
    if (!autoPlay) return;
    let t: number | undefined;
    if (stage === "intro" && phase === "content") {
      t = window.setTimeout(() => goTo("lang"), 1600);
    } else if (loop && stage === "d-report" && phase === "content") {
      t = window.setTimeout(() => reset(), 6500);
    }
    return () => {
      if (t) window.clearTimeout(t);
    };
    // goTo/reset 는 런타임 호출용(렌더마다 재생성) — deps 에서 제외.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPlay, loop, stage, phase]);

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
          pastVisit={DEMO_PAST_VISIT_KO}
          hair={DEMO_REPORT_HAIR}
          demo
          embedded={embedded}
        />
        {/* 임베드 프리뷰는 자동 반복하므로 Replay 버튼 숨김(전체화면에서만 노출). */}
        {!embedded ? (
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
        ) : null}
      </div>
    );
  }

  // 인트로(시작하기 화면)는 어두운 스플래시로 — 홈의 "번역기 붙잡고~" 섹션과 같은 톤.
  const introDark = stage === "intro";

  return (
    <MobileFrame
      tone="muted"
      lang={track === "designer" || stage === "intro" ? "ko" : "en"}
      embedded={embedded}
      className={introDark ? "bg-ink-900" : undefined}
    >
      {!introDark ? (
        <ScreenHeader
          title="소통 · Sotong"
          subtitle={
            track === "designer" ? "디자이너 화면 (KO)" : "손님 화면 미리보기"
          }
          trailing={<TrackBadge track={track} />}
        />
      ) : null}

      <ScreenBody
        className={cn("pb-2", phase === "narration" ? "flex flex-col" : "space-y-4")}
      >
        <div ref={topRef} aria-hidden="true" />
        {phase === "narration" ? (
          <NarrationScreen
            key={stage}
            stage={stage}
            typed={narrationText}
            done={narrationDone}
            detail={DEMO_NARRATION[stage]?.detail}
          />
        ) : (
          <>
            {/* 자동 재생 화면 위 보조 설명 자막(타이핑) — 처음 보는 사람용. */}
            {stage !== "intro" && caption ? (
              <CaptionBar text={caption} />
            ) : null}
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

      <ScreenFooter
        className={introDark ? "border-white/10 bg-ink-900" : undefined}
      >
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

function NarrationScreen({
  stage,
  typed,
  done,
  detail,
}: {
  stage: Stage;
  typed: string; // 타자기로 찍히는 중인 헤드라인
  done: boolean; // 헤드라인 타이핑 완료 → detail 페이드 인
  detail?: string;
}) {
  const Icon = BEAT_ICON[stage] ?? BeatInputIcon;
  const beatIndex = BEAT_ORDER.indexOf(stage);
  return (
    <div
      lang="ko"
      className="animate-rise flex flex-1 flex-col items-center justify-center gap-6 px-4 py-10 text-center"
    >
      {/* 진행 도트 — 몇 번째 비트인지 */}
      <div className="flex items-center gap-1.5" aria-hidden="true">
        {BEAT_ORDER.map((s, i) => (
          <span
            key={s}
            className={cn(
              "h-1.5 rounded-full transition-all",
              i === beatIndex
                ? "w-5 bg-brand"
                : i < beatIndex
                  ? "w-1.5 bg-brand"
                  : "w-1.5 bg-brand/20",
            )}
          />
        ))}
      </div>

      {/* 비트별 아이콘 배지 — 온브랜드 바이올렛 톤 */}
      <span className="flex size-14 items-center justify-center rounded-full bg-accent-soft text-accent-text ring-1 ring-brand-border">
        <Icon className="size-6" />
      </span>

      {/* 헤드라인 + 설명 */}
      <div
        className="flex flex-col items-center gap-2.5"
        aria-live="polite"
        aria-atomic="true"
      >
        <h2 className="max-w-[20rem] text-balance break-keep text-2xl font-bold leading-snug tracking-tight text-foreground">
          {typed}
          {!done ? <Caret /> : null}
        </h2>
        {detail ? (
          <p
            className={cn(
              "max-w-[20rem] text-balance break-keep text-base font-normal leading-relaxed text-muted-foreground transition-opacity duration-500",
              done ? "opacity-100" : "opacity-0",
            )}
          >
            {detail}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/* ── 자동 재생 화면 위 보조 설명 자막 ────────────────────── */

function CaptionBar({ text }: { text: string }) {
  return (
    <div
      lang="ko"
      className="animate-rise flex items-start gap-2 rounded-xl bg-accent-soft px-3 py-2 text-sm leading-snug text-accent-text ring-1 ring-brand-border"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <span aria-hidden="true" className="mt-px shrink-0">
        💡
      </span>
      <p className="break-keep">
        {text}
        <Caret />
      </p>
    </div>
  );
}

/* ── 타자기 커서 ─────────────────────────────────────────── */

function Caret() {
  return (
    <span
      aria-hidden="true"
      className="ml-0.5 inline-block h-[1em] w-px translate-y-[0.12em] animate-pulse bg-current align-baseline motion-reduce:animate-none"
    />
  );
}

/* ── 손님 화면 ───────────────────────────────────────────── */

function IntroScreen() {
  // 어두운 스플래시 — MobileFrame 배경이 ink-900 이므로 텍스트/카드를 밝은 톤으로.
  return (
    <div
      className="flex min-h-full flex-col justify-center gap-6 py-6"
      lang="ko"
    >
      {/* 헤드라인 */}
      <div className="space-y-2 text-center">
        <h1 className="whitespace-pre-line text-[1.7rem] font-bold leading-[1.25] tracking-tight text-white">
          {DEMO_INTRO.title}
        </h1>
        <p className="mx-auto max-w-[18rem] text-sm leading-relaxed text-white/60">
          {DEMO_INTRO.subtitle}
        </p>
      </div>

      {/* 핵심 장면 — 손님(영어) → 자동 번역 → 디자이너(한국어) 대화 */}
      <div className="rounded-3xl border border-white/10 bg-white/[0.05] p-4">
        <div className="flex justify-start">
          <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-white/10 px-3.5 py-2.5">
            <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-white/45">
              손님 · EN
            </p>
            <p className="mt-0.5 text-sm text-white" lang="en">
              {DEMO_INTRO.previewGuest}
            </p>
          </div>
        </div>

        <div className="my-2.5 flex items-center justify-center gap-1.5 text-[0.7rem] font-semibold text-brand-300">
          <SparkleIcon className="size-3" />
          {DEMO_INTRO.previewTag}
        </div>

        <div className="flex justify-end">
          <div className="max-w-[85%] rounded-2xl rounded-br-md bg-gradient-to-br from-brand-500 to-accent px-3.5 py-2.5 text-white shadow-lg shadow-accent/30">
            <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-white/70">
              디자이너 · KO
            </p>
            <p className="mt-0.5 text-sm font-semibold">
              {DEMO_INTRO.previewOwner}
            </p>
          </div>
        </div>
      </div>

      {/* 가치 3줄 — 카드형 */}
      <ul className="space-y-2">
        {DEMO_INTRO.values.map((v) => (
          <li
            key={v}
            className="flex items-center gap-3 rounded-2xl bg-white/[0.06] px-3.5 py-2.5 ring-1 ring-white/10"
          >
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-accent text-white">
              <CheckIcon className="size-3.5" strokeWidth={3} />
            </span>
            <span className="text-sm font-medium leading-snug text-white/90">
              {v}
            </span>
          </li>
        ))}
      </ul>

      <p className="text-center text-xs text-white/45">{DEMO_INTRO.duration}</p>
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
            selected={l.highlight}
            badge={l.highlight ? "추천" : undefined}
            onClick={() => {}}
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
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-accent-text">
          Step {step + 1} / {INTAKE_STEPS}
        </p>
        <h2 className="text-lg font-bold leading-snug tracking-tight text-foreground">
          {DEMO_INTAKE_TITLES[step]}
        </h2>
      </div>

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
    // 설명은 타이핑 후 자동으로 이어짐 — 버튼은 기다리기 싫은 사람용 계속하기.
    return (
      <Button
        variant="outline"
        size="lg"
        className="w-full"
        onClick={() => onContinue()}
      >
        계속하기 ›
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
    <p className="flex w-full items-center justify-center gap-1.5 text-xs text-muted-foreground">
      잠시 후 자동으로 이어져요
      <span
        aria-hidden="true"
        className="inline-block size-1 animate-pulse rounded-full bg-muted-foreground motion-reduce:animate-none"
      />
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
