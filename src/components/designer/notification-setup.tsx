"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Button, toast } from "@/components/ui";
import { savePushSubscription } from "@/lib/actions";

/**
 * 디자이너 PWA 웹푸시 설정 — '알림 켜기'.
 * 지원 여부 → 권한/구독 상태 표시 → 구독 후 서버 저장.
 * 디자이너 뷰(ko 고정)이므로 useTranslations("Designer").notify.* 를 쓴다.
 */

/** VAPID base64url 공개키 → Uint8Array(applicationServerKey 표준 변환). */
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const buffer = new ArrayBuffer(raw.length);
  const output = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

type Status =
  | "loading"
  | "unsupported"
  | "needsInstall"
  | "off"
  | "on"
  | "denied";

export function NotificationSetup({
  staffToken,
  vapidPublicKey,
}: {
  staffToken: string;
  /** 서버(config.vapidPublicKey)에서 내려받음 — NEXT_PUBLIC 인라인 의존 제거 */
  vapidPublicKey: string;
}) {
  const t = useTranslations("Designer");
  const [status, setStatus] = React.useState<Status>("loading");
  const [pending, setPending] = React.useState(false);

  // 마운트 시: 지원 여부 + 현재 권한/구독 상태 점검.
  React.useEffect(() => {
    let cancelled = false;
    // 지원/권한/구독 점검은 외부 시스템 조회 → effect 비동기 분기에서 setState.
    (async () => {
      // iOS 는 '홈 화면에 추가'한 PWA(standalone)에서만 웹푸시가 동작한다.
      // Safari 탭에선 PushManager 자체가 없어 supported=false 가 되므로, 그 전에
      // iOS 를 먼저 가려 "지원 안 함"이 아니라 "설치 안내"를 띄운다.
      const ua = navigator.userAgent || "";
      const isIOS =
        /iPhone|iPad|iPod/.test(ua) ||
        // iPadOS 13+ 는 UA 가 Mac 으로 보고됨 → 터치 지원으로 식별
        (navigator.platform === "MacIntel" &&
          (navigator.maxTouchPoints ?? 0) > 1);
      const standalone =
        window.matchMedia?.("(display-mode: standalone)").matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone === true;
      if (isIOS && !standalone) {
        if (!cancelled) setStatus("needsInstall");
        return;
      }

      const supported =
        typeof navigator !== "undefined" &&
        "serviceWorker" in navigator &&
        typeof window !== "undefined" &&
        "PushManager" in window &&
        "Notification" in window;
      if (!supported) {
        if (!cancelled) setStatus("unsupported");
        return;
      }

      if (Notification.permission === "denied") {
        if (!cancelled) setStatus("denied");
        return;
      }
      try {
        const reg = await navigator.serviceWorker.getRegistration("/sw.js");
        const existing = reg ? await reg.pushManager.getSubscription() : null;
        if (cancelled) return;
        setStatus(existing && Notification.permission === "granted" ? "on" : "off");
      } catch {
        if (!cancelled) setStatus("off");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const enable = React.useCallback(async () => {
    if (pending) return;
    setPending(true);
    try {
      await navigator.serviceWorker.register("/sw.js");
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "off");
        toast.error(t("notify.denied"));
        return;
      }
      // SW 가 active 된 뒤에 구독해야 한다(no active Service Worker 방지).
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });
      const res = await savePushSubscription(
        staffToken,
        sub.toJSON() as {
          endpoint: string;
          keys: { p256dh: string; auth: string };
        },
      );
      if (res.ok) {
        setStatus("on");
        toast.success(t("notify.success"));
      } else {
        toast.error(t("notify.failed"));
      }
    } catch {
      toast.error(t("notify.failed"));
    } finally {
      setPending(false);
    }
  }, [pending, staffToken, t, vapidPublicKey]);

  if (status === "loading") return null;

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-0.5">
          <p className="text-sm font-medium text-foreground">
            {t("notify.title")}
          </p>
          <p className="text-xs text-muted-foreground">
            {t("notify.description")}
          </p>
        </div>
        {status === "on" && (
          <span className="shrink-0 text-sm font-medium text-foreground">
            ✓ {t("notify.on")}
          </span>
        )}
      </div>

      {status === "unsupported" && (
        <p className="mt-3 text-xs text-muted-foreground">
          {t("notify.unsupported")}
        </p>
      )}

      {status === "denied" && (
        <p className="mt-3 text-xs text-muted-foreground">
          {t("notify.denied")}
        </p>
      )}

      {status === "needsInstall" && (
        <p className="mt-3 text-xs text-muted-foreground">
          {t("notify.iosHint")}
        </p>
      )}

      {status === "off" && (
        <div className="mt-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={enable}
            disabled={pending}
          >
            {pending ? t("notify.enabling") : t("notify.enable")}
          </Button>
        </div>
      )}
    </section>
  );
}
