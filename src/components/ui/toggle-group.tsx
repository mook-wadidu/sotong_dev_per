"use client";

import * as React from "react";
import { Chip, PictoChip } from "./chip";
import { cn } from "@/lib/utils";

/**
 * 다중 선택 그룹 — Chip 을 role="group" 으로 감싼다.
 * 각 항목은 role="checkbox"(aria-checked). 방향키로 항목 간 이동(roving tabindex).
 * 인테이크의 "여러 개 고르기"(고민/시술 등)용.
 */
export interface ToggleOption<V extends string> {
  value: V;
  label: React.ReactNode;
  sublabel?: React.ReactNode;
  icon?: React.ReactNode;
  disabled?: boolean;
}

export interface ToggleGroupProps<V extends string> {
  options: ToggleOption<V>[];
  value: V[];
  onValueChange: (value: V[]) => void;
  label?: string;
  labelledBy?: string;
  variant?: "list" | "grid";
  /** 최대 선택 수 (초과 선택 무시) */
  max?: number;
  className?: string;
}

export function ToggleGroup<V extends string>({
  options,
  value,
  onValueChange,
  label,
  labelledBy,
  variant = "list",
  max,
  className,
}: ToggleGroupProps<V>) {
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const firstEnabled = options.findIndex((o) => !o.disabled);
  const [focusIndex, setFocusIndex] = React.useState(
    firstEnabled >= 0 ? firstEnabled : 0,
  );

  const toggle = (v: V) => {
    if (value.includes(v)) {
      onValueChange(value.filter((x) => x !== v));
    } else {
      if (max && value.length >= max) return;
      onValueChange([...value, v]);
    }
  };

  const focusableIndexes = options
    .map((o, i) => (o.disabled ? -1 : i))
    .filter((i) => i >= 0);

  const moveFocus = (dir: 1 | -1) => {
    if (focusableIndexes.length === 0) return;
    const pos = focusableIndexes.indexOf(focusIndex);
    const nextPos =
      (pos + dir + focusableIndexes.length) % focusableIndexes.length;
    const next = focusableIndexes[nextPos];
    setFocusIndex(next);
    refs.current[next]?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case "ArrowDown":
      case "ArrowRight":
        e.preventDefault();
        moveFocus(1);
        break;
      case "ArrowUp":
      case "ArrowLeft":
        e.preventDefault();
        moveFocus(-1);
        break;
    }
  };

  return (
    <div
      role="group"
      aria-label={label}
      aria-labelledby={labelledBy}
      onKeyDown={onKeyDown}
      className={cn(
        variant === "grid" ? "grid grid-cols-3 gap-2.5" : "space-y-2",
        className,
      )}
    >
      {options.map((opt, i) => {
        const selected = value.includes(opt.value);
        const tabbable = i === focusIndex;
        const common = {
          ref: (el: HTMLButtonElement | null) => {
            refs.current[i] = el;
          },
          selected,
          selectMode: "multi" as const,
          disabled: opt.disabled,
          tabIndex: tabbable && !opt.disabled ? 0 : -1,
          onFocus: () => setFocusIndex(i),
          onClick: () => toggle(opt.value),
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
