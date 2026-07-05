import Link from "next/link";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost";

const styles: Record<Variant, string> = {
  primary:
    "bg-brand-500 text-white shadow-[0_8px_24px_-6px_rgba(91,91,214,0.6)] hover:bg-brand-600 hover:-translate-y-0.5",
  secondary:
    "bg-white text-ink-900 ring-1 ring-inset ring-ink-900/10 hover:ring-ink-900/20 hover:-translate-y-0.5",
  ghost: "text-ink-700 hover:text-brand-600",
};

export default function CTAButton({
  href,
  variant = "primary",
  className,
  children,
}: {
  href: string;
  variant?: Variant;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-base font-semibold transition-all duration-200",
        styles[variant],
        className
      )}
    >
      {children}
    </Link>
  );
}
