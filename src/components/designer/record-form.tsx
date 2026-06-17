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
  afterPhoto: string;
  addPhoto: string;
  removePhoto: string;
  finish: string;
  finishing: string;
  sent: string;
  failed: string;
  needInput: string;
  openReport: string;
  gradeHigh: string;
  gradeMid: string;
  gradeLow: string;
};

const SATISFACTION_SCORES = [1, 2, 3, 4, 5] as const;

export function RecordForm({
  token,
  customerLocale,
  labels,
}: {
  token: string;
  customerLocale: Locale;
  labels: Labels;
}) {
  const router = useRouter();
  const [productIds, setProductIds] = React.useState<string[]>([]);
  const [customProducts, setCustomProducts] = React.useState<string[]>([]);
  const [customInput, setCustomInput] = React.useState("");
  const [grade, setGrade] = React.useState<ThreeLevel | null>(null);
  const [satisfaction, setSatisfaction] = React.useState<number | null>(null);
  // 만족도는 선택 — 기본 접힘. 펼치거나 이미 값이 있으면 노출.
  const [satisfactionOpen, setSatisfactionOpen] = React.useState(false);
  const [afterUrl, setAfterUrl] = React.useState<string | undefined>();
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

  // 최소 1개 필드는 채워야 발송(빈 리포트 전송 방지, AUDIT UX P2).
  // before 는 요약 단계 저장분을 쓰므로 여기선 보내지 않는다.
  const hasAnyInput =
    productIds.length > 0 ||
    customProducts.length > 0 ||
    grade !== null ||
    satisfaction !== null ||
    Boolean(afterUrl);

  const submit = () => {
    if (!hasAnyInput) {
      toast.error(labels.needInput);
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
          // before 는 요약 단계에서 저장된 값(consultation.beforePhotoUrl)을 우선 사용 →
          // 리포트폼에서는 보내지 않는다(completeConsultation 폴백만 존재).
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

      {/* 시술 후 사진 (before 는 요약 단계에서 촬영) */}
      <section className="max-w-[12rem]">
        <PhotoSlot
          label={labels.afterPhoto}
          addLabel={labels.addPhoto}
          removeLabel={labels.removePhoto}
          url={afterUrl}
          onPick={(e) => onPhoto(e, setAfterUrl)}
          onRemove={() => setAfterUrl(undefined)}
        />
      </section>

      <Button
        variant="accent"
        size="lg"
        className="w-full"
        onClick={submit}
        disabled={pending}
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
