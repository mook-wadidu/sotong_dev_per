import { MobileFrame, ScreenBody, Skeleton } from "@/components/ui";

/** 리포트 로딩 스켈레톤 — getReportView 대기 중 흰 화면 대신(J). */
export default function Loading() {
  return (
    <MobileFrame tone="muted">
      <ScreenBody className="space-y-4 py-8">
        <Skeleton className="h-44 w-full rounded-2xl" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </ScreenBody>
    </MobileFrame>
  );
}
