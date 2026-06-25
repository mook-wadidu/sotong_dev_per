"use client";

import * as React from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  Badge,
  Button,
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
  ChatIcon,
  CareIcon,
  CutIcon,
  ColorIcon,
  GlobeIcon,
  PhotoIcon,
} from "@/components/icons";
import { cn } from "@/lib/utils";
import {
  DEMO_CHAT,
  DEMO_INSERVICE,
  DEMO_INTAKE,
  DEMO_LANGS,
  DEMO_RECEIVED_NOTE,
  DEMO_REPORT,
  DEMO_REPORT_DATE_LABEL,
  DEMO_REPORT_LABELS,
  DEMO_REPORT_NEXT_VISIT,
  DEMO_REPORT_PROFILE,
  DEMO_REPORT_VISIT,
  DEMO_SUMMARY_LABELS,
  type ChatEntry,
} from "./demo-script";

type Stage =
  | "intro"
  | "lang"
  | "intake"
  | "summary"
  | "chat"
  | "inservice"
  | "report";

const TYPE_MS = 38;

/**
 * MVP 데모 플레이어 — QR 하나로 손님 전체 여정(언어→인테이크→채팅→시술중→리포트)을
 * **탭하면 한 단계씩** 재생한다. 채팅 입력바는 실제 치는 것처럼 자동 타이핑.
 * 완전 하드코딩(demo-script) — DB·AI·네트워크 0. 발표/영업 시연용.
 */
export function DemoPlayer({ url }: { url: string }) {
  const [stage, setStage] = React.useState<Stage>("intro");
  const [chatCount, setChatCount] = React.useState(0);
  const [typing, setTyping] = React.useState<string | null>(null);
  const [intakeNote, setIntakeNote] = React.useState("");
  const timer = React.useRef<number | null>(null);
  const busy = typing !== null;

  React.useEffect(() => {
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, []);

  /** 텍스트를 글자씩 흘려 onChar 로 흘려보내고 끝나면 onDone. */
  const typeOut = React.useCallback(
    (text: string, onChar: (s: string) => void, onDone: () => void) => {
      let i = 0;
      onChar("");
      const tick = () => {
        i += 1;
        onChar(text.slice(0, i));
        if (i < text.length) {
          timer.current = window.setTimeout(tick, TYPE_MS);
        } else {
          timer.current = window.setTimeout(onDone, 320);
        }
      };
      timer.current = window.setTimeout(tick, TYPE_MS);
    },
    [],
  );

  // 인테이크 진입 시 스타일 노트를 자동 타이핑(실제 적는 느낌).
  // typeOut 이 첫 onChar("") 로 초기화하므로 별도 동기 setState 불필요.
  React.useEffect(() => {
    if (stage === "intake") {
      typeOut(DEMO_INTAKE.styleNote, setIntakeNote, () => {});
    }
  }, [stage, typeOut]);

  const revealNextChat = React.useCallback(() => {
    const entry = DEMO_CHAT[chatCount];
    if (!entry) return;
    if (entry.kind === "customer") {
      typeOut(
        entry.text,
        (s) => setTyping(s),
        () => {
          setTyping(null);
          setChatCount((c) => c + 1);
        },
      );
    } else {
      setChatCount((c) => c + 1);
    }
  }, [chatCount, typeOut]);

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
        setStage("chat");
        break;
      case "chat":
        if (chatCount < DEMO_CHAT.length) revealNextChat();
        else setStage("inservice");
        break;
      case "inservice":
        setStage("report");
        break;
      case "report":
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

  // ── 리포트는 자체 MobileFrame 화면이라 분리 렌더 + 재시작 오버레이 ──
  if (stage === "report") {
    return (
      <div className="relative">
        <ReportView
          report={DEMO_REPORT}
          labels={DEMO_REPORT_LABELS}
          dateLabel={DEMO_REPORT_DATE_LABEL}
          nextVisitText={DEMO_REPORT_NEXT_VISIT}
          profile={DEMO_REPORT_PROFILE}
          visit={DEMO_REPORT_VISIT}
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
    <MobileFrame tone="muted" lang="en">
      <ScreenHeader
        title="소통 · Sotong"
        subtitle="Live demo"
        trailing={<DemoStepBadge stage={stage} />}
      />

      <ScreenBody className="space-y-4 pb-2">
        {stage === "intro" ? <IntroScreen url={url} /> : null}
        {stage === "lang" ? <LangScreen onPick={advance} /> : null}
        {stage === "intake" ? <IntakeScreen note={intakeNote} /> : null}
        {stage === "summary" ? <SummaryScreen /> : null}
        {stage === "chat" ? (
          <ChatScreen visible={chatCount} typing={typing} />
        ) : null}
        {stage === "inservice" ? <InServiceScreen /> : null}
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

/* ── 스테이지별 화면 ─────────────────────────────────────── */

function IntroScreen({ url }: { url: string }) {
  return (
    <div className="flex flex-col items-center gap-5 py-6 text-center">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-bold tracking-tight">
          A salon visit, in your language.
        </h1>
        <p className="text-sm text-muted-foreground">
          See the whole experience in under a minute — tap to walk through it.
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
  const SERVICE_ICONS = [CutIcon, ColorIcon];
  return (
    <div className="space-y-4">
      <p className="text-base font-semibold text-foreground">
        Tell us the style you want
      </p>

      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Service
        </p>
        <div className="flex flex-wrap gap-2">
          {DEMO_INTAKE.services.map((s, i) => {
            const Icon = SERVICE_ICONS[i] ?? CutIcon;
            return (
              <span
                key={s}
                className="inline-flex items-center gap-1.5 rounded-full border border-foreground bg-foreground px-3 py-1.5 text-sm font-medium text-background"
              >
                <Icon className="size-3.5" />
                {s}
              </span>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Style note
        </p>
        <Input
          value={note}
          readOnly
          aria-label="Style note"
          placeholder="e.g. long layered cut…"
        />
      </div>

      <div className="space-y-2">
        <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <PhotoIcon className="size-3.5" />
          Reference photos
        </p>
        <div className="grid grid-cols-3 gap-2">
          {DEMO_INTAKE.photos.map((src, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={src}
              alt={`Reference ${i + 1}`}
              className="aspect-square w-full rounded-xl border border-border object-cover"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function SummaryScreen() {
  return (
    <div className="space-y-4">
      <SystemNote>{DEMO_RECEIVED_NOTE}</SystemNote>
      <ConsultationSummary
        language="English"
        services={DEMO_INTAKE.services}
        styleText={DEMO_INTAKE.styleNote}
        photos={DEMO_INTAKE.photos}
        gender="Female"
        age={29}
        status="consulting"
        labels={DEMO_SUMMARY_LABELS}
      />
    </div>
  );
}

function ChatScreen({
  visible,
  typing,
}: {
  visible: number;
  typing: string | null;
}) {
  const shown = DEMO_CHAT.slice(0, visible);
  return (
    <div className="flex flex-col gap-3">
      {shown.map((entry, i) => (
        <ChatRow key={i} entry={entry} />
      ))}
      {typing !== null ? (
        <MessageBubble side="me" text={typing || "…"} textLang="en" pending />
      ) : null}
    </div>
  );
}

function ChatRow({ entry }: { entry: ChatEntry }) {
  if (entry.kind === "system") return <SystemNote>{entry.text}</SystemNote>;
  if (entry.kind === "customer")
    return <MessageBubble side="me" text={entry.text} textLang="en" />;
  return (
    <MessageBubble
      side="them"
      text={entry.text}
      original={entry.original}
      textLang="en"
      originalLang="ko"
    />
  );
}

function InServiceScreen() {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-foreground bg-foreground px-4 py-5 text-center text-background">
        <p className="flex items-center justify-center gap-1.5 text-lg font-bold">
          <CareIcon className="size-5" />
          {DEMO_INSERVICE.title}
        </p>
        <p className="mt-1 text-sm text-background/80">
          {DEMO_INSERVICE.subtitle}
        </p>
      </div>
      <ConsultationSummary
        language="English"
        services={DEMO_INTAKE.services}
        styleText={DEMO_INTAKE.styleNote}
        photos={DEMO_INTAKE.photos}
        gender="Female"
        age={29}
        status="in_service"
        labels={DEMO_SUMMARY_LABELS}
      />
    </div>
  );
}

/* ── 푸터(탭 진행 컨트롤) ─────────────────────────────────── */

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
  // 언어 선택은 버튼 자체가 진행 → 푸터엔 안내만.
  if (stage === "lang") {
    return (
      <p className="w-full text-center text-xs text-muted-foreground">
        Tap a language to continue
      </p>
    );
  }

  // 채팅: 입력바(자동 타이핑 노출) + 다음 버튼.
  if (stage === "chat") {
    return (
      <div className="flex w-full items-end gap-2">
        <Input
          value={typing ?? ""}
          readOnly
          aria-label="Message"
          placeholder="Type a message…"
        />
        <Button
          variant="accent"
          size="lg"
          className="h-13 shrink-0 rounded-xl"
          onClick={onAdvance}
          disabled={busy}
        >
          {chatDone ? "Next ›" : "Send ›"}
        </Button>
      </div>
    );
  }

  const label =
    stage === "intro"
      ? "Start ›"
      : stage === "intake"
        ? "Send to designer ›"
        : stage === "inservice"
          ? "See my report ›"
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

function DemoStepBadge({ stage }: { stage: Stage }) {
  const map: Record<Stage, { n: number; label: string }> = {
    intro: { n: 1, label: "Start" },
    lang: { n: 2, label: "Language" },
    intake: { n: 3, label: "Intake" },
    summary: { n: 4, label: "Sent" },
    chat: { n: 5, label: "Chat" },
    inservice: { n: 6, label: "Service" },
    report: { n: 7, label: "Report" },
  };
  const s = map[stage];
  return (
    <Badge variant="outline" className="gap-1">
      <ChatIcon className="size-3" />
      {s.n}/7 · {s.label}
    </Badge>
  );
}
