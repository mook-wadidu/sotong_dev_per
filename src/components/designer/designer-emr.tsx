"use client";

import { useTranslations } from "next-intl";
import { Badge, Card, CardContent, Divider } from "@/components/ui";
import { CareIcon, ChatIcon, PhotoIcon } from "@/components/icons";
import { serviceLabels } from "@/lib/catalog";
import { messageMainText } from "@/lib/domain/render";
import type {
  LocalizedText,
  Message,
  ThreeLevel,
  TreatmentRecord,
} from "@/lib/domain/types";

/** 디자이너 뷰 고정 로케일(요약/EMR 은 ko). */
const VIEWER = "ko" as const;

/**
 * 완료 상담 EMR(종합 전자차트) — 읽기 전용.
 * 시술 기록(serviceLabelMap 로 라벨화·약제·모발상태·만족도·메모) + 시술 전 사진 +
 * 대화 하이라이트(마지막 몇 개). 디자이너 인박스/오너 콘솔/플랫폼 어드민 어디서나 동일.
 */
export function DesignerEmr({
  record,
  serviceLabelMap,
  messages,
  beforePhotoUrl,
}: {
  record?: TreatmentRecord;
  serviceLabelMap: Record<string, LocalizedText>;
  messages: Message[];
  beforePhotoUrl?: string;
}) {
  const t = useTranslations("Designer");

  const gradeLabel = (g?: ThreeLevel): string | undefined => {
    if (!g) return undefined;
    return t(`emr.grade.${g}`);
  };

  // 시술 serviceId 라벨화 — 살롱 라벨맵 우선, 없으면 전역 카탈로그, 그래도 없으면 raw id.
  const services = (record?.serviceIds ?? []).map((id) => {
    const loc = serviceLabelMap[id];
    if (loc) return loc[VIEWER] ?? loc.ko;
    return serviceLabels([id], VIEWER)[0] ?? id;
  });

  // 대화 하이라이트 — 시스템 메시지를 제외한 마지막 몇 개(최대 5).
  const highlights = messages.filter((m) => m.sender !== "system").slice(-5);

  const grade = gradeLabel(record?.stateGrade);

  return (
    <div className="space-y-4">
      {/* 시술 기록 카드 */}
      {record ? (
        <Card>
          <CardContent className="space-y-3 p-4">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <CareIcon className="size-4" />
              {t("emr.recordTitle")}
            </p>
            <dl className="space-y-2 text-sm">
              <EmrRow label={t("emr.services")}>
                {services.length ? services.join(", ") : t("emr.none")}
              </EmrRow>
              <EmrRow label={t("emr.products")}>
                {record.products.length
                  ? record.products.join(", ")
                  : t("emr.none")}
              </EmrRow>
              <EmrRow label={t("emr.stateGrade")}>
                {grade ?? t("emr.none")}
              </EmrRow>
              <EmrRow label={t("emr.satisfaction")}>
                {typeof record.satisfactionScore === "number" ? (
                  <Badge variant="success">
                    {t("emr.satisfactionScore", {
                      score: record.satisfactionScore,
                    })}
                  </Badge>
                ) : (
                  t("emr.none")
                )}
              </EmrRow>
              {record.note?.trim() ? (
                <EmrRow label={t("emr.note")}>
                  <span className="whitespace-pre-wrap">{record.note}</span>
                </EmrRow>
              ) : null}
            </dl>
          </CardContent>
        </Card>
      ) : null}

      {/* 시술 전 사진 — 리포트 after 는 treatmentRecord 에 없으므로 가능한 소스(before)만 노출. */}
      {beforePhotoUrl ? (
        <div className="space-y-2">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <PhotoIcon className="size-4" />
            {t("emr.beforePhoto")}
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={beforePhotoUrl}
            alt={t("emr.beforePhoto")}
            className="aspect-[3/4] w-40 rounded-xl border border-border object-cover"
          />
        </div>
      ) : null}

      {/* 대화 하이라이트 — 마지막 몇 개(ko 번역문). */}
      {highlights.length > 0 ? (
        <Card>
          <CardContent className="space-y-3 p-4">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <ChatIcon className="size-4" />
              {t("emr.conversation")}
            </p>
            <ul className="space-y-2.5">
              {highlights.map((m, i) => (
                <li key={m.id} className="space-y-1">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {m.sender === "customer"
                      ? t("emr.senderCustomer")
                      : t("emr.senderDesigner")}
                  </p>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                    {messageMainText(m, VIEWER)}
                  </p>
                  {i < highlights.length - 1 ? <Divider /> : null}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function EmrRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <dt className="w-20 shrink-0 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="min-w-0 flex-1 text-foreground">{children}</dd>
    </div>
  );
}
