"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import {
  Button,
  Input,
  ToggleGroup,
  RadioGroup,
  Spinner,
  SectionLabel,
  Checkbox,
  toast,
  buttonVariants,
} from "@/components/ui";
import { COLOR_TONES } from "@/lib/catalog";
import { finishAndSendReport } from "@/lib/actions";
import { designerReportViewPath, reportPath } from "@/lib/links";
import { resizeToDataUrl } from "@/lib/image";
import { cn } from "@/lib/utils";
import type { Locale, ThreeLevel } from "@/lib/domain/types";

type Labels = {
  colorResult: string;
  colorResultHint: string;
  salonName: string;
  salonNameHint: string;
  stateGrade: string;
  beforePhoto: string;
  afterPhoto: string;
  addPhoto: string;
  removePhoto: string;
  finish: string;
  finishing: string;
  sent: string;
  failed: string;
  needInput: string;
  /** 비포/애프터 2장 필수(PRD NOW #4) — 누락 시 안내. */
  needPhotos: string;
  /** 재방문 프리필 안내 배지. */
  prefillHint: string;
  /** 재방문 프리필 비우기. */
  prefillClear: string;
  openReport: string;
  gradeHigh: string;
  gradeMid: string;
  gradeLow: string;
  /** 인체어 손님 리포트 QR 안내(B7). */
  reportQrTitle: string;
  reportQrHint: string;
};


export function RecordForm({
  token,
  beforeUrl,
  defaultGrade,
  serviceOptions,
  customerReportOrigin,
  customerLocale,
  labels,
}: {
  token: string;
  /** 요약 단계에서 미리 촬영한 비포 사진(있으면 프리필, 교체 가능). */
  beforeUrl?: string;
  /** 재방문 손님의 지난 모발 상태 등급. */
  defaultGrade?: ThreeLevel;
  /** 실제 시술 선택지(살롱 메뉴 id + ko 라벨) — 디자이너가 실제 한 시술 기록(학습 정답). */
  serviceOptions?: { value: string; label: string }[];
  /** 손님 리포트 QR 용 절대 origin(서버 Host 기반). */
  customerReportOrigin: string;
  /** 손님 언어 — QR 이 가리키는 리포트 URL 로케일. */
  customerLocale: Locale;
  labels: Labels;
}) {
  const router = useRouter();
  const [serviceIds, setServiceIds] = React.useState<string[]>([]);
  // 색감(컬러 결과) — 다중 선택 톤. 손님 리포트에 ko 라벨을 ", "로 이어 표기.
  const [colorTones, setColorTones] = React.useState<string[]>([]);
  // 실매장명 — 있으면 DB 살롱명 대신 손님 리포트에 표기(수동 입력).
  const [salonDisplayName, setSalonDisplayName] = React.useState("");
  const [grade, setGrade] = React.useState<ThreeLevel | null>(
    defaultGrade ?? null,
  );
  // 비포는 요약 단계 촬영분으로 프리필(교체 가능), 애프터는 기록폼에서 촬영. 사진은 선택(#5).
  const [beforePhoto, setBeforePhoto] = React.useState<string | undefined>(
    beforeUrl,
  );
  const [afterUrl, setAfterUrl] = React.useState<string | undefined>();
  // 사진 2장 미만이어도 "사진 없이 기록"을 명시 선택하면 발송 가능(무심코 스킵 방지 — #5 의도적 선택).
  const [skipPhotosAck, setSkipPhotosAck] = React.useState(false);
  // 재방문 프리필 안내 — 프리필이 있을 때만 노출, '비우기'로 초기화.
  const hasPrefill = defaultGrade != null;
  const [prefillCleared, setPrefillCleared] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [reportToken, setReportToken] = React.useState<string | undefined>();
  // 손님용 reportToken(디자이너 링크 토큰과 별개) — 인체어 QR 이 가리키는 손님 리포트.
  const [customerReportToken, setCustomerReportToken] = React.useState<
    string | undefined
  >();

  const colorToneOptions = COLOR_TONES.map((c) => ({
    value: c.id,
    label: c.label.ko,
  }));

  const gradeOptions = [
    { value: "high" as const, label: labels.gradeHigh },
    { value: "mid" as const, label: labels.gradeMid },
    { value: "low" as const, label: labels.gradeLow },
  ];

  const onPhoto = async (
    e: React.ChangeEvent<HTMLInputElement>,
    set: (url: string) => void,
  ) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      set(await resizeToDataUrl(file));
    } catch {
      toast.error("사진을 불러오지 못했어요. 다른 사진으로 다시 시도해 주세요.");
    }
  };

  const clearPrefill = () => {
    setGrade(null);
    setPrefillCleared(true);
  };

  // 사진 선택화(#5): 2장 다 있거나, "사진 없이 기록"을 명시 선택하면 발송 가능.
  // 사진 유무는 서버에서 has_before/after_photo 로 기록(H4 촬영습관 측정).
  const bothPhotos = Boolean(beforePhoto) && Boolean(afterUrl);
  const canSubmit = bothPhotos || skipPhotosAck;

  const submit = () => {
    if (!canSubmit) {
      toast.error(labels.needPhotos);
      return;
    }
    startTransition(async () => {
      try {
        const res = await finishAndSendReport({
          designerToken: token,
          record: {
            // 색감 — 선택 톤의 ko 라벨을 ", "로 이어 손님 리포트에 표기(없으면 미표기).
            colorResult: colorTones.length
              ? colorTones
                  .map((id) => COLOR_TONES.find((c) => c.id === id)?.label.ko)
                  .filter((l): l is string => Boolean(l))
                  .join(", ")
              : undefined,
            // 실매장명 — 비면 미전송(리포트가 DB 살롱명으로 폴백).
            salonDisplayName: salonDisplayName.trim() || undefined,
            stateGrade: grade ?? undefined,
            // 만족도는 디자이너가 추정하지 않는다 — 손님이 리포트에서 별점으로 직접 입력(#4b).
            // 실제 한 시술(있으면) → 학습 'actual'. 없으면 서버가 손님 분류로 폴백(intent 태그).
            serviceIds: serviceIds.length ? serviceIds : undefined,
          },
          // 사진은 선택 — 있으면 전송(서버가 유무를 has_before/after_photo 로 기록).
          beforePhotoUrl: beforePhoto,
          afterPhotoUrl: afterUrl,
        });
        if (!res) {
          toast.error(labels.failed);
          return;
        }
        // 디자이너는 ko 리포트를 본다 — designerReportToken(비-ko 손님) 우선, 없으면 손님 토큰.
        setReportToken(res.designerReportToken ?? res.reportToken);
        setCustomerReportToken(res.reportToken); // 손님용 — 인체어 QR
        toast.success(labels.sent);
        router.refresh();
      } catch {
        toast.error(labels.failed);
      }
    });
  };

  // 발송 완료 → 인체어 손님 리포트 QR + 디자이너 리포트 링크
  if (reportToken) {
    const customerReportUrl = customerReportToken
      ? `${customerReportOrigin}${reportPath(customerReportToken, customerLocale)}`
      : undefined;
    return (
      <div className="space-y-5 py-6 text-center">
        <p className="text-base font-semibold text-foreground">
          {labels.sent}
        </p>
        {/* 인체어 전달(B7) — 손님이 폰으로 이 QR 을 스캔하면 리포트가 손님 폰에. 폴링 의존 제거. */}
        {customerReportUrl ? (
          <div className="flex flex-col items-center gap-2">
            <p className="text-sm font-semibold text-foreground">
              {labels.reportQrTitle}
            </p>
            <div className="rounded-xl border border-border bg-white p-3">
              <QRCodeSVG
                value={customerReportUrl}
                size={200}
                level="M"
                marginSize={0}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {labels.reportQrHint}
            </p>
          </div>
        ) : null}
        <Link
          href={designerReportViewPath(reportToken)}
          className={cn(
            buttonVariants({ variant: "accent", size: "lg" }),
            "w-full",
          )}
        >
          {labels.openReport}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 재방문 프리필 안내 — 지난 시술 기본값. 같으면 사진만 찍고 발송. */}
      {hasPrefill && !prefillCleared ? (
        <div className="flex items-center justify-between gap-2 rounded-lg bg-accent-soft px-3 py-2">
          <span className="text-sm text-accent-text">{labels.prefillHint}</span>
          <button
            type="button"
            onClick={clearPrefill}
            className="shrink-0 text-sm font-medium text-accent-text underline underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {labels.prefillClear}
          </button>
        </div>
      ) : null}

      {/* 실제 시술 (살롱 메뉴) — 손님 분류를 보고 실제 한 시술 확정(학습 정답) */}
      {serviceOptions && serviceOptions.length > 0 ? (
        <section>
          <SectionLabel>실제 시술</SectionLabel>
          <p className="mb-2.5 text-xs text-muted-foreground">
            손님이 고른 분류를 보고, 실제로 한 시술을 골라주세요.
          </p>
          <ToggleGroup
            options={serviceOptions}
            value={serviceIds}
            onValueChange={setServiceIds}
            label="실제 시술"
          />
        </section>
      ) : null}

      {/* 색감 (컬러 결과, 다중) — 손님 리포트에 표기 */}
      <section>
        <SectionLabel>{labels.colorResult}</SectionLabel>
        <p className="mb-2.5 text-xs text-muted-foreground">
          {labels.colorResultHint}
        </p>
        <ToggleGroup
          options={colorToneOptions}
          value={colorTones}
          onValueChange={setColorTones}
          label={labels.colorResult}
        />
      </section>

      {/* 실매장명 (수동입력) — 있으면 DB 살롱명 대신 손님 리포트에 표기 */}
      <section>
        <SectionLabel>{labels.salonName}</SectionLabel>
        <p className="mb-2.5 text-xs text-muted-foreground">
          {labels.salonNameHint}
        </p>
        <Input
          value={salonDisplayName}
          onChange={(e) => setSalonDisplayName(e.target.value)}
          className="h-11"
        />
      </section>

      {/* 모발 상태 (단일: 상/중/하) */}
      <section>
        <SectionLabel>{labels.stateGrade}</SectionLabel>
        <RadioGroup
          options={gradeOptions}
          value={grade}
          onValueChange={setGrade}
          label={labels.stateGrade}
          variant="grid"
        />
      </section>

      {/* 비포·애프터 사진 — 선택(권장). 비포는 요약 단계 촬영분 프리필. 2장 미만이면 의도적 체크 필요(#5). */}
      <section>
        <SectionLabel>비포 · 애프터 사진 (선택)</SectionLabel>
        <p className="mb-2.5 text-xs text-muted-foreground">
          남기면 재방문 상담·결과 비교와 학습 데이터 정확도에 큰 도움이 돼요.
        </p>
        <div className="grid max-w-sm grid-cols-2 gap-3">
          <PhotoSlot
            label={labels.beforePhoto}
            addLabel={labels.addPhoto}
            removeLabel={labels.removePhoto}
            url={beforePhoto}
            onPick={(e) => onPhoto(e, setBeforePhoto)}
            onRemove={() => setBeforePhoto(undefined)}
          />
          <PhotoSlot
            label={labels.afterPhoto}
            addLabel={labels.addPhoto}
            removeLabel={labels.removePhoto}
            url={afterUrl}
            onPick={(e) => onPhoto(e, setAfterUrl)}
            onRemove={() => setAfterUrl(undefined)}
          />
        </div>
        {!bothPhotos ? (
          <div className="mt-3">
            <Checkbox
              checked={skipPhotosAck}
              onChange={(e) => setSkipPhotosAck(e.target.checked)}
              label="사진 없이(또는 일부만) 이대로 기록할게요"
            />
          </div>
        ) : null}
      </section>

      <Button
        variant="accent"
        size="lg"
        className="w-full"
        onClick={submit}
        disabled={pending || !canSubmit}
      >
        {pending ? (
          <>
            <Spinner className="text-current" /> {labels.finishing}
          </>
        ) : (
          labels.finish
        )}
      </Button>
    </div>
  );
}

function PhotoSlot({
  label,
  addLabel,
  removeLabel,
  url,
  onPick,
  onRemove,
}: {
  label: string;
  addLabel: string;
  removeLabel: string;
  url?: string;
  onPick: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium text-foreground">{label}</p>
      {url ? (
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={label}
            className="aspect-square w-full rounded-xl border border-border object-cover"
          />
          <button
            type="button"
            aria-label={removeLabel}
            onClick={onRemove}
            className="absolute right-1.5 top-1.5 inline-flex size-7 items-center justify-center rounded-full bg-foreground/65 text-base font-semibold leading-none text-card outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
      ) : (
        <label className="flex aspect-square w-full cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-border bg-card text-muted-foreground transition-colors hover:bg-muted focus-within:ring-2 focus-within:ring-ring">
          <span className="text-2xl font-light leading-none" aria-hidden="true">
            +
          </span>
          <span className="text-xs">{addLabel}</span>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={onPick}
          />
        </label>
      )}
    </div>
  );
}
