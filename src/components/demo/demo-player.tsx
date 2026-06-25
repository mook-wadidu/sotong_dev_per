"use client";

import * as React from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  Input,
  LanguageButton,
  MessageBubble,
  MobileFrame,
  ScreenBody,
  ScreenFooter,
  ScreenHeader,
  SystemNote,
} from "@/components/ui";
import { ConsultationSummary } from "@/components/shared/consultation-summary";
import { ReportView } from "@/components/customer/report-view";
import {
  AlertIcon,
  CareIcon,
  ChatIcon,
  CutIcon,
  ColorIcon,
  GlobeIcon,
  SparkleIcon,
} from "@/components/icons";
import { cn } from "@/lib/utils";
import {
  DEMO_CHAT,
  DEMO_HANDOFF,
  DEMO_INBOX,
  DEMO_INSERVICE_EN,
  DEMO_INTAKE,
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
const trackOf = (stage: Stage): Track =>
  stage === "handoff" || stage.startsWith("d-") ? "designer" : "customer";

/**
 * MVP 데모 — QR 하나로 같은 상담을 **손님 화면(영어)** → **디자이너 화면(한국어)** 으로
 * 탭하면 한 단계씩 재생. 채팅 입력바는 실제 치는 것처럼 자동 타이핑.
 * 완전 하드코딩(demo-script) — DB·AI·네트워크 0.
 */
export function DemoPlayer({ url }: { url: string }) {
  const [stage, setStage] = React.useState<Stage>("intro");
  const [chatCount, setChatCount] = React.useState(0);
  const [typing, setTyping] = React.useState<string | null>(null);
  const [intakeNote, setIntakeNote] = React.useState("");
  const timer = React.useRef<number | null>(null);
  const busy = typing !== null;
  const track = trackOf(stage);

  React.useEffect(() => {
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, []);

  const typeOut = React.useCallback(
    (text: string, onChar: (s: string) => void, onDone: () => void) => {
      let i = 0;
      onChar("");
      const tick = () => {
        i += 1;
        onChar(text.slice(0, i));
        if (i < text.length) timer.current = window.setTimeout(tick, TYPE_MS);
        else timer.current = window.setTimeout(onDone, 320);
      };
      timer.current = window.setTimeout(tick, TYPE_MS);
    },
    [],
  );

  // 인테이크 진입 시 스타일 노트 자동 타이핑(typeOut 이 ""로 초기화).
  React.useEffect(() => {
    if (stage === "intake") {
      typeOut(DEMO_INTAKE.styleNoteEn, setIntakeNote, () => {});
    }
  }, [stage, typeOut]);

  const revealNextChat = React.useCallback(
    (t: Track) => {
      const entry = DEMO_CHAT[chatCount];
      if (!entry) return;
      const autoKind = t === "customer" ? "customer" : "designer";
      if (entry.kind === autoKind) {
        typeOut(
          t === "customer" ? entry.en : entry.ko,
          (s) => setTyping(s),
          () => {
            setTyping(null);
            setChatCount((c) => c + 1);
          },
        );
      } else {
        setChatCount((c) => c + 1);
      }
    },
    [chatCount, typeOut],
  );

  const advance = React.useCallback(() => {
    if (busy) return;
    switch (stage) {
      case "intro":
        setStage("lang");
        break;
      case "lang":
        setStage("intake");
        break;
      case "intake":
        setStage("summary");
        break;
      case "summary":
        setChatCount(0);
        setStage("chat");
        break;
      case "chat":
        if (chatCount < DEMO_CHAT.length) revealNextChat("customer");
        else setStage("inservice");
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
        setChatCount(0);
        setStage("d-chat");
        break;
      case "d-chat":
        if (chatCount < DEMO_CHAT.length) revealNextChat("designer");
        else setStage("d-record");
        break;
      case "d-record":
        setStage("d-report");
        break;
      default:
        break;
    }
  }, [busy, stage, chatCount, revealNextChat]);

  const reset = React.useCallback(() => {
    if (timer.current) window.clearTimeout(timer.current);
    setTyping(null);
    setChatCount(0);
    setIntakeNote("");
    setStage("intro");
  }, []);

  // ── 리포트 화면(자체 MobileFrame) — 손님=EN(→디자이너 트랙), 디자이너=KO(→재시작) ──
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
        {stage === "intro" ? <IntroScreen url={url} /> : null}
        {stage === "lang" ? <LangScreen onPick={advance} /> : null}
        {stage === "intake" ? <IntakeScreen note={intakeNote} /> : null}
        {stage === "summary" ? <CustomerSummaryScreen /> : null}
        {stage === "chat" || stage === "d-chat" ? (
          <ChatScreen visible={chatCount} typing={typing} track={track} />
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
          busy={busy}
          typing={typing}
          chatDone={chatCount >= DEMO_CHAT.length}
          onAdvance={advance}
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
          <div className="rounded-xl border border-border bg-white p-3">
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
      <div className="space-y-1">
        <p className="flex items-center gap-1.5 text-base font-semibold text-foreground">
          <GlobeIcon className="size-4" />
          How can we help you today?
        </p>
        <p className="text-sm text-muted-foreground">
          No app, no sign-up. Just pick your language.
        </p>
      </div>
      <div className="grid gap-2.5">
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

function IntakeScreen({ note }: { note: string }) {
  const ICONS = [CutIcon, ColorIcon];
  return (
    <div className="space-y-4">
      <p className="text-base font-semibold text-foreground">
        Tell us the style you want
      </p>
      <Field label="Service">
        <div className="flex flex-wrap gap-2">
          {DEMO_INTAKE.servicesEn.map((s, i) => {
            const Icon = ICONS[i] ?? CutIcon;
            return <Pill key={s} icon={<Icon className="size-3.5" />} text={s} />;
          })}
        </div>
      </Field>
      <Field label="Style note">
        <Input value={note} readOnly aria-label="Style note" placeholder="…" />
      </Field>
      <PhotoGrid label="Reference photos" photos={DEMO_INTAKE.photos} />
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

      <Card className="border-l-4 border-l-foreground bg-muted">
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

      <Card>
        <CardContent className="p-4">
          <p className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <SparkleIcon className="size-4" />
            AI 요약
          </p>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
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
      <p className="flex items-center gap-1.5 text-base font-semibold text-foreground">
        <CareIcon className="size-4" />
        시술 기록
      </p>
      <Field label="사용한 약제·제품">
        <div className="flex flex-wrap gap-2">
          {DEMO_RECORD_KO.products.map((p) => (
            <Pill key={p} text={p} />
          ))}
        </div>
      </Field>
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
      <Field label="시술 후 사진">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={DEMO_RECORD_KO.after}
          alt="시술 후"
          className="aspect-[4/3] w-full rounded-xl border border-border object-cover"
        />
      </Field>
    </div>
  );
}

/* ── 채팅(트랙 공용) ─────────────────────────────────────── */

function ChatScreen({
  visible,
  typing,
  track,
}: {
  visible: number;
  typing: string | null;
  track: Track;
}) {
  const shown = DEMO_CHAT.slice(0, visible);
  return (
    <div className="flex flex-col gap-3">
      {shown.map((entry, i) => (
        <ChatRow key={i} entry={entry} track={track} />
      ))}
      {typing !== null ? (
        <MessageBubble
          side="me"
          text={typing || "…"}
          textLang={track === "customer" ? "en" : "ko"}
          pending
        />
      ) : null}
    </div>
  );
}

function ChatRow({ entry, track }: { entry: ChatEntry; track: Track }) {
  if (entry.kind === "system")
    return <SystemNote>{track === "customer" ? entry.en : entry.ko}</SystemNote>;

  const isCustomer = entry.kind === "customer";
  // 손님 트랙: 손님=me, 디자이너 트랙: 디자이너=me.
  const mine =
    (track === "customer" && isCustomer) ||
    (track === "designer" && !isCustomer);

  if (mine) {
    // 내 메시지 — 내 언어 원문만.
    return (
      <MessageBubble
        side="me"
        text={track === "customer" ? entry.en : entry.ko}
        textLang={track === "customer" ? "en" : "ko"}
      />
    );
  }
  // 상대 메시지 — 내 언어로 번역 + 원문 병기.
  const text = track === "customer" ? entry.en : entry.ko;
  const original = track === "customer" ? entry.ko : entry.en;
  return (
    <MessageBubble
      side="them"
      text={text}
      original={original}
      textLang={track === "customer" ? "en" : "ko"}
      originalLang={track === "customer" ? "ko" : "en"}
    />
  );
}

/* ── 푸터(탭 진행) ───────────────────────────────────────── */

function StageFooter({
  stage,
  busy,
  typing,
  chatDone,
  onAdvance,
}: {
  stage: Stage;
  busy: boolean;
  typing: string | null;
  chatDone: boolean;
  onAdvance: () => void;
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
    return (
      <div className="flex w-full items-end gap-2">
        <Input
          value={typing ?? ""}
          readOnly
          aria-label="Message"
          placeholder={ko ? "메시지 입력…" : "Type a message…"}
        />
        <Button
          variant="accent"
          size="lg"
          className="h-13 shrink-0 rounded-xl"
          onClick={onAdvance}
          disabled={busy}
        >
          {chatDone
            ? ko
              ? "다음 ›"
              : "Next ›"
            : ko
              ? "전송 ›"
              : "Send ›"}
        </Button>
      </div>
    );
  }

  const label: Record<string, string> = {
    intro: "Start ›",
    intake: "Send to designer ›",
    summary: "Next ›",
    inservice: "See my report ›",
    handoff: DEMO_HANDOFF.cta,
    "d-inbox": "상담 열기 ›",
    "d-summary": "시술 시작 ›",
    "d-record": "리포트 발송 ›",
  };

  return (
    <Button
      variant="accent"
      size="lg"
      className="w-full"
      onClick={onAdvance}
      disabled={busy}
    >
      {label[stage] ?? "Next ›"}
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

function Pill({ icon, text }: { icon?: React.ReactNode; text: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-foreground bg-foreground px-3 py-1.5 text-sm font-medium text-background">
      {icon}
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
