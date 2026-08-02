"use client";

import { Button, toast } from "@/components/ui";

/**
 * 손님 개인 링크("내 링크") 표시 + 복사 — present 화면 재진입용.
 * 손님이 이 URL 을 저장하면 **어느 기기에서든** 자기 상담(완료 전 제시-QR / 완료 후 리포트)에
 * 재접근한다(쿠키 앵커 sotong_did 는 같은 기기만 → 기기 무관 재진입엔 이 URL 이 필요).
 * 핸드오프 QR 과 별개: QR=직원 스캔용 **단수명**, 이 링크=손님 저장용 **장수명**.
 */
export function CopyLink({
  value,
  copyLabel,
  copiedMsg,
}: {
  value: string;
  copyLabel: string;
  copiedMsg: string;
}) {
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(copiedMsg);
    } catch {
      /* 클립보드 접근 불가 — 손님이 주소창에서 직접 복사할 수 있어 무시 */
    }
  };
  return (
    <div className="flex w-full items-center gap-2 rounded-xl border border-border bg-card px-3 py-2">
      <span className="min-w-0 flex-1 truncate text-left text-xs text-muted-foreground">
        {value}
      </span>
      <Button type="button" variant="outline" size="sm" onClick={onCopy}>
        {copyLabel}
      </Button>
    </div>
  );
}
