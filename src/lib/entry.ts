import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { config } from "@/lib/config";

/**
 * QR 입장 토큰 — "QR = 입장권" 모델. 두 종류:
 *  - 디자이너 QR: payload = "d:{designerId}.v{version}" → 진입 시 해당 디자이너 배정
 *  - 살롱 공용 QR(지정없음): payload = "s:{salonSlug}.v{version}" → 미배정 진입
 * 형식 = base64url(payload) + "." + HMAC(payload). 유출 대응은 version(키 회전)으로.
 * 손님 URL 에는 이 불투명 토큰만 노출(추측 가능한 slug/id 비노출).
 */
export type VerifiedEntry =
  | { kind: "designer"; designerId: string; version: number }
  | { kind: "salon"; salonSlug: string; version: number };

export function makeDesignerEntryToken(designerId: string, version = 1): string {
  const payload = `d:${designerId}.v${version}`;
  return `${b64url(payload)}.${sign(payload)}`;
}

export function makeSalonEntryToken(salonSlug: string, version = 1): string {
  const payload = `s:${salonSlug}.v${version}`;
  return `${b64url(payload)}.${sign(payload)}`;
}

export function verifyEntryToken(token: string): VerifiedEntry | null {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const encoded = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  let payload: string;
  try {
    payload = Buffer.from(encoded, "base64url").toString("utf8");
  } catch {
    return null;
  }
  if (!safeEqual(sig, sign(payload))) return null;
  const m = payload.match(/^([ds]):(.+)\.v(\d+)$/);
  if (!m) return null;
  const [, prefix, id, ver] = m;
  const version = Number(ver);
  if (prefix === "d") return { kind: "designer", designerId: id, version };
  return { kind: "salon", salonSlug: id, version };
}

/** 어드민 키 검증 (MVP: 단일 공유 키, 상수시간 비교) */
export function verifyAdminKey(key: string | undefined | null): boolean {
  if (!key) return false;
  return safeEqual(key, config.adminToken);
}

/**
 * 손님 제시-QR용 단수명(short-lived) 핸드오프 토큰.
 * claim 인증은 파일럿에서 컷 → 토큰 자체가 접근권이라 TTL 짧게(노출창 최소화).
 * Phase 2에서 staffToken claim 추가 예정.
 * payload = "h:{consultationId}:{expiresAtMs}", 형식 = base64url(payload) + "." + HMAC(payload).
 */
export const HANDOFF_TTL_MS = 10 * 60 * 1000; // 10분

export function makeHandoffToken(
  consultationId: string,
  expiresAtMs: number,
): string {
  const payload = `h:${consultationId}:${expiresAtMs}`;
  return `${b64url(payload)}.${sign(payload)}`;
}

export function verifyHandoffToken(
  token: string,
): { consultationId: string } | null {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const encoded = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  let payload: string;
  try {
    payload = Buffer.from(encoded, "base64url").toString("utf8");
  } catch {
    return null;
  }
  if (!safeEqual(sig, sign(payload))) return null;
  const m = payload.match(/^h:(.+):(\d+)$/);
  if (!m) return null;
  const [, consultationId, expStr] = m;
  const expiresAtMs = Number(expStr);
  // 서명 유효해도 만료(또는 파싱 불가)면 접근 불가 — TTL 로 노출창을 상쇄.
  if (!Number.isFinite(expiresAtMs) || Date.now() >= expiresAtMs) return null;
  return { consultationId };
}

function sign(payload: string): string {
  return createHmac("sha256", config.entrySecret).update(payload).digest("base64url");
}

function b64url(s: string): string {
  return Buffer.from(s, "utf8").toString("base64url");
}

function safeEqual(a: string, b: string): boolean {
  // 길이 조기반환은 타이밍 오라클(길이 노출) → 양쪽을 고정 32B HMAC 다이제스트로 비교.
  const ha = createHmac("sha256", config.entrySecret).update(a).digest();
  const hb = createHmac("sha256", config.entrySecret).update(b).digest();
  return timingSafeEqual(ha, hb);
}
