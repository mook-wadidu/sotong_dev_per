"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "@/components/ui";
import { setDesignerActive } from "@/lib/actions";

/**
 * 디자이너 활성/비활성 토글(어드민) — 낙관적 아님(서버 확정 후 refresh).
 */
export function DesignerActiveToggle({
  designerId,
  active,
}: {
  designerId: string;
  active: boolean;
}) {
  const t = useTranslations("Admin");
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  const onToggle = async () => {
    setPending(true);
    const res = await setDesignerActive(designerId, !active);
    setPending(false);
    if (res.ok) router.refresh();
    else toast.error(res.error);
  };

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={pending}
      aria-pressed={active}
      className={
        active
          ? "inline-flex h-7 items-center rounded-lg border border-border bg-card px-2.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
          : "inline-flex h-7 items-center rounded-lg border border-dashed border-border px-2.5 text-xs font-medium text-muted-foreground hover:bg-muted disabled:opacity-50"
      }
    >
      {active ? t("designers.deactivate") : t("designers.activate")}
    </button>
  );
}
