import { MobileFrame, ScreenBody, Skeleton } from "@/components/ui";

/** 진입 로딩 스켈레톤 — getSalonByEntry 대기 중 흰 화면 대신(J). */
export default function Loading() {
  return (
    <MobileFrame tone="muted">
      <ScreenBody className="flex flex-col items-center justify-center gap-5 py-16">
        <Skeleton className="size-14 rounded-full" />
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-4 w-2/3" />
        <div className="mt-4 grid w-full grid-cols-2 gap-3">
          <Skeleton className="h-12 rounded-xl" />
          <Skeleton className="h-12 rounded-xl" />
          <Skeleton className="h-12 rounded-xl" />
          <Skeleton className="h-12 rounded-xl" />
        </div>
      </ScreenBody>
    </MobileFrame>
  );
}
