"use client";

import { useRouter } from "next/navigation";

/**
 * 리포트 등 막다른 화면용 '뒤로' — 직전 화면이 있으면 router.back(), 없으면(새 탭/저장링크) 홈.
 * 손님·디자이너 공통. ScreenHeader 의 leading 슬롯에 둔다.
 */
export function BackButton({
  label,
  homeHref,
}: {
  label: string;
  homeHref: string;
}) {
  const router = useRouter();
  const onBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push(homeHref);
    }
  };
  return (
    <button
      type="button"
      onClick={onBack}
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
    </button>
  );
}
