"use client";

import * as React from "react";
import { QRCodeSVG } from "qrcode.react";
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
  DEMO_HANDOFF,
  DEMO_INBOX,
  DEMO_INSERVICE_EN,
  DEMO_INTAKE,
  DEMO_INTAKE_CONCERNS,
  DEMO_INTAKE_SERVICES,
  DEMO_INTAKE_SERVICES_SELECTED,
  DEMO_INTAKE_TITLES,
  DEMO_RECEIVED_NOTE,
  DEMO_RECORD_KO,
  DEMO_REPORT,
  DEMO_REPORT_DATE_LABEL,
  DEMO_REPORT_DATE_LABEL_KO,
  DEMO_REPORT_KO,
  DEMO_REPORT_LABELS,
  DEMO_REPORT_LABELS_KO,
  DEMO_REPORT_NEXT_VISIT,
  DEMO_REPORT_NEXT_VISIT_KO,
  DEMO_REPORT_PROFILE,
  DEMO_REPORT_PROFILE_KO,
  DEMO_REPORT_VISIT,
  DEMO_REPORT_VISIT_KO,
  DEMO_SUMMARY_KO,
  DEMO_SUMMARY_LABELS,
  DEMO_SUMMARY_LABELS_KO,
  DEMO_LANGS,
  type ChatEntry,
} from "./demo-script";

type Track = "customer" | "designer";
type Stage =
  | "intro"
  | "lang"
  | "intake"
  | "summary"
  | "chat"
  | "inservice"
  | "report"
  | "handoff"
  | "d-inbox"
  | "d-summary"
  | "d-chat"
  | "d-record"
  | "d-report";

const TYPE_MS = 38;
const INTAKE_STEPS = 6;
const trackOf = (stage: Stage): Track =>
  stage === "handoff" || stage.startsWith("d-") ? "designer" : "customer";
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
 * MVP 데모 — QR 하나로 같은 상담을 손님(영어) → 디자이너(한국어) 화면으로 탭 재생.
 * 인테이크는 자동채움 스텝, 채팅은 입력바 자동 타이핑 + Send만 누름. 완전 하드코딩.
 */
export function DemoPlayer({ url }: { url: string }) {
  const [stage, setStage] = React.useState<Stage>("intro");
  const [intakeStep, setIntakeStep] = React.useState(0);
  const [intakeFilled, setIntakeFilled] = React.useState(false);
  const [intakeNote, setIntakeNote] = React.useState("");
  const [typing, setTyping] = React.useState<string | null>(null);
  const [armed, setArmed] = React.useState(false);
  const [chatDone, setChatDone] = React.useState(false);
  const [incoming, setIncoming] = React.useState(false); // 상대 메시지 도착 중(···)
  const [chatCount, setChatCountState] = React.useState(0);
  const countRef = React.useRef(0);
  const armedRef = React.useRef(false); // 동기 가드(연타 시 중복 전송 방지)
  const timer = React.useRef<number | null>(null);
  const topRef = React.useRef<HTMLDivElement>(null);
  const track = trackOf(stage);

  React.useEffect(() => {
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, []);

  // 스테이지/인테이크 스텝 전환 시 스크롤 상단 복귀(긴→짧은 화면 어긋남 방지).
  React.useEffect(() => {
    topRef.current?.scrollIntoView({ block: "start" });
  }, [stage, intakeStep]);

  const arm = React.useCallback((v: boolean) => {
    armedRef.current = v;
    setArmed(v);
  }, []);

  const typeOut = React.useCallback(
    (text: string, onChar: (s: string) => void, onDone: () => void) => {
      // reduced-motion: 타이핑 건너뛰고 즉시 완성.
      const reduce =
        typeof window !== "undefined" &&
        window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      if (reduce) {
        onChar(text);
        timer.current = window.setTimeout(onDone, 200);
        return;
      }
      let i = 0;
      onChar("");
      const tick = () => {
        i += 1;
        onChar(text.slice(0, i));
        if (i < text.length) timer.current = window.setTimeout(tick, TYPE_MS);
        else timer.current = window.setTimeout(onDone, 280);
      };
      timer.current = window.setTimeout(tick, TYPE_MS);
    },
    [],
  );

  /* ── 인테이크 자동채움 ─────────────────────────────────── */
  const enterIntakeStep = React.useCallback(
    (k: number) => {
      if (timer.current) window.clearTimeout(timer.current);
      setIntakeStep(k);
      setIntakeFilled(false);
      if (k === 1) {
        typeOut(DEMO_INTAKE.styleNoteEn, setIntakeNote, () =>
          setIntakeFilled(true),
        );
      } else {
        timer.current = window.setTimeout(() => setIntakeFilled(true), 450);
      }
    },
    [typeOut],
  );

  /* ── 채팅: 자동 타이핑 + Send 만 ──────────────────────── */
  const pump = React.useCallback(
    (t: Track) => {
      const step = () => {
        const i = countRef.current;
        const entry = DEMO_CHAT[i];
        if (!entry) {
          arm(false);
          setIncoming(false);
          setChatDone(true);
          return;
        }
        if (isOwn(entry, t)) {
          // 내 메시지 — 입력바에 자동 타이핑 후 Send 활성(전송 대기).
          typeOut(t === "customer" ? entry.en : entry.ko, setTyping, () =>
            arm(true),
          );
        } else {
          // 상대 메시지는 도착 전 "···" 인디케이터(시스템 노트는 제외).
          const showDots = entry.kind !== "system";
          if (showDots) setIncoming(true);
          timer.current = window.setTimeout(
            () => {
              setIncoming(false);
              countRef.current = i + 1;
              setChatCountState(i + 1);
              step();
            },
            showDots ? 900 : 450,
          );
        }
      };
      step();
    },
    [typeOut, arm],
  );

  const startChat = React.useCallback(
    (t: Track) => {
      if (timer.current) window.clearTimeout(timer.current);
      setTyping(null);
      arm(false);
      setChatDone(false);
      setIncoming(false);
      countRef.current = 0;
      setChatCountState(0);
      pump(t);
    },
    [pump, arm],
  );

  const onSend = React.useCallback(
    (t: Track) => {
      if (!armedRef.current) return; // 동기 가드 — 연타 중복 전송 차단
      const next = countRef.current + 1;
      countRef.current = next;
      setChatCountState(next);
      setTyping(null);
      arm(false);
      pump(t);
    },
    [pump, arm],
  );

  const busy = typing !== null && !armed; // 자동 타이핑 진행 중

  const advance = React.useCallback(() => {
    if (busy) return;
    switch (stage) {
      case "intro":
        setStage("lang");
        break;
      case "lang":
        setStage("intake");
        enterIntakeStep(0);
        break;
      case "intake":
        if (intakeStep < INTAKE_STEPS - 1) enterIntakeStep(intakeStep + 1);
        else setStage("summary");
        break;
      case "summary":
        setStage("chat");
        startChat("customer");
        break;
      case "chat":
        setStage("inservice");
        break;
      case "inservice":
        setStage("report");
        break;
      case "handoff":
        setStage("d-inbox");
        break;
      case "d-inbox":
        setStage("d-summary");
        break;
      case "d-summary":
        setStage("d-chat");
        startChat("designer");
        break;
      case "d-chat":
        setStage("d-record");
        break;
      case "d-record":
        setStage("d-report");
        break;
      default:
        break;
    }
  }, [busy, stage, intakeStep, enterIntakeStep, startChat]);

  const reset = React.useCallback(() => {
    if (timer.current) window.clearTimeout(timer.current);
    setTyping(null);
    arm(false);
    setChatDone(false);
    setIncoming(false);
    countRef.current = 0;
    setChatCountState(0);
    setIntakeStep(0);
    setIntakeFilled(false);
    setIntakeNote("");
    setStage("intro");
  }, [arm]);

  // ── 리포트 화면(자체 MobileFrame) ──
  if (stage === "report" || stage === "d-report") {
    const isKo = stage === "d-report";
    return (
      <div className="relative">
        <ReportView
          report={isKo ? DEMO_REPORT_KO : DEMO_REPORT}
          labels={isKo ? DEMO_REPORT_LABELS_KO : DEMO_REPORT_LABELS}
          dateLabel={isKo ? DEMO_REPORT_DATE_LABEL_KO : DEMO_REPORT_DATE_LABEL}
          nextVisitText={
            isKo ? DEMO_REPORT_NEXT_VISIT_KO : DEMO_REPORT_NEXT_VISIT
          }
          profile={isKo ? DEMO_REPORT_PROFILE_KO : DEMO_REPORT_PROFILE}
          visit={isKo ? DEMO_REPORT_VISIT_KO : DEMO_REPORT_VISIT}
        />
        <div className="pointer-events-none fixed inset-x-0 bottom-4 z-10 flex justify-center">
          <Button
            variant="default"
            size="sm"
            className="pointer-events-auto shadow-lg"
            onClick={() => (isKo ? reset() : setStage("handoff"))}
          >
            {isKo ? "↺ Replay demo" : DEMO_HANDOFF.cta}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <MobileFrame tone="muted" lang={track === "designer" ? "ko" : "en"}>
      <ScreenHeader
        title="소통 · Sotong"
        subtitle={track === "designer" ? "디자이너 화면 (KO)" : "Live demo"}
        trailing={<TrackBadge track={track} />}
      />

      <ScreenBody className="space-y-4 pb-2">
        <div ref={topRef} aria-hidden="true" />
        {stage === "intro" ? <IntroScreen url={url} /> : null}
        {stage === "lang" ? <LangScreen onPick={advance} /> : null}
        {stage === "intake" ? (
          <IntakeFlow step={intakeStep} filled={intakeFilled} note={intakeNote} />
        ) : null}
        {stage === "summary" ? <CustomerSummaryScreen /> : null}
        {stage === "chat" || stage === "d-chat" ? (
          <ChatScreen visible={chatCount} track={track} incoming={incoming} />
        ) : null}
        {stage === "inservice" ? <InServiceScreen /> : null}
        {stage === "handoff" ? <HandoffScreen /> : null}
        {stage === "d-inbox" ? <InboxScreen /> : null}
        {stage === "d-summary" ? <DesignerSummaryScreen /> : null}
        {stage === "d-record" ? <RecordScreen /> : null}
      </ScreenBody>

      <ScreenFooter>
        <StageFooter
          stage={stage}
          track={track}
          intakeStep={intakeStep}
          busy={busy}
          typing={typing}
          armed={armed}
          chatDone={chatDone}
          onAdvance={advance}
          onSend={onSend}
        />
      </ScreenFooter>
    </MobileFrame>
  );
}

/* ── 손님 화면 ───────────────────────────────────────────── */

function IntroScreen({ url }: { url: string }) {
  return (
    <div className="flex flex-col items-center gap-5 py-6 text-center">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-bold tracking-tight">
          A salon visit, in your language.
        </h1>
        <p className="text-sm text-muted-foreground">
          See both sides in a minute — the guest, then the designer. Tap to walk
          through it.
        </p>
      </div>
      {url ? (
        <div className="flex flex-col items-center gap-2">
          <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
            <QRCodeSVG value={url} size={132} level="M" marginSize={0} />
          </div>
          <p className="text-xs text-muted-foreground">
            Or scan to open on your phone
          </p>
        </div>
      ) : null}
    </div>
  );
}

function LangScreen({ onPick }: { onPick: () => void }) {
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
      <div className="grid gap-3">
        {DEMO_LANGS.map((l) => (
          <LanguageButton
            key={l.locale}
            nativeLabel={l.native}
            subLabel={l.sub}
            onClick={onPick}
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
    // 자동채움 — 칩/입력은 비인터랙티브(탭해도 무반응이 의도). 진행은 하단 버튼.
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

function InServiceScreen() {
  return (
    <div className="space-y-4">
      <InServiceBanner copy={DEMO_INSERVICE_EN} />
      <ConsultationSummary
        language="English"
        services={DEMO_INTAKE.servicesEn}
        styleText={DEMO_INTAKE.styleNoteEn}
        photos={DEMO_INTAKE.photos}
        memo={DEMO_INTAKE.memoEn}
        gender={DEMO_INTAKE.genderEn}
        age={DEMO_INTAKE.age}
        status="in_service"
        labels={DEMO_SUMMARY_LABELS}
      />
    </div>
  );
}

/* ── 트랙 전환 + 디자이너 화면 ──────────────────────────── */

function HandoffScreen() {
  return (
    <div className="flex flex-col items-center gap-4 py-10 text-center">
      <span className="flex size-14 items-center justify-center rounded-full border border-foreground bg-foreground text-background">
        <CutIcon className="size-7" />
      </span>
      <h2 className="text-xl font-bold tracking-tight">{DEMO_HANDOFF.title}</h2>
      <p className="max-w-[18rem] text-sm leading-relaxed text-muted-foreground">
        {DEMO_HANDOFF.subtitle}
      </p>
    </div>
  );
}

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
      {/* 고객 프로필(목업② 고객 기록) */}
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

/* ── 채팅(트랙 공용) — 스레드만 렌더(자동 타이핑은 입력바) ── */

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

/* ── 푸터(탭 진행) ───────────────────────────────────────── */

function StageFooter({
  stage,
  track,
  intakeStep,
  busy,
  typing,
  armed,
  chatDone,
  onAdvance,
  onSend,
}: {
  stage: Stage;
  track: Track;
  intakeStep: number;
  busy: boolean;
  typing: string | null;
  armed: boolean;
  chatDone: boolean;
  onAdvance: () => void;
  onSend: (t: Track) => void;
}) {
  if (stage === "lang") {
    return (
      <p className="w-full text-center text-xs text-muted-foreground">
        Tap a language to continue
      </p>
    );
  }

  if (stage === "chat" || stage === "d-chat") {
    const ko = stage === "d-chat";
    if (chatDone) {
      return (
        <Button
          variant="accent"
          size="lg"
          className="w-full"
          onClick={onAdvance}
        >
          {ko ? "다음 ›" : "Next ›"}
        </Button>
      );
    }
    return (
      <div className="flex w-full items-end gap-2">
        <div className="flex-1" role="status" aria-live="polite" aria-atomic="true">
          <Input
            value={typing ?? ""}
            readOnly
            aria-label={ko ? "작성 중인 메시지" : "Message being typed"}
            placeholder={ko ? "메시지 입력…" : "Type a message…"}
          />
        </div>
        <Button
          variant="accent"
          size="lg"
          className="h-13 shrink-0 rounded-xl"
          onClick={() => onSend(track)}
          disabled={!armed}
        >
          {ko ? "전송 ›" : "Send ›"}
        </Button>
      </div>
    );
  }

  const label =
    stage === "intro"
      ? "Start ›"
      : stage === "intake"
        ? intakeStep < INTAKE_STEPS - 1
          ? "Next ›"
          : "Send to designer ›"
        : stage === "summary"
          ? "Next ›"
          : stage === "inservice"
            ? "See my report ›"
            : stage === "handoff"
              ? DEMO_HANDOFF.cta
              : stage === "d-inbox"
                ? "상담 열기 ›"
                : stage === "d-summary"
                  ? "시술 시작 ›"
                  : stage === "d-record"
                    ? "리포트 발송 ›"
                    : "Next ›";

  return (
    <Button
      variant="accent"
      size="lg"
      className="w-full"
      onClick={onAdvance}
      disabled={busy}
    >
      {label}
    </Button>
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
          Guest
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

function InServiceBanner({
  copy,
}: {
  copy: { title: string; subtitle: string };
}) {
  return (
    <div className="rounded-2xl border border-foreground bg-foreground px-4 py-5 text-center text-background">
      <p className="flex items-center justify-center gap-1.5 text-lg font-bold">
        <CareIcon className="size-5" />
        {copy.title}
      </p>
      <p className="mt-1 text-sm text-background/80">{copy.subtitle}</p>
    </div>
  );
}
