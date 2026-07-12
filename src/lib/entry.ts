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
