"use client";

import * as React from "react";
import { QRCodeSVG } from "qrcode.react";
import { Button, toast } from "@/components/ui";

/**
 * 어드민 QR 카드용 위젯.
 * - entryUrl(서버가 요청 Host 로 만든 절대 URL)을 그대로 QRCodeSVG 에 넣는다.
 *   → JS 없이 SSR 로 렌더되고, 어드민이 연 호스트(LAN IP)를 정확히 인코딩한다.
 * - 링크 복사(navigator.clipboard) + 인쇄(QR 만 담은 새 창 print)는 클라이언트.
 */
export function SalonQR({
  entryUrl,
  entryPath,
  salonName,
  placement,
  labels,
}: {
  /** 서버에서 만든 절대 URL (Host 기반) */
  entryUrl: string;
  /** 인쇄 DOM id 용 (상대경로) */
  entryPath: string;
  salonName: string;
  placement?: string;
  labels: {
    copy: string;
    copied: string;
    print: string;
  };
}) {
  const url = entryUrl;
  const [copied, setCopied] = React.useState(false);

  const onCopy = React.useCallback(async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success(labels.copied);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error(labels.copy);
    }
  }, [url, labels]);

  const onPrint = React.useCallback(() => {
    if (!url) return;
    const win = window.open("", "_blank", "width=480,height=640");
    if (!win) return;
    const safeName = salonName.replace(/[<>&"]/g, "");
    const safePlacement = (placement ?? "").replace(/[<>&"]/g, "");
    const safeUrl = url.replace(/[<>&"]/g, "");
    win.document.write(
      `<!doctype html><html><head><meta charset="utf-8"><title>${safeName} QR</title>` +
        `<style>` +
        `*{box-sizing:border-box}` +
        `body{margin:0;padding:48px;font-family:system-ui,-apple-system,sans-serif;` +
        `display:flex;flex-direction:column;align-items:center;justify-content:center;` +
        `min-height:100vh;text-align:center;color:#111111}` +
        `h1{font-size:24px;margin:0 0 4px}` +
        `p{font-size:14px;color:#6b7280;margin:0 0 24px}` +
        `.qr{padding:20px;border:1px solid #e4e4e7;border-radius:16px;background:#fff}` +
        `.url{font-size:11px;color:#6b7280;margin-top:20px;word-break:break-all;max-width:320px}` +
        `</style></head><body>` +
        `<h1>${safeName}</h1>` +
        (safePlacement ? `<p>${safePlacement}</p>` : "") +
        `<div class="qr"></div>` +
        `<div class="url">${safeUrl}</div>` +
        `</body></html>`,
    );
    // QR SVG 를 직렬화해 인쇄 창에 주입
    const source = document.getElementById(`qr-${entryPath}`);
    const holder = win.document.querySelector(".qr");
    if (source && holder) {
      holder.innerHTML = source.outerHTML;
    }
    win.document.close();
    win.focus();
    win.setTimeout(() => {
      win.print();
    }, 250);
  }, [url, salonName, placement, entryPath]);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="rounded-xl border border-border bg-white p-3">
        {url ? (
          <QRCodeSVG
            id={`qr-${entryPath}`}
            value={url}
            size={148}
            level="M"
            marginSize={0}
          />
        ) : (
          <div className="size-[148px] animate-pulse rounded-lg bg-muted" />
        )}
      </div>
      <div className="flex w-full gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={onCopy}
          disabled={!url}
          aria-label={`${salonName} ${labels.copy}`}
        >
          {copied ? labels.copied : labels.copy}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={onPrint}
          disabled={!url}
          aria-label={`${salonName} ${labels.print}`}
        >
          {labels.print}
        </Button>
      </div>
    </div>
  );
}
