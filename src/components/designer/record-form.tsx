"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Button,
  Input,
  ToggleGroup,
  RadioGroup,
  Spinner,
  SectionLabel,
  toast,
  buttonVariants,
} from "@/components/ui";
import { PRODUCTS } from "@/lib/catalog";
import { finishAndSendReport } from "@/lib/actions";
import { reportPath } from "@/lib/links";
import { resizeToDataUrl } from "@/lib/image";
import { cn } from "@/lib/utils";
import type { Locale, ThreeLevel } from "@/lib/domain/types";

type Labels = {
  products: string;
  productsHint: string;
  addProduct: string;
  addProductPlaceholder: string;
  stateGrade: string;
  satisfaction: string;
  satisfactionHint: string;
  satisfactionClear: string;
  /** 만족도 섹션을 펼치는 디스클로저 라벨 (기본 접힘 — 선택) */
  satisfactionToggle: string;
  /** 1~5 점수별 텍스트 라벨 (흑백·접근성 — 별/색 대신 말로) */
  satisfactionLevels: Record<1 | 2 | 3 | 4 | 5, string>;
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
};

const SATISFACTION_SCORES = [1, 2, 3, 4, 5] as const;

export function RecordForm({
  token,
  customerLocale,
  beforeUrl,
  defaultProducts,
  defaultGrade,
  labels,
}: {
  token: string;
  customerLocale: Locale;
  /** 요약 단계에서 미리 촬영한 비포 사진(있으면 프리필, 교체 가능). */
  beforeUrl?: string;
  /** 재방문 손님의 지난 시술 약제·제품(카탈로그 id + 커스텀 혼재). */
  defaultProducts?: string[];
  /** 재방문 손님의 지난 모발 상태 등급. */
  defaultGrade?: ThreeLevel;
  labels: Labels;
}) {
  const router = useRouter();
  // 재방문 프리필 — 지난 시술 약제를 카탈로그 id / 커스텀 문자열로 분리해 초기값.
  const catalogIds = React.useMemo(() => new Set(PRODUCTS.map((p) => p.id)), []);
  const [productIds, setProductIds] = React.useState<string[]>(() =>
    (defaultProducts ?? []).filter((p) => catalogIds.has(p)),
  );
  const [customProducts, setCustomProducts] = React.useState<string[]>(() =>
    (defaultProducts ?? []).filter((p) => !catalogIds.has(p)),
  );
  const [customInput, setCustomInput] = React.useState("");
  const [grade, setGrade] = React.useState<ThreeLevel | null>(
    defaultGrade ?? null,
  );
  const [satisfaction, setSatisfaction] = React.useState<number | null>(null);
  // 만족도는 선택 — 기본 접힘. 펼치거나 이미 값이 있으면 노출.
  const [satisfactionOpen, setSatisfactionOpen] = React.useState(false);
  // 비포는 요약 단계 촬영분으로 프리필(교체 가능), 애프터는 기록폼에서 촬영. 둘 다 필수.
  const [beforePhoto, setBeforePhoto] = React.useState<string | undefined>(
    beforeUrl,
  );
  const [afterUrl, setAfterUrl] = React.useState<string | undefined>();
  // 재방문 프리필 안내 — 프리필이 있을 때만 노출, '비우기'로 초기화.
  const hasPrefill = (defaultProducts?.length ?? 0) > 0 || defaultGrade != null;
  const [prefillCleared, setPrefillCleared] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [reportToken, setReportToken] = React.useState<string | undefined>();

  const productOptions = PRODUCTS.map((p) => ({
    value: p.id,
    label: p.label.ko,
  }));

  const gradeOptions = [
    { value: "high" as const, label: labels.gradeHigh },
    { value: "mid" as const, label: labels.gradeMid },
    { value: "low" as const, label: labels.gradeLow },
  ];

  const addCustomProduct = () => {
    const v = customInput.trim();
    if (!v) return;
    setCustomProducts((p) => (p.includes(v) ? p : [...p, v]));
    setCustomInput("");
  };

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
      toast.error(labels.failed);
    }
  };

  const clearPrefill = () => {
    setProductIds([]);
    setCustomProducts([]);
    setGrade(null);
    setPrefillCleared(true);
  };

  // PRD NOW #4 — 비포/애프터 사진 2장 필수(데이터 엔진 그라운드트루스).
  const canSubmit = Boolean(beforePhoto) && Boolean(afterUrl);

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
            products: [...productIds, ...customProducts],
            stateGrade: grade ?? undefined,
            satisfactionScore: satisfaction ?? undefined,
          },
          // before/after 둘 다 필수 — 기록폼에 표시된 값을 그대로 전송.
          beforePhotoUrl: beforePhoto,
          afterPhotoUrl: afterUrl,
        });
        if (!res) {
          toast.error(labels.failed);
          return;
        }
        setReportToken(res.reportToken);
        toast.success(labels.sent);
        router.refresh();
      } catch {
        toast.error(labels.failed);
      }
    });
  };

  // 발송 완료 → 손님 리포트 링크 표시
  if (reportToken) {
    return (
      <div className="space-y-4 py-6 text-center">
        <p className="text-base font-semibold text-foreground">
          {labels.sent}
        </p>
        <Link
          href={reportPath(reportToken, customerLocale)}
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

      {/* 사용 약제·제품 (다중 + 직접추가) */}
      <section>
        <SectionLabel>{labels.products}</SectionLabel>
        <p className="mb-2.5 text-xs text-muted-foreground">
          {labels.productsHint}
        </p>
        <ToggleGroup
          options={productOptions}
          value={productIds}
          onValueChange={setProductIds}
          label={labels.products}
        />

        {customProducts.length > 0 ? (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {customProducts.map((p) => (
              <span
                key={p}
                className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-3 py-1.5 text-sm text-accent-text"
              >
                {p}
                <button
                  type="button"
                  aria-label={labels.removePhoto}
                  onClick={() =>
                    setCustomProducts((arr) => arr.filter((x) => x !== p))
                  }
                  className="rounded-full px-1 text-base font-semibold leading-none outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span aria-hidden="true">×</span>
                </button>
              </span>
            ))}
          </div>
        ) : null}

        <div className="mt-2.5 flex gap-2">
          <Input
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCustomProduct();
              }
            }}
            placeholder={labels.addProductPlaceholder}
            className="h-11 flex-1"
          />
          <Button
            variant="outline"
            size="default"
            onClick={addCustomProduct}
            disabled={!customInput.trim()}
          >
            {labels.addProduct}
          </Button>
        </div>
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

      {/* 만족도 (선택) — 기본 접힘. 토글로 펼치거나 이미 값이 있으면 노출. */}
      <section>
        {satisfactionOpen || satisfaction !== null ? (
          <>
            <SectionLabel>{labels.satisfaction}</SectionLabel>
            <p className="mb-2.5 text-xs text-muted-foreground">
              {labels.satisfactionHint}
            </p>
            <RadioGroup
              variant="list"
              label={labels.satisfaction}
              options={SATISFACTION_SCORES.map((n) => ({
                value: String(n),
                label: `${n} · ${labels.satisfactionLevels[n]}`,
              }))}
              value={satisfaction === null ? null : String(satisfaction)}
              onValueChange={(v) => setSatisfaction(Number(v))}
            />
            {satisfaction !== null ? (
              <button
                type="button"
                onClick={() => setSatisfaction(null)}
                className="mt-2 text-sm font-medium text-muted-foreground underline underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                {labels.satisfactionClear}
              </button>
            ) : null}
          </>
        ) : (
          <button
            type="button"
            onClick={() => setSatisfactionOpen(true)}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground underline underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <span className="text-base leading-none" aria-hidden="true">
              +
            </span>
            {labels.satisfactionToggle}
          </button>
        )}
      </section>

      {/* 비포·애프터 사진 — 둘 다 필수(PRD NOW #4). 비포는 요약 단계 촬영분 프리필. */}
      <section>
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
        {!canSubmit ? (
          <p className="mt-2 text-xs text-muted-foreground" role="status">
            {labels.needPhotos}
          </p>
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
