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
import { cn } from "@/lib/utils";
import type { Locale, ThreeLevel } from "@/lib/domain/types";

/** 긴 변 ~1280px / JPEG ~0.8 로 리사이즈 후 dataURL (P1-40). */
async function resizeToDataUrl(file: File, maxSide = 1280): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas context unavailable");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  return canvas.toDataURL("image/jpeg", 0.8);
}

type Labels = {
  products: string;
  productsHint: string;
  addProduct: string;
  addProductPlaceholder: string;
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
  openReport: string;
  gradeHigh: string;
  gradeMid: string;
  gradeLow: string;
};

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
  const [beforeUrl, setBeforeUrl] = React.useState<string | undefined>();
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
  const hasAnyInput =
    productIds.length > 0 ||
    customProducts.length > 0 ||
    grade !== null ||
    Boolean(beforeUrl) ||
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
          },
          beforePhotoUrl: beforeUrl,
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

      {/* before / after 사진 */}
      <section className="grid grid-cols-2 gap-3">
        <PhotoSlot
          label={labels.beforePhoto}
          addLabel={labels.addPhoto}
          removeLabel={labels.removePhoto}
          url={beforeUrl}
          onPick={(e) => onPhoto(e, setBeforeUrl)}
          onRemove={() => setBeforeUrl(undefined)}
        />
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
