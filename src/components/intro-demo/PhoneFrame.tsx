import { cn } from "@/lib/utils";

/**
 * 재사용 폰 목업 프레임. 손님/디자이너 화면을 children으로 받습니다.
 * label: 프레임 상단 라벨 (예: "손님 화면", "디자이너 화면")
 */
export default function PhoneFrame({
  label,
  tone = "brand",
  time = "9:41",
  className,
  children,
}: {
  label?: string;
  tone?: "brand" | "accent";
  time?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col items-center", className)}>
      {label && (
        <span
          className={cn(
            "mb-3 rounded-full px-3 py-1 text-xs font-semibold",
            tone === "brand"
              ? "bg-brand-50 text-brand-600"
              : "bg-accent-50 text-accent-600"
          )}
        >
          {label}
        </span>
      )}
      <div className="relative w-[264px] rounded-[2.5rem] bg-ink-900 p-2.5 shadow-[var(--shadow-phone)]">
        {/* 노치 */}
        <div className="absolute left-1/2 top-2.5 z-20 h-5 w-28 -translate-x-1/2 rounded-b-2xl bg-ink-900" />
        <div className="relative h-[520px] overflow-hidden rounded-[2rem] bg-white">
          {/* 상태바 */}
          <div className="relative z-10 flex items-center justify-between px-6 pt-3 text-[11px] font-semibold text-ink-700">
            <span>{time}</span>
            <span className="flex items-center gap-1">
              <span className="tracking-tighter">••••</span>
              <span>􀛨</span>
            </span>
          </div>
          <div className="relative h-[calc(520px-2rem)]">{children}</div>
        </div>
      </div>
    </div>
  );
}
