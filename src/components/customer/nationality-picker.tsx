"use client";

import * as React from "react";
import {
  RadioGroup,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  type RadioOption,
} from "@/components/ui";
import { NATIONALITIES } from "@/lib/catalog";
import type { Locale } from "@/lib/domain/types";

/**
 * 국적 선택 — 다이얼(드롭다운) 느낌의 하단시트 피커.
 * 큰 그리드 대신 현재 선택을 띄운 버튼 → 탭 시 Sheet 리스트에서 단일 선택.
 * 신규 Select 프리미티브 도입 없이 기존 Sheet + RadioGroup 재사용.
 */
export function NationalityPicker({
  value,
  onChange,
  locale,
  label,
  placeholder,
  closeLabel,
}: {
  value: string | null;
  onChange: (v: string) => void;
  locale: Locale;
  /** 시트 제목 + a11y 그룹 이름 */
  label: string;
  /** 미선택 시 버튼 문구 */
  placeholder: string;
  /** 시트 닫기 버튼 aria-label */
  closeLabel: string;
}) {
  const [open, setOpen] = React.useState(false);
  const options = NATIONALITIES.map<RadioOption<string>>((n) => ({
    value: n.id,
    label: n.label[locale] ?? n.label.ko,
  }));
  const selected = options.find((o) => o.value === value)?.label;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="flex h-11 w-full items-center justify-between rounded-xl border border-border bg-card px-3.5 text-left text-sm outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <span className={value ? "text-foreground" : "text-muted-foreground"}>
          {selected ?? placeholder}
        </span>
        <span aria-hidden="true" className="ml-2 text-muted-foreground">
          ▾
        </span>
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent closeLabel={closeLabel}>
          <SheetHeader>
            <SheetTitle>{label}</SheetTitle>
          </SheetHeader>
          <div className="mt-3 overflow-y-auto">
            <RadioGroup
              variant="list"
              label={label}
              options={options}
              value={value}
              onValueChange={(v) => {
                onChange(v);
                setOpen(false);
              }}
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
