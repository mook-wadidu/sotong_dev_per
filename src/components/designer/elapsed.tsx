"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

/**
 * "N분 전" 경과 표시 — 클라이언트에서 계산(하이드레이션 안전) + 자체 i18n.
 * (서버→클라로 함수 prop 을 넘기지 않도록 포맷을 컴포넌트 내부에서 처리)
 */
export function Elapsed({ iso }: { iso: string }) {
  const t = useTranslations("Designer");
  const target = React.useMemo(() => new Date(iso).getTime(), [iso]);
  const [minutes, setMinutes] = React.useState<number | null>(null);

  React.useEffect(() => {
    const tick = () =>
      setMinutes(Math.max(0, Math.floor((Date.now() - target) / 60_000)));
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [target]);

  return (
    <span suppressHydrationWarning>
      {minutes === null ? "" : t("inbox.elapsed", { minutes })}
    </span>
  );
}
