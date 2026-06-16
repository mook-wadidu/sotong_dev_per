"use client";

import * as React from "react";
import Link from "next/link";
import {
  Button,
  Textarea,
  MessageBubble,
  SystemNote,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  buttonVariants,
  toast,
} from "@/components/ui";
import {
  QUICK_REPLIES,
  TIME_PRESETS,
  formatKRW,
  type QuickReply,
} from "@/lib/catalog";
import { sendMessage, pollMessages } from "@/lib/actions";
import {
  messageMainText,
  messageOriginalText,
  messageSide,
} from "@/lib/domain/render";
import { designerReportPath } from "@/lib/links";
import { cn } from "@/lib/utils";
import type { Message, Locale, QuickReplyIntent } from "@/lib/domain/types";

const VIEWER: Locale = "ko"; // 디자이너 뷰 고정
const POLL_MS = 2000;

/** 자유 타이핑 금지(P0-11) — 흔한 가격 프리셋(KRW won). 손님에겐 formatPrice 로 통화 표기. */
const PRICE_PRESETS = [30000, 50000, 80000, 100000, 120000, 150000];

type Pending = {
  tempId: string;
  text: string;
};

export function DesignerThread({
  token,
  initialMessages,
  estimatedPriceWon,
  labels,
}: {
  token: string;
  initialMessages: Message[];
  /** 인테이크 기반 예상가(KRW won) — price 칩 자동 프리필용 */
  estimatedPriceWon?: number;
  labels: {
    quickTitle: string;
    customLabel: string;
    send: string;
    placeholder: string;
    pricePrompt: string;
    timePrompt: string;
    pending: string;
    translatedNote: string;
    autoPrice: string;
    reportCta: string;
    sendError: string;
  };
}) {
  const [messages, setMessages] = React.useState<Message[]>(initialMessages);
  const [pendings, setPendings] = React.useState<Pending[]>([]);
  const [customOpen, setCustomOpen] = React.useState(false);
  const [customText, setCustomText] = React.useState("");
  const [valueSheet, setValueSheet] = React.useState<null | "price" | "time">(
    null,
  );
  const [sending, setSending] = React.useState(false);

  const bottomRef = React.useRef<HTMLDivElement>(null);
  // 폴 커서 — **서버 폴 응답으로 받은 메시지의 max createdAt** 으로만 전진(P1).
  // 내가 직접 보낸 메시지로는 전진시키지 않아, '내가 보내기 직전 상대가 보낸 메시지'(createdAt 더 이른)도
  // 다음 폴에서 빠짐없이 잡힌다. 중복 렌더는 seen(id) dedupe 로 방지.
  const lastIsoRef = React.useRef<string | undefined>(
    initialMessages.at(-1)?.createdAt,
  );

  // 2s 폴링 — 폴 커서 이후만 가져와 병합
  React.useEffect(() => {
    let active = true;
    const tick = async () => {
      const fresh = await pollMessages({
        token,
        role: "designer",
        sinceIso: lastIsoRef.current,
      });
      if (!active || fresh.length === 0) return;
      // 커서는 폴 응답의 max createdAt 으로만 전진(내 전송분과 무관).
      const maxIso = fresh.reduce(
        (acc, m) => (m.createdAt > acc ? m.createdAt : acc),
        lastIsoRef.current ?? "",
      );
      lastIsoRef.current = maxIso || lastIsoRef.current;
      setMessages((prev) => {
        const seen = new Set(prev.map((m) => m.id));
        return [...prev, ...fresh.filter((m) => !seen.has(m.id))];
      });
    };
    const id = setInterval(tick, POLL_MS);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [token]);

  // 새 메시지/낙관적 표시 도착 시 하단 스크롤
  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages, pendings]);

  const send = React.useCallback(
    async (input: {
      intent?: QuickReplyIntent;
      replyId?: string;
      value?: string;
      text?: string;
      optimisticText: string;
      onError?: () => void;
    }) => {
      const tempId = `tmp-${Date.now()}-${Math.random()}`;
      setPendings((p) => [...p, { tempId, text: input.optimisticText }]);
      setSending(true);
      try {
        const msg = await sendMessage({
          token,
          role: "designer",
          intent: input.intent,
          replyId: input.replyId,
          value: input.value,
          text: input.text,
        });
        // 화면(seen dedupe)에는 추가하되, 폴 커서(lastIsoRef)는 전진시키지 않는다(P1).
        if (msg) {
          setMessages((prev) =>
            prev.some((m) => m.id === msg.id) ? prev : [...prev, msg],
          );
        }
      } catch {
        input.onError?.();
        toast.error(labels.sendError);
      } finally {
        setPendings((p) => p.filter((x) => x.tempId !== tempId));
        setSending(false);
      }
    },
    [token, labels.sendError],
  );

  const onQuickReply = (qr: QuickReply) => {
    if (qr.intent === "price") {
      setValueSheet("price");
      return;
    }
    if (qr.intent === "time") {
      setValueSheet("time");
      return;
    }
    // 낙관적 버블은 탭한 칩의 message.ko 와 일치(깜빡임 제거, P1).
    void send({
      intent: qr.intent,
      replyId: qr.replyId,
      optimisticText: qr.message.ko,
    });
  };

  const sendPrice = (won: number) => {
    setValueSheet(null);
    const qr = QUICK_REPLIES.find((q) => q.replyId === "price");
    // 손님에겐 통화 표기로 가지만, 디자이너 낙관적 버블은 ko(원화) 표기로.
    const optimistic = qr
      ? qr.message.ko.replace("{value}", formatKRW(won))
      : formatKRW(won);
    void send({
      intent: "price",
      replyId: "price",
      value: String(won),
      optimisticText: optimistic,
    });
  };

  const sendTime = (minutes: number) => {
    setValueSheet(null);
    const tp = TIME_PRESETS.find((t) => t.minutes === minutes);
    const qr = QUICK_REPLIES.find((q) => q.replyId === "time");
    // value 엔 분(number 문자열)만 싣고, 손님은 자기 로케일 TIME_PRESETS 라벨을 받는다.
    const optimistic =
      qr && tp ? qr.message.ko.replace("{value}", tp.label.ko) : String(minutes);
    void send({
      intent: "time",
      replyId: "time",
      value: String(minutes),
      optimisticText: optimistic,
    });
  };

  const sendCustom = () => {
    const text = customText.trim();
    if (!text) return;
    setCustomText("");
    setCustomOpen(false);
    void send({
      intent: "custom",
      text,
      optimisticText: text,
      onError: () => {
        setCustomText(text);
        setCustomOpen(true);
      },
    });
  };

  return (
    <>
      {/* 메시지 영역 (스크롤) */}
      <div
        className="flex-1 space-y-2.5 overflow-y-auto px-4 py-4"
        aria-live="polite"
        aria-relevant="additions"
      >
        <SystemNote>{labels.translatedNote}</SystemNote>
        {messages.map((m) => {
          if (m.sender === "system") {
            return (
              <SystemNote key={m.id}>{messageMainText(m, VIEWER)}</SystemNote>
            );
          }
          const side = messageSide(m, "designer");
          return (
            <MessageBubble
              key={m.id}
              side={side}
              text={messageMainText(m, VIEWER)}
              original={messageOriginalText(m, VIEWER)}
              textLang={VIEWER}
              originalLang={m.sourceLocale}
            />
          );
        })}
        {pendings.map((p) => (
          <MessageBubble
            key={p.tempId}
            side="me"
            text={p.text}
            textLang={VIEWER}
            pending
            pendingLabel={labels.pending}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* 입력 영역 — 퀵리플라이 칩 우선 */}
      <div className="sticky bottom-0 z-20 border-t border-border/70 bg-background/95 px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-3 backdrop-blur-md">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">
            {labels.quickTitle}
          </span>
          <Link
            href={designerReportPath(token)}
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "text-accent-text",
            )}
          >
            {labels.reportCta}
          </Link>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {QUICK_REPLIES.map((qr) => (
            <button
              key={qr.replyId}
              type="button"
              disabled={sending}
              onClick={() => onQuickReply(qr)}
              className="inline-flex items-center rounded-full border border-border bg-card px-3 py-2 text-sm font-medium text-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.97] disabled:opacity-50"
            >
              {qr.chipLabel}
            </button>
          ))}

          {/* 직접 입력 */}
          <button
            type="button"
            onClick={() => setCustomOpen((v) => !v)}
            className="inline-flex items-center rounded-full border border-foreground bg-accent-soft px-3 py-2 text-sm font-semibold text-accent-text outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.97]"
            aria-expanded={customOpen}
          >
            {labels.customLabel}
          </button>
        </div>

        {/* 직접 입력 패널 */}
        {customOpen ? (
          <div className="mt-2.5 space-y-2">
            <Textarea
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              placeholder={labels.placeholder}
              rows={2}
              autoFocus
            />
            <Button
              variant="accent"
              size="default"
              className="w-full"
              onClick={sendCustom}
              disabled={sending || !customText.trim()}
            >
              {labels.send}
            </Button>
          </div>
        ) : null}
      </div>

      {/* 가격 선택 Sheet */}
      <Sheet
        open={valueSheet === "price"}
        onOpenChange={(o) => !o && setValueSheet(null)}
      >
        <SheetContent closeLabel="닫기">
          <SheetHeader>
            <SheetTitle>{labels.pricePrompt}</SheetTitle>
            <SheetDescription>{labels.translatedNote}</SheetDescription>
          </SheetHeader>
          <div className="grid grid-cols-2 gap-2">
            {estimatedPriceWon ? (
              <Button
                variant="accent"
                size="lg"
                className="col-span-2 w-full"
                onClick={() => sendPrice(estimatedPriceWon)}
              >
                {labels.autoPrice}: {formatKRW(estimatedPriceWon)}
              </Button>
            ) : null}
            {PRICE_PRESETS.map((won) => (
              <Button
                key={won}
                variant="outline"
                size="lg"
                className="w-full"
                onClick={() => sendPrice(won)}
              >
                {formatKRW(won)}
              </Button>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      {/* 소요시간 선택 Sheet */}
      <Sheet
        open={valueSheet === "time"}
        onOpenChange={(o) => !o && setValueSheet(null)}
      >
        <SheetContent closeLabel="닫기">
          <SheetHeader>
            <SheetTitle>{labels.timePrompt}</SheetTitle>
            <SheetDescription>{labels.translatedNote}</SheetDescription>
          </SheetHeader>
          <div className="grid grid-cols-2 gap-2">
            {TIME_PRESETS.map((tp) => (
              <Button
                key={tp.minutes}
                variant="outline"
                size="lg"
                className="w-full"
                onClick={() => sendTime(tp.minutes)}
              >
                {tp.label.ko}
              </Button>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
