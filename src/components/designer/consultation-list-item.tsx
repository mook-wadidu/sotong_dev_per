import Link from "next/link";
import { Badge } from "@/components/ui";
import { StatusBadge } from "./status-badge";
import { Elapsed } from "./elapsed";
import { designerSummaryPath } from "@/lib/links";
import type { ConsultationListItem as Item } from "@/lib/db/types";
import type { ConsultationStatus } from "@/lib/domain/types";

/**
 * 인박스 한 줄 — 상태 Badge + 국적/신규·재방문 + headline + 경과시간.
 * 전체가 요약(D2)으로 가는 링크. ko 고정.
 */
export function ConsultationListItem({
  item,
  statusLabel,
  visitLabel,
}: {
  item: Item;
  /** ConsultationStatus → ko 라벨 */
  statusLabel: (status: ConsultationStatus) => string;
  /** 신규/재방문 라벨 */
  visitLabel: string;
}) {
  return (
    <Link
      href={designerSummaryPath(item.designerToken)}
      className="flex w-full items-center gap-3 rounded-xl border border-border bg-card px-4 py-3.5 text-left outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.99]"
    >
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusBadge status={item.status} label={statusLabel(item.status)} />
          <Badge variant="outline">{item.nationality}</Badge>
          <Badge variant={item.isReturning ? "default" : "accent"}>
            {visitLabel}
          </Badge>
        </div>
        <p className="truncate text-sm font-medium text-foreground">
          {item.headline}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1 text-xs text-muted-foreground">
        <Elapsed iso={item.createdAt} />
        <span aria-hidden="true" className="text-base leading-none">
          ›
        </span>
      </div>
    </Link>
  );
}
