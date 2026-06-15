"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import {
  Button,
  Input,
  MessageBubble,
  MobileFrame,
  ScreenBody,
  ScreenFooter,
  ScreenHeader,
  SystemNote,
  toast,
} from "@/components/ui";
import { pollMessages, sendMessage } from "@/lib/actions";
import {
  messageMainText,
  messageOriginalText,
  messageSide,
} from "@/lib/domain/render";
import type { Locale, Message } from "@/lib/domain/types";

const POLL_MS = 2000;

/** 낙관적(전송 중) 메시지 — 서버 Message 와 구분하기 위한 로컬 표현 */
interface Pending {
  tempId: string;
  text: string;
}

export function CustomerThread({
  token,
  locale,
  salonName,
  initialMessages,
}: {
  token: string;
  locale: Locale;
  salonName: string;
  initialMessages: Message[];
}) {
  const t = useTranslations("Customer");
  // 초기 로드 메시지는 정적 영역(aria-live 밖)에 둔다 — 마운트 시 일괄 announce 방지(P1).
  const [liveMessages, setLiveMessages] = React.useState<Message[]>([]);
  const [pending, setPending] = React.useState<Pending[]>([]);
  const [text, setText] = React.useState("");
  const endRef = React.useRef<HTMLDivElement>(null);
  // 폴 커서 — **서버 폴 응답의 max createdAt** 으로만 전진(P1).
  // 내가 보낸 메시지로는 전진시키지 않아, 내 전송 직전 도착한 상대 메시지도 다음 폴에서 잡힌다.
  const lastIsoRef = React.useRef<string | undefined>(
    initialMessages.at(-1)?.createdAt,
  );
  // id dedupe — 초기/신규/내전송 메시지 중복 렌더 방지.
  const seenIdsRef = React.useRef<Set<string>>(
    new Set(initialMessages.map((m) => m.id)),
  );

  const allMessages = React.useMemo(
    () => [...initialMessages, ...liveMessages],
    [initialMessages, liveMessages],
  );

  // 2s 폴링 — 폴 커서 이후만 append
  React.useEffect(() => {
    let active = true;
    const tick = async () => {
      try {
        const next = await pollMessages({
          token,
          role: "customer",
          sinceIso: lastIsoRef.current,
        });
        if (!active || next.length === 0) return;
        const maxIso = next.reduce(
          (acc, m) => (m.createdAt > acc ? m.createdAt : acc),
          lastIsoRef.current ?? "",
        );
        lastIsoRef.current = maxIso || lastIsoRef.current;
        setLiveMessages((prev) => {
          const fresh = next.filter((m) => !seenIdsRef.current.has(m.id));
          if (!fresh.length) return prev;
          for (const m of fresh) seenIdsRef.current.add(m.id);
          return [...prev, ...fresh];
        });
      } catch {
        // 폴링 실패는 조용히 무시(다음 tick 재시도)
      }
    };
    const id = setInterval(tick, POLL_MS);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [token]);

  // 자동 스크롤 (새 메시지/펜딩 도착 시)
  React.useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [liveMessages, pending]);

  const onSend = async () => {
    const value = text.trim();
    if (!value) return;
    const tempId = `tmp_${Date.now()}`;
    setText("");
    setPending((p) => [...p, { tempId, text: value }]);
    try {
      const msg = await sendMessage({ token, role: "customer", text: value });
      setPending((p) => p.filter((x) => x.tempId !== tempId));
      // 화면(seen dedupe)에는 추가하되, 폴 커서는 전진시키지 않는다(P1).
      if (msg && !seenIdsRef.current.has(msg.id)) {
        seenIdsRef.current.add(msg.id);
        setLiveMessages((prev) => [...prev, msg]);
      }
    } catch {
      setPending((p) => p.filter((x) => x.tempId !== tempId));
      setText(value);
      toast.error(t("thread.sendError"));
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.nativeEvent.isComposing) {
      e.preventDefault();
      onSend();
    }
  };

  // 손님만 보냈고 디자이너 응답이 아직 없을 때 "곧 답해드려요" 안내
  const customerSent = allMessages.some(
    (m) => messageSide(m, "customer") === "me",
  );
  const designerReplied = allMessages.some(
    (m) => messageSide(m, "customer") === "them" && m.sender !== "system",
  );

  return (
    <MobileFrame tone="muted">
      <ScreenHeader
        title={salonName || t("thread.title")}
        subtitle={t("thread.translatedNote")}
      />

      <ScreenBody className="flex flex-col gap-3 pb-4">
        <div className="flex flex-1 flex-col gap-3">
          {/* 빈 스레드 안내 — 메시지가 하나도 없을 때만 */}
          {allMessages.length === 0 ? (
            <SystemNote>{t("thread.empty")}</SystemNote>
          ) : null}

          {/* 초기 로드 메시지 — 정적 영역(aria-live 밖) */}
          {initialMessages.map((m) => (
            <MessageBubble
              key={m.id}
              side={messageSide(m, "customer")}
              text={messageMainText(m, locale)}
              original={messageOriginalText(m, locale)}
              textLang={locale}
              originalLang={m.sourceLocale}
            />
          ))}

          {/* 신규 도착/전송 메시지 — aria-live(polite) 로 announce */}
          <div
            className="flex flex-col gap-3"
            aria-live="polite"
            aria-relevant="additions"
          >
            {liveMessages.map((m) => (
              <MessageBubble
                key={m.id}
                side={messageSide(m, "customer")}
                text={messageMainText(m, locale)}
                original={messageOriginalText(m, locale)}
                textLang={locale}
                originalLang={m.sourceLocale}
              />
            ))}

            {pending.map((p) => (
              <MessageBubble
                key={p.tempId}
                side="me"
                text={p.text}
                textLang={locale}
                pending
                pendingLabel={t("thread.sending")}
              />
            ))}

            {customerSent && !designerReplied ? (
              <SystemNote>{t("thread.waiting")}</SystemNote>
            ) : null}
          </div>

          <div ref={endRef} />
        </div>
      </ScreenBody>

      <ScreenFooter>
        <div className="flex items-end gap-2">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={t("thread.placeholder")}
            aria-label={t("thread.placeholder")}
            enterKeyHint="send"
          />
          <Button
            variant="accent"
            size="lg"
            className="h-13 shrink-0 rounded-xl"
            onClick={onSend}
            disabled={!text.trim()}
          >
            {t("thread.send")}
          </Button>
        </div>
      </ScreenFooter>
    </MobileFrame>
  );
}
