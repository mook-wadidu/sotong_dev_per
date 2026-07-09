"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  Button,
} from "@/components/ui";
import { adminPath, type AdminView } from "@/lib/links";

/**
 * 어드민 사이드바 셸 — 데스크톱(sm+) 좌측 고정 사이드바 + 모바일 Sheet 토글.
 * 활성 표시는 현재 `view`(URL 파라미터) 기반(흑백: 배경/테두리/굵기로 구분).
 * children = 섹션 콘텐츠(서버에서 view 분기로 주입).
 */
export function AdminLayout({
  adminKey,
  view,
  children,
}: {
  adminKey: string;
  view: AdminView;
  children: React.ReactNode;
}) {
  const t = useTranslations("Admin");
  const [mobileOpen, setMobileOpen] = React.useState(false);

  // adminPath 는 ko 고정(/ko/admin?…) — 언어 전환 후에도 nav 가 현재 로케일을
  // 유지하도록, 링크의 선두 /ko 세그먼트를 현재 URL 로케일로 치환한다.
  const pathname = usePathname();
  const locale = pathname.split("/")[1] || "ko";
  const localized = (href: string) => href.replace(/^\/ko(?=\/|$|\?)/, `/${locale}`);

  const items: { key: AdminView; label: string }[] = [
    { key: "dashboard", label: t("nav.dashboard") },
    { key: "salons", label: t("nav.salons") },
    { key: "inquiries", label: t("nav.inquiries") },
    { key: "errors", label: t("nav.errors") },
    { key: "traffic", label: t("nav.traffic") },
    { key: "onboarding", label: t("nav.onboarding") },
  ];

  // 렌더 함수(컴포넌트 아님) — 데스크톱/모바일에서 동일 내비를 재사용.
  const renderNavLinks = (onNavigate?: () => void) => (
    <nav aria-label={t("nav.label")} className="flex flex-col gap-1">
      {items.map((item) => {
        const active = item.key === view;
        return (
          <Link
            key={item.key}
            href={localized(adminPath(adminKey, { view: item.key }))}
            aria-current={active ? "page" : undefined}
            onClick={onNavigate}
            className={
              active
                ? "rounded-lg border border-foreground bg-foreground px-3.5 py-2.5 text-sm font-semibold text-background"
                : "rounded-lg border border-transparent px-3.5 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            }
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  const activeLabel =
    items.find((i) => i.key === view)?.label ?? t("nav.dashboard");

  return (
    <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
      {/* ── 모바일 토글 바(sm 미만) ──────────────────────── */}
      <div className="flex items-center justify-between gap-3 sm:hidden">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setMobileOpen(true)}
          aria-label={t("nav.open")}
        >
          {t("nav.menu")}
        </Button>
        <span className="text-sm font-semibold text-foreground">
          {activeLabel}
        </span>
      </div>

      {/* ── 데스크톱 사이드바(sm+) ───────────────────────── */}
      <aside className="hidden w-52 shrink-0 sm:block">
        {/* 고정 헤더가 없으므로 작은 오프셋만(기존 top-20=80px 는 과도). */}
        <div className="sticky top-6">{renderNavLinks()}</div>
      </aside>

      {/* ── 모바일 Sheet ─────────────────────────────────── */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent closeLabel={t("nav.close")}>
          <SheetHeader>
            <SheetTitle>{t("nav.menu")}</SheetTitle>
          </SheetHeader>
          {renderNavLinks(() => setMobileOpen(false))}
        </SheetContent>
      </Sheet>

      {/* ── 콘텐츠 ───────────────────────────────────────── */}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
