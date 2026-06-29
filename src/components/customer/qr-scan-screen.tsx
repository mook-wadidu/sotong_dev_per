"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import jsQR from "jsqr";
import { Button } from "@/components/ui";

/**
 * 손님 진입 QR 스캐너 — "손님으로 시작하기"에서 연다.
 * 매장/디자이너 QR(= /c/e/<토큰> 절대 URL)을 카메라로 읽어 그 매장으로 진입.
 *
 * 보안: 읽은 문자열에서 **pathname 만** 뽑아 우리 origin 으로 router.push 한다.
 *  - 외부 호스트 QR 이어도 외부로 절대 나가지 않는다(pathname 만 사용).
 *  - 진입 경로(/c/e/<토큰>) 패턴이 아니면 무시하고 계속 스캔(/admin·/d/·/s/ 등 거부).
 *  - 위조 토큰은 우리 경로로 가도 서버가 HMAC 검증 실패 → InvalidEntry.
 *
 * iOS Safari: getUserMedia 는 secure context(HTTPS, localhost 예외) 필수.
 *  실패 시 안내 + "다시 시도"(사용자 제스처) 폴백.
 */

// /c/e/<토큰> (로케일 프리픽스 선택). 토큰 = base64url.base64url → [A-Za-z0-9._-].
const ENTRY_PATH_RE = /^\/(?:[a-z]{2}\/)?c\/e\/[A-Za-z0-9._-]+$/;

type ScanLabels = {
  title: string;
  hint: string;
  preparing: string;
  denied: string;
  error: string;
  retry: string;
  back: string;
};

type Status = "starting" | "scanning" | "denied" | "error";

export function QrScanScreen({
  labels,
  homeHref,
}: {
  labels: ScanLabels;
  homeHref: string;
}) {
  const router = useRouter();
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const rafRef = React.useRef<number | null>(null);
  const doneRef = React.useRef(false);
  const [status, setStatus] = React.useState<Status>("starting");

  const stop = React.useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  // 읽은 문자열 → 우리 진입 경로면 이동(true), 아니면 무시(false → 계속 스캔).
  const tryNavigate = React.useCallback(
    (text: string): boolean => {
      let pathname: string | null = null;
      try {
        pathname = new URL(text).pathname;
      } catch {
        if (text.startsWith("/")) pathname = text.split(/[?#]/)[0];
      }
      if (!pathname || !ENTRY_PATH_RE.test(pathname)) return false;
      doneRef.current = true;
      stop();
      router.push(pathname);
      return true;
    },
    [router, stop],
  );

  const start = React.useCallback(async () => {
    doneRef.current = false;
    setStatus("starting");
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("error");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      video.srcObject = stream;
      await video.play().catch(() => {});
      setStatus("scanning");

      // rAF 디코드 루프 — 호이스팅 함수 선언으로 자기참조(useCallback 자기참조 회피).
      // 성능: 긴 변 ~1024 로 축소 후 디코드(구형 폰 메인스레드 부담 완화).
      function loop() {
        if (doneRef.current) return;
        const v = videoRef.current;
        const canvas = canvasRef.current;
        if (v && canvas && v.readyState >= v.HAVE_ENOUGH_DATA && v.videoWidth) {
          const maxEdge = 1024;
          const scale = Math.min(
            1,
            maxEdge / Math.max(v.videoWidth, v.videoHeight),
          );
          const w = Math.round(v.videoWidth * scale);
          const h = Math.round(v.videoHeight * scale);
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d", { willReadFrequently: true });
          if (ctx) {
            ctx.drawImage(v, 0, 0, w, h);
            const img = ctx.getImageData(0, 0, w, h);
            const code = jsQR(img.data, w, h, {
              inversionAttempts: "dontInvert",
            });
            if (code?.data && tryNavigate(code.data)) return;
          }
        }
        rafRef.current = requestAnimationFrame(loop);
      }
      rafRef.current = requestAnimationFrame(loop);
    } catch (e) {
      const name = (e as DOMException)?.name;
      setStatus(
        name === "NotAllowedError" || name === "SecurityError"
          ? "denied"
          : "error",
      );
    }
  }, [tryNavigate]);

  React.useEffect(() => {
    let mounted = true;
    // 마이크로태스크로 시작(이펙트 본문 동기 setState 회피).
    queueMicrotask(() => {
      if (mounted) void start();
    });
    return () => {
      mounted = false;
      stop();
    };
  }, [start, stop]);

  const blocked = status === "denied" || status === "error";

  return (
    <div className="relative flex min-h-dvh flex-col bg-black">
      {/* 카메라 — 항상 마운트(ref 안정 → 재시도 정상) */}
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        className="absolute inset-0 size-full object-cover"
      />

      {/* 스캔 오버레이 — 프레임 + 안내 */}
      {!blocked ? (
        <div className="pointer-events-none absolute inset-0">
          <h1 className="absolute inset-x-0 top-12 text-center text-lg font-bold text-white drop-shadow">
            {labels.title}
          </h1>
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-5">
            <div className="size-56 rounded-3xl border-2 border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" />
            <p className="max-w-xs text-pretty px-6 text-center text-sm font-medium text-white drop-shadow">
              {status === "starting" ? labels.preparing : labels.hint}
            </p>
          </div>
        </div>
      ) : null}

      {/* 권한 거부 / 에러 — 안내 + 재시도 */}
      {blocked ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 bg-background px-6 text-center">
          <p className="max-w-xs text-pretty text-sm leading-relaxed text-muted-foreground">
            {status === "denied" ? labels.denied : labels.error}
          </p>
          <Button variant="accent" size="lg" onClick={() => void start()}>
            {labels.retry}
          </Button>
        </div>
      ) : null}

      {/* 뒤로(홈) — 항상 */}
      <Link
        href={homeHref}
        onClick={stop}
        className="absolute left-3 top-3 z-10 inline-flex items-center rounded-full bg-foreground/55 px-3 py-1.5 text-sm font-medium text-card outline-none backdrop-blur-sm focus-visible:ring-2 focus-visible:ring-ring"
      >
        {labels.back}
      </Link>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
