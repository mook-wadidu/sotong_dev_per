"use client";

import { Toaster as SonnerToaster } from "sonner";

/**
 * 전역 토스트 호스트. layout.tsx body 에 한 번 마운트한다.
 * Phase 3 흑백 — richColors(유채 success/error) 미사용.
 * 색이 빠진 만큼 **형태가 다른 아이콘**(성공=체크 / 오류=느낌표 / 경고=삼각 / 정보=i)으로
 * 의미를 구분해, 전송 실패를 성공으로 오인하는 일(AUDIT UX P1)을 막는다.
 * 디자인 토큰을 sonner CSS 변수로 매핑해 톤을 통일.
 */
export function Toaster() {
  return (
    <SonnerToaster
      position="top-center"
      offset={16}
      icons={{
        success: <CheckCircleGlyph />,
        error: <ErrorGlyph />,
        warning: <WarningGlyph />,
        info: <InfoGlyph />,
      }}
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

const glyphProps = {
  viewBox: "0 0 24 24",
  fill: "none" as const,
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  className: "size-5",
  "aria-hidden": true,
};

/** 성공 — 채운 원 + 체크(가장 또렷한 긍정 신호) */
function CheckCircleGlyph() {
  return (
    <svg {...glyphProps} fill="currentColor" stroke="none">
      <circle cx="12" cy="12" r="9" />
      <path
        d="M8 12.5 11 15.5 16.5 9"
        fill="none"
        stroke="var(--card)"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** 오류 — 채운 원 + 느낌표(성공과 형태가 명확히 다름) */
function ErrorGlyph() {
  return (
    <svg {...glyphProps} fill="currentColor" stroke="none">
      <circle cx="12" cy="12" r="9" />
      <path
        d="M12 7.5v6"
        fill="none"
        stroke="var(--card)"
        strokeWidth={2.2}
        strokeLinecap="round"
      />
      <circle cx="12" cy="16.6" r="1.1" fill="var(--card)" />
    </svg>
  );
}

/** 경고 — 삼각형 + 느낌표 */
function WarningGlyph() {
  return (
    <svg {...glyphProps}>
      <path d="M12 4.5 21 19.5H3L12 4.5Z" />
      <path d="M12 10v4" />
      <circle cx="12" cy="16.7" r="0.7" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** 정보 — 원 + i */
function InfoGlyph() {
  return (
    <svg {...glyphProps}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" />
      <circle cx="12" cy="8" r="0.7" fill="currentColor" stroke="none" />
    </svg>
  );
}

export { toast } from "sonner";
