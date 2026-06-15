import type { Locale, Message } from "./types";

/**
 * 말풍선 렌더 헬퍼 (순수 함수 — 클라이언트/서버 양쪽에서 사용).
 * 보는 사람(viewer) 언어로 메인 텍스트를 고르고, 원문이 다르면 회색 병기용 원문을 돌려준다.
 */
export function messageMainText(msg: Message, viewer: Locale): string {
  if (msg.sourceLocale === viewer) return msg.sourceText;
  return msg.translations[viewer] ?? msg.sourceText;
}

export function messageOriginalText(
  msg: Message,
  viewer: Locale,
): string | undefined {
  if (msg.sourceLocale === viewer) return undefined;
  const main = messageMainText(msg, viewer);
  return main !== msg.sourceText ? msg.sourceText : undefined;
}

/** viewer 기준으로 이 메시지가 내 것(오른쪽)인지 */
export function messageSide(
  msg: Message,
  viewerRole: "customer" | "designer",
): "me" | "them" {
  if (msg.sender === "system") return "them";
  return msg.sender === viewerRole ? "me" : "them";
}
