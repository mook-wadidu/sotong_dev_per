import * as React from "react";
import { CheckIcon, SpinnerIcon } from "@/components/icons";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/* ── Badge ─────────────────────────────────────────────── */
/**
 * Phase 3 흑백 — 의미는 색이 아니라 **채움 vs 외곽선 + 텍스트 라벨**로 구분한다.
 * - 채움(잉크): accent/warning/destructive → 강조·주의·진행
 * - 채움(연그레이): default → 중립
 * - 외곽선: outline/info/success → 보조/정보/완료
 * variant 명은 하위호환 위해 유지(호출부 변경 없음).
 */
const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
  {
    variants: {
      variant: {
        default: "bg-secondary text-secondary-foreground",
        accent: "bg-foreground text-background",
        outline: "border border-border text-muted-foreground",
        success: "border border-foreground font-semibold text-foreground",
        warning: "bg-foreground font-semibold text-background",
        info: "border border-border text-foreground",
        destructive: "bg-foreground font-semibold text-background",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export function Badge({
  className,
  variant,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof badgeVariants>) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

/* ── Input ─────────────────────────────────────────────── */
export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "h-13 w-full rounded-xl border border-input bg-card px-4 text-base text-foreground outline-none transition-colors placeholder:text-muted-foreground hover:border-foreground/20 focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent aria-[invalid=true]:border-destructive aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-destructive disabled:opacity-50",
      className,
    )}
    {...props}
  />
));
Input.displayName = "Input";

/* ── Textarea ──────────────────────────────────────────── */
export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "min-h-22 w-full resize-none rounded-xl border border-input bg-card px-4 py-3 text-base text-foreground outline-none transition-colors placeholder:text-muted-foreground hover:border-foreground/20 focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent aria-[invalid=true]:border-destructive aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-destructive disabled:opacity-50",
      className,
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";

/* ── Checkbox ──────────────────────────────────────────── */
export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "size"> {
  label?: React.ReactNode;
  description?: React.ReactNode;
}

/**
 * 접근성 체크박스 — 네이티브 input 위에 시각 표현을 얹는다.
 * 동의 수집(consent) 등에 사용. label/description 연결, focus-visible 링.
 */
export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, description, id, ...props }, ref) => {
    const autoId = React.useId();
    const inputId = id ?? autoId;
    return (
      <label
        htmlFor={inputId}
        className={cn(
          "group flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-card p-3.5 text-left transition-colors hover:bg-muted has-[:checked]:border-accent has-[:checked]:bg-accent-soft has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50",
          // 에러(aria-invalid) — 색 비의존, 두꺼운 어두운 테두리로 신호.
          "has-[input[aria-invalid]]:border-2 has-[input[aria-invalid]]:border-destructive",
          className,
        )}
      >
        <span className="relative mt-0.5 inline-flex size-5 shrink-0 items-center justify-center">
          <input
            ref={ref}
            id={inputId}
            type="checkbox"
            className="peer size-5 cursor-pointer appearance-none rounded-md border border-input bg-card outline-none transition-colors checked:border-accent-strong checked:bg-accent-strong focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed"
            {...props}
          />
          <CheckIcon
            className="pointer-events-none absolute size-3.5 text-white opacity-0 peer-checked:opacity-100"
            strokeWidth={3}
            aria-hidden="true"
          />
        </span>
        {label || description ? (
          <span className="min-w-0 flex-1">
            {label ? (
              <span className="block text-sm font-medium leading-snug text-foreground">
                {label}
              </span>
            ) : null}
            {description ? (
              <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
                {description}
              </span>
            ) : null}
          </span>
        ) : null}
      </label>
    );
  },
);
Checkbox.displayName = "Checkbox";

/* ── FormField ─────────────────────────────────────────── */
/**
 * 폼 필드 래퍼 — label/hint/error 를 컨트롤과 a11y 로 연결.
 * children 으로 단일 컨트롤(Input/Textarea 등)을 받아 id/aria-* 를 주입한다.
 */
export function FormField({
  id,
  label,
  hint,
  error,
  required,
  className,
  children,
}: {
  /** 컨트롤 id. 미지정 시 자동 생성. */
  id?: string;
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  required?: boolean;
  className?: string;
  children: React.ReactElement<{
    id?: string;
    "aria-invalid"?: boolean | "true" | "false";
    "aria-describedby"?: string;
    "aria-required"?: boolean;
  }>;
}) {
  const autoId = React.useId();
  const fieldId = id ?? autoId;
  const hintId = hint ? `${fieldId}-hint` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  const control = React.cloneElement(children, {
    id: fieldId,
    "aria-invalid": error ? "true" : undefined,
    "aria-describedby": describedBy,
    "aria-required": required ? true : undefined,
  });

  return (
    <div className={cn("space-y-1.5", className)}>
      {label ? (
        <label
          htmlFor={fieldId}
          className="block text-sm font-semibold text-foreground"
        >
          {label}
          {required ? (
            <span className="ml-0.5 text-destructive" aria-hidden="true">
              *
            </span>
          ) : null}
        </label>
      ) : null}
      {control}
      {hint && !error ? (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/* ── Spinner ───────────────────────────────────────────── */
export function Spinner({
  className,
  label = "Loading…",
  ...props
}: React.SVGProps<SVGSVGElement> & { label?: string }) {
  return (
    <span role="status" className="inline-flex items-center">
      <SpinnerIcon
        className={cn("size-5 animate-spin text-muted-foreground", className)}
        aria-hidden="true"
        {...props}
      />
      <span className="sr-only">{label}</span>
    </span>
  );
}

/* ── Skeleton ──────────────────────────────────────────── */
export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded-lg bg-muted", className)}
      {...props}
    />
  );
}

/* ── SectionLabel ──────────────────────────────────────── */
export function SectionLabel({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn(
        "mb-2.5 text-sm font-semibold text-foreground",
        className,
      )}
      {...props}
    />
  );
}

/* ── Divider ───────────────────────────────────────────── */
export function Divider({ className }: { className?: string }) {
  return <div className={cn("h-px w-full bg-border", className)} />;
}
