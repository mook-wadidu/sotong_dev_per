import { MobileFrame, ScreenBody, Skeleton } from "@/components/ui";

/** 스레드 로딩 스켈레톤 — getCustomerView 대기 중 흰 화면 대신(J). */
export default function Loading() {
  return (
    <MobileFrame tone="muted">
      <ScreenBody className="space-y-4 py-8">
        <Skeleton className="h-7 w-1/2" />
        <div className="space-y-3 pt-4">
          <Skeleton className="h-12 w-3/4 rounded-2xl" />
          <Skeleton className="ml-auto h-12 w-2/3 rounded-2xl" />
          <Skeleton className="h-12 w-3/5 rounded-2xl" />
        </div>
      </ScreenBody>
    </MobileFrame>
  );
}
