"use client";

import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  Button,
  buttonVariants,
  Input,
  MessageBubble,
  MobileFrame,
  ScreenBody,
  ScreenFooter,
  ScreenHeader,
  SystemNote,
  toast,
} from "@/components/ui";
import { cn } from "@/lib/utils";
import { getConsultationStatus, pollMessages, sendMessage } from "@/lib/actions";
import { reportPath } from "@/lib/links";
import { ConsultationSummary } from "@/components/shared/consultation-summary";
import {
  isAwaitingTranslation,
  messageMainText,
  messageOriginalText,
  messageSide,
} from "@/lib/domain/render";
import type {
  ConsultationStatus,
  Locale,
  Message,
} from "@/lib/domain/types";

const POLL_MS = 800;

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
  initialStatus,
  initialReportToken,
  summary,
}: {
  token: string;
  locale: Locale;
  salonName: string;
  initialMessages: Message[];
  /** 진입 시점 상담 상태 — 이미 완료라면 첫 렌더부터 리포트 CTA 노출. */
  initialStatus?: ConsultationStatus;
  /** 진입 시점 리포트 토큰(완료 + 발송 시 존재). */
  initialReportToken?: string;
  /** 시술중 화면용 상담 요약(시술 라벨은 호출부가 손님 언어로 resolve). 없으면 시술중 모드 미노출. */
  summary?: {
    services: string[];
    styleText?: string;
    photos?: string[];
    memo?: string;
    gender?: "female" | "male" | "other";
    age?: number;
  };
}) {
  const t = useTranslations("Customer");
  // 초기 로드 메시지는 정적 영역(aria-live 밖)에 둔다 — 마운트 시 일괄 announce 방지(P1).
  const [liveMessages, setLiveMessages] = React.useState<Message[]>([]);
  const [pending, setPending] = React.useState<Pending[]>([]);
  const [text, setText] = React.useState("");
  // 리포트 도착 토큰 — 진입 시 이미 완료라면 초기값으로, 아니면 폴링이 채운다.
  const [reportToken, setReportToken] = React.useState<string | undefined>(
    initialStatus === "completed" ? initialReportToken : undefined,
  );
  // 상담 상태 — 폴링으로 갱신(시술중 전이 감지).
  const [status, setStatus] = React.useState<ConsultationStatus | undefined>(
    initialStatus,
  );
  // 시술중 화면 ↔ 채팅 토글 — 시술중이어도 "추가 질문" 누르면 채팅으로.
  const [showChat, setShowChat] = React.useState(false);
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

  // 2s 폴링 — 폴 커서 이후만 append + 완료/리포트 도착 감지(같은 cadence)
  React.useEffect(() => {
    let active = true;
    // 리포트 도착을 이미 알면 status 폴링은 더 안 한다(자동이동 없이 CTA 만 띄움).
    let reportArrived = initialStatus === "completed" && !!initialReportToken;
    const tick = async () => {
      try {
        const next = await pollMessages({
          token,
          role: "customer",
          sinceIso: lastIsoRef.current,
        });
        if (!active) return;
        if (next.length > 0) {
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
        }
      } catch {
        // 폴링 실패는 조용히 무시(다음 tick 재시도)
      }
      // 상태 폴링 — 시술중(in_service)·완료 전이 감지. 완료 + 리포트면 CTA(+1회 toast) 후 중단.
      if (!reportArrived) {
        try {
          const st = await getConsultationStatus(token);
          if (!active) return;
          if (st) {
            setStatus(st.status);
            if (st.status === "completed" && st.reportToken) {
              reportArrived = true;
              setReportToken(st.reportToken);
              toast.success(t("thread.reportReady"));
            }
          }
        } catch {
          // 상태 폴링 실패도 조용히 무시
        }
      }
    };
    const id = setInterval(tick, POLL_MS);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [token, initialStatus, initialReportToken, t]);

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

  // 시술중 화면 라벨(ConsultationSummary 공유 카드용).
  const summaryLabels = {
    title: t("summary.title"),
    language: t("summary.language"),
    purpose: t("summary.purpose"),
    style: t("summary.style"),
    photos: t("summary.photos"),
    memo: t("summary.memo"),
    gender: t("summary.gender"),
    age: t("summary.age"),
    ageValue: t("summary.ageValue", { age: "{age}" }),
    step: {
      label: t("summary.step.label"),
      booked: t("summary.step.booked"),
      consulting: t("summary.step.consulting"),
      done: t("summary.step.done"),
    },
  };

  // 시술중 모드: 상태가 in_service 이고, 손님이 채팅으로 전환하지 않았고, 요약 데이터가 있을 때.
  const inServiceMode = status === "in_service" && !showChat && !!summary;

  if (inServiceMode && summary) {
    return (
      <MobileFrame tone="muted">
        <ScreenHeader
          title={salonName || t("thread.title")}
          subtitle={t("thread.translatedNote")}
        />
        <ScreenBody className="space-y-4 pb-4">
          <div className="rounded-2xl border border-foreground bg-foreground px-4 py-5 text-center text-background">
            <p className="text-lg font-bold">{t("thread.inServiceTitle")}</p>
            <p className="mt-1 text-sm text-background/80">
              {t("thread.inServiceSubtitle")}
            </p>
          </div>
          <ConsultationSummary
            language={t(`summary.languageNames.${locale}`)}
            services={summary.services}
            styleText={summary.styleText}
            photos={summary.photos}
            memo={summary.memo}
            gender={
              summary.gender
                ? t(`intake.about.genderOpt.${summary.gender}`)
                : undefined
            }
            age={summary.age}
            status="in_service"
            labels={summaryLabels}
          />
        </ScreenBody>
        <ScreenFooter>
          <Button
            variant="accent"
            size="lg"
            className="w-full"
            onClick={() => setShowChat(true)}
          >
            {t("thread.askMore")}
          </Button>
        </ScreenFooter>
      </MobileFrame>
    );
  }

  return (
    <MobileFrame tone="muted">
      <ScreenHeader
        title={salonName || t("thread.title")}
        subtitle={t("thread.translatedNote")}
      />

      <ScreenBody className="flex flex-col gap-3 pb-4">
        <div className="flex flex-1 flex-col gap-3">
          {/* 시술중에 채팅을 연 경우 — 시술 정보로 복귀 */}
          {status === "in_service" && summary ? (
            <button
              type="button"
              onClick={() => setShowChat(false)}
              className="self-start text-xs font-medium text-muted-foreground underline underline-offset-2"
            >
              ‹ {t("thread.backToService")}
            </button>
          ) : null}

          {/* 빈 스레드 안내 — 메시지가 하나도 없을 때만 */}
          {allMessages.length === 0 ? (
            <SystemNote>{t("thread.empty")}</SystemNote>
          ) : null}

          {/* 초기 로드 메시지 — 정적 영역(aria-live 밖) */}
          {initialMessages.map((m) => {
            // 서버가 번역을 채워 내려주므로 보통 false. 드물게 번역 실패 시엔
            // 스피너로 숨기지 않고 원문을 그대로 보여준다(원문+표기, 영구 스피너 방지).
            const translating = isAwaitingTranslation(m, locale);
            return (
              <MessageBubble
                key={m.id}
                side={messageSide(m, "customer")}
                text={messageMainText(m, locale)}
                original={messageOriginalText(m, locale)}
                translating={translating}
                textLang={translating ? m.sourceLocale : locale}
                originalLang={m.sourceLocale}
              />
            );
          })}

          {/* 신규 도착/전송 메시지 — aria-live(polite) 로 announce */}
          <div
            className="flex flex-col gap-3"
            aria-live="polite"
            aria-relevant="additions"
          >
            {liveMessages.map((m) => {
              const translating = isAwaitingTranslation(m, locale);
              return (
                <MessageBubble
                  key={m.id}
                  side={messageSide(m, "customer")}
                  text={messageMainText(m, locale)}
                  original={messageOriginalText(m, locale)}
                  translating={translating}
                  textLang={translating ? m.sourceLocale : locale}
                  originalLang={m.sourceLocale}
                />
              );
            })}

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

      {reportToken ? (
        <div className="border-t border-border bg-card px-4 py-3">
          <p className="mb-2 text-center text-sm font-medium text-foreground">
            {t("thread.reportReady")}
          </p>
          <Link
            href={reportPath(reportToken, locale)}
            className={cn(
              buttonVariants({ variant: "accent", size: "lg" }),
              "w-full",
            )}
          >
            {t("thread.viewReport")}
          </Link>
        </div>
      ) : null}

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
