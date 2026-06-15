"use client";

import { Toaster as SonnerToaster } from "sonner";

/**
 * 전역 토스트 호스트. layout.tsx body 에 한 번 마운트한다.
 * Phase 3 흑백 — richColors(유채 success/error) 미사용. 의미는 토스트 텍스트가 전달.
 * 디자인 토큰을 sonner CSS 변수로 매핑해 톤을 통일.
 */
export function Toaster() {
  return (
    <SonnerToaster
      position="top-center"
      offset={16}
      toastOptions={{
        style: {
          borderRadius: "var(--radius)",
          fontFamily: "var(--font-sans)",
        },
      }}
      style={
        {
          "--normal-bg": "var(--card)",
          "--normal-text": "var(--card-foreground)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
    />
  );
}

export { toast } from "sonner";
