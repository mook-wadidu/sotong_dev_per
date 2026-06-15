"use client";

import * as React from "react";
import { Chip, PictoChip } from "./chip";
import { cn } from "@/lib/utils";

/**
 * 단일 선택 그룹 — Chip 을 role="radiogroup" 으로 감싼다.
 * roving tabindex + 방향키 이동(↑↓←→), Home/End, 그룹 라벨(aria-label/labelledby).
 * 인테이크의 "하나만 고르기"(얼굴형/볼륨/밀도 등)용.
 */
export interface RadioOption<V extends string> {
  value: V;
  label: React.ReactNode;
  sublabel?: React.ReactNode;
  icon?: React.ReactNode;
  disabled?: boolean;
}

export interface RadioGroupProps<V extends string> {
  options: RadioOption<V>[];
  value: V | null;
  onValueChange: (value: V) => void;
  /** 접근성 그룹 이름 */
  label?: string;
  labelledBy?: string;
  /** "list" = 세로 Chip, "grid" = PictoChip 그리드 */
  variant?: "list" | "grid";
  className?: string;
}

export function RadioGroup<V extends string>({
  options,
  value,
  onValueChange,
  label,
  labelledBy,
  variant = "list",
  className,
}: RadioGroupProps<V>) {
  const enabled = options.filter((o) => !o.disabled);
  const activeIndex = (() => {
    const i = enabled.findIndex((o) => o.value === value);
    return i >= 0 ? i : 0;
  })();
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);

  const move = (dir: 1 | -1) => {
    if (enabled.length === 0) return;
    const next = (activeIndex + dir + enabled.length) % enabled.length;
    const opt = enabled[next];
    onValueChange(opt.value);
    // focus 는 enabled 인덱스가 아니라 전체 options 인덱스 기준
    const fullIdx = options.findIndex((o) => o.value === opt.value);
    refs.current[fullIdx]?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case "ArrowDown":
      case "ArrowRight":
        e.preventDefault();
        move(1);
        break;
      case "ArrowUp":
      case "ArrowLeft":
        e.preventDefault();
        move(-1);
        break;
      case "Home":
        e.preventDefault();
        if (enabled[0]) onValueChange(enabled[0].value);
        break;
      case "End":
        e.preventDefault();
        if (enabled.at(-1)) onValueChange(enabled.at(-1)!.value);
        break;
    }
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      aria-labelledby={labelledBy}
      onKeyDown={onKeyDown}
      className={cn(
        variant === "grid" ? "grid grid-cols-3 gap-2.5" : "space-y-2",
        className,
      )}
    >
      {options.map((opt, i) => {
        const selected = opt.value === value;
        // roving tabindex: 선택된 항목(없으면 첫 활성)만 tab 진입 가능
        const tabbable = value ? selected : i === options.indexOf(enabled[0]);
        const common = {
          ref: (el: HTMLButtonElement | null) => {
            refs.current[i] = el;
          },
          selected,
          selectMode: "single" as const,
          disabled: opt.disabled,
          tabIndex: tabbable ? 0 : -1,
          onClick: () => onValueChange(opt.value),
        };
        return variant === "grid" ? (
          <PictoChip
            key={opt.value}
            {...common}
            label={opt.label}
            icon={opt.icon}
          />
        ) : (
          <Chip
            key={opt.value}
            {...common}
            label={opt.label}
            sublabel={opt.sublabel}
            icon={opt.icon}
          />
        );
      })}
    </div>
  );
}
