"use client";

import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * "여기를 누르세요" 가이드.
 * children을 감싸 active일 때 펄스 링 + 손가락 라벨 버블을 띄운다.
 * 폰 내부(overflow-hidden)에는 라벨이 잘리므로, 폰 바깥 타깃(언어 토글 등)에 사용.
 */
export default function GuidedHint({
  active,
  label = "여기를 누르세요",
  position = "top",
  className,
  children,
}: {
  active: boolean;
  label?: string;
  position?: "top" | "bottom";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("relative inline-flex", className)}>
      {children}
      <AnimatePresence>
        {active && (
          <>
            <motion.span
              key="ring"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="pointer-events-none absolute -inset-1.5 rounded-full ring-2 ring-brand-400 animate-pulse"
            />
            <motion.div
              key="label"
              initial={{ opacity: 0, y: position === "top" ? 6 : -6, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ type: "spring", stiffness: 300, damping: 22 }}
              className={cn(
                "pointer-events-none absolute left-1/2 z-30 -translate-x-1/2 whitespace-nowrap",
                position === "top" ? "bottom-full mb-2" : "top-full mt-2"
              )}
            >
              <span className="inline-flex items-center gap-1 rounded-full bg-ink-900 px-2.5 py-1 text-[11px] font-semibold text-white shadow-lg">
                <motion.span
                  animate={{ y: [0, -2, 0] }}
                  transition={{ repeat: Infinity, duration: 1.1 }}
                >
                  👆
                </motion.span>
                {label}
              </span>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
