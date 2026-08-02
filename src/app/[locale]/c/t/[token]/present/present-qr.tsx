"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui";

/**
 * 제시 화면의 QR + "다시 표시" 버튼 (클라이언트 경계).
 * QRCodeSVG 가 useMemo 를 쓰므로 서버 컴포넌트에서 직접 렌더 불가 → 여기서 렌더한다.
 * value(핸드오프 절대 URL)는 서버가 매 로드마다 새 토큰으로 계산해 내려준다.
 * "다시 표시"는 router.refresh() 로 서버 재렌더 → 새(연장된) 토큰 QR 을 받는다.
 */
export function PresentQr({
  value,
  reshowLabel,
}: {
  value: string;
  reshowLabel: string;
}) {
  const router = useRouter();
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="rounded-2xl border border-border bg-white p-4">
        <QRCodeSVG value={value} size={224} level="M" marginSize={0} />
      </div>
      <Button
        variant="outline"
        size="lg"
        className="w-full"
        onClick={() => router.refresh()}
      >
        {reshowLabel}
      </Button>
    </div>
  );
}
