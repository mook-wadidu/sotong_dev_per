import Link from "next/link";
import { designerInboxPath } from "@/lib/links";

/**
 * D2/D3/D5 → 인박스 복귀(P1). PWA standalone 데드엔드 해소.
 * getDesignerView 가 함께 내려준 배정 디자이너 staffToken 으로만 동작하며,
 * 미배정(staffToken 없음)이면 렌더하지 않는다(인박스 비밀 토큰 보호).
 * ScreenHeader 의 leading 슬롯에 둔다.
 */
export function BackToInbox({
  staffToken,
  label,
}: {
  staffToken?: string;
  label: string;
}) {
  if (!staffToken) return null;
  return (
    <Link
      href={designerInboxPath(staffToken)}
      aria-label={label}
      className="inline-flex h-9 items-center gap-1 rounded-full px-2.5 text-sm font-medium text-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-4"
        aria-hidden="true"
      >
        <path d="M15 5 8 12l7 7" />
      </svg>
      <span>{label}</span>
    </Link>
  );
}
