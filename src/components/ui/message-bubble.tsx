import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * 번역 상담 스레드의 말풍선.
 * - `text`: 보는 사람 언어로 번역된 본문 (메인)
 * - `original`: 원문 (회색 병기) — 번역과 다를 때만 노출
 * - `side`: "me" = 보는 사람 본인(오른쪽), "them" = 상대(왼쪽)
 * - `textLang`/`originalLang`: 각 문단 <p lang> 부여 (스크린리더·자형 정확도)
 * - `pending`: 낙관적 전송 중 → "전송 중" 표시
 */
export function MessageBubble({
  text,
  original,
  side,
  meta,
  pending,
  textLang,
  originalLang,
  pendingLabel = "전송 중…",
  className,
}: {
  text: React.ReactNode;
  original?: string;
  side: "me" | "them";
  meta?: React.ReactNode;
  pending?: boolean;
  /** 번역 본문 언어 코드 (예: "ko") */
  textLang?: string;
  /** 원문 언어 코드 (예: "ja") */
  originalLang?: string;
  /** pending 동안 표시할 라벨 (i18n 가능) */
  pendingLabel?: React.ReactNode;
  className?: string;
}) {
  const isMe = side === "me";
  return (
    <div
      className={cn(
        "flex w-full flex-col gap-1",
        isMe ? "items-end" : "items-start",
        className,
      )}
    >
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[0.95rem] leading-snug shadow-sm",
          isMe
            ? "rounded-br-md bg-accent-strong text-white"
            : "rounded-bl-md bg-card text-card-foreground",
          pending && "opacity-70",
        )}
      >
        <p className="whitespace-pre-wrap break-words" lang={textLang}>
          {text}
        </p>
        {original ? (
          <p
            lang={originalLang}
            className={cn(
              // 원문 가독성 상향: CJK 원문 크기·여백 소폭 올림.
              "mt-1.5 border-t pt-2 text-[0.85rem] leading-relaxed",
              isMe
                ? "border-white/35 text-white/90"
                : "border-border text-foreground/75",
            )}
          >
            {original}
          </p>
        ) : null}
      </div>
      {pending ? (
        <span className="flex items-center gap-1 px-1 text-[0.7rem] text-muted-foreground">
          {pendingLabel}
        </span>
      ) : meta ? (
        <span className="flex items-center gap-1 px-1 text-[0.7rem] text-muted-foreground">
          {meta}
        </span>
      ) : null}
    </div>
  );
}

/** 시스템/안내 메시지 (가운데 정렬, 얇게) */
export function SystemNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-1 flex justify-center">
      <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
        {children}
      </span>
    </div>
  );
}
