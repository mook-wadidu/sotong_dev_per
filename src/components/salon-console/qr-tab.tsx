"use client";

import { useTranslations } from "next-intl";
import { SalonQR } from "@/components/admin/salon-qr";
import type { Designer } from "@/lib/db/types";
import type { SalonConsole as SalonConsoleData } from "@/lib/actions";

type DesignerEntry = SalonConsoleData["designerEntries"][number];

/**
 * 콘솔 QR 탭 — 디자이너별 QR + 살롱 공용 QR.
 * 어드민 QR 탭과 동일 패턴(SalonQR 재사용, 서버 origin + entryPath 절대 URL).
 */
export function ConsoleQrTab({
  origin,
  salonName,
  placement,
  designers,
  designerEntries,
  salonEntryPath,
}: {
  origin: string;
  salonName: string;
  placement?: string;
  designers: Designer[];
  designerEntries: DesignerEntry[];
  salonEntryPath: string;
}) {
  const t = useTranslations("Admin");
  const qrLabels = {
    copy: t("qr.copy"),
    copied: t("qr.copied"),
    print: t("qr.print"),
  };
  const entryById = new Map(designerEntries.map((e) => [e.id, e]));

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="border-b border-border pb-3">
        <h3 className="font-semibold leading-tight">{salonName}</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {t("console.qr.hint")}
        </p>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {designers.map((d) => {
          const entry = entryById.get(d.id);
          if (!entry) return null;
          return (
            <div key={d.id} className="flex flex-col gap-2">
              <p className="text-center text-sm font-medium text-foreground">
                {d.name}
              </p>
              <SalonQR
                entryUrl={origin ? origin + entry.entryPath : entry.entryPath}
                entryPath={entry.entryPath}
                salonName={`${salonName} · ${d.name}`}
                placement={placement}
                labels={qrLabels}
              />
            </div>
          );
        })}
        <div className="flex flex-col gap-2">
          <p className="text-center text-sm font-medium text-accent-text">
            {t("qr.sharedLabel")}
          </p>
          <SalonQR
            entryUrl={origin ? origin + salonEntryPath : salonEntryPath}
            entryPath={salonEntryPath}
            salonName={`${salonName} · ${t("qr.sharedLabel")}`}
            placement={placement}
            labels={qrLabels}
          />
        </div>
      </div>
    </section>
  );
}
