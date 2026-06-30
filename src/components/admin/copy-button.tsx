"use client";

import { useTranslations } from "next-intl";
import { Button, toast } from "@/components/ui";

/**
 * 값 복사 버튼(어드민/콘솔 공용). 디자이너 토큰 등 짧은 값을 클립보드로.
 * 라벨은 호출부가 주고, 성공/실패 토스트는 Admin.qr.* 재사용.
 */
export function CopyButton({ value, label }: { value: string; label: string }) {
  const t = useTranslations("Admin");
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(t("qr.copied"));
    } catch {
      toast.error(t("qr.copy"));
    }
  };
  return (
    <Button type="button" variant="ghost" size="sm" onClick={onCopy}>
      {label}
    </Button>
  );
}
