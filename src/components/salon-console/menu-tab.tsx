"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import {
  Button,
  Badge,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  FormField,
  Input,
  toast,
} from "@/components/ui";
import {
  salonUpsertCategory,
  salonUpsertService,
  salonDeleteService,
} from "@/lib/actions";
import type {
  DesignerRank,
  SalonService,
  SalonServiceCategory,
} from "@/lib/db/types";
import type { LocalizedText } from "@/lib/domain/types";

/** 빈 다국어 라벨 */
const emptyLabel = (): LocalizedText => ({ ko: "", ja: "", en: "" });

export function MenuTab({
  ownerToken,
  categories,
  services,
  ranks,
  onChanged,
}: {
  ownerToken: string;
  categories: SalonServiceCategory[];
  services: SalonService[];
  ranks: DesignerRank[];
  onChanged: () => void;
}) {
  const t = useTranslations("Admin");

  // 다이얼로그 상태(카테고리/시술 폼)
  const [catForm, setCatForm] = React.useState<{
    open: boolean;
    edit?: SalonServiceCategory;
  }>({ open: false });
  const [svcForm, setSvcForm] = React.useState<{
    open: boolean;
    categoryId?: string;
    edit?: SalonService;
  }>({ open: false });

  const servicesByCat = React.useMemo(() => {
    const m = new Map<string, SalonService[]>();
    for (const s of services) {
      const arr = m.get(s.categoryId) ?? [];
      arr.push(s);
      m.set(s.categoryId, arr);
    }
    return m;
  }, [services]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{t("console.menu.hint")}</p>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setCatForm({ open: true })}
        >
          {t("console.menu.addCategory")}
        </Button>
      </div>

      {categories.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/50 p-12 text-center text-sm text-muted-foreground">
          {t("console.menu.emptyCategories")}
        </div>
      ) : (
        <div className="space-y-5">
          {categories.map((cat) => {
            const list = servicesByCat.get(cat.id) ?? [];
            return (
              <section
                key={cat.id}
                className="rounded-xl border border-border bg-card p-5"
              >
                <div className="flex items-start justify-between gap-3 border-b border-border pb-3">
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold leading-tight">
                      {cat.label.ko}
                    </h3>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {cat.label.ja} · {cat.label.en}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setCatForm({ open: true, edit: cat })}
                    >
                      {t("console.edit")}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setSvcForm({ open: true, categoryId: cat.id })
                      }
                    >
                      {t("console.menu.addService")}
                    </Button>
                  </div>
                </div>

                {list.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    {t("console.menu.emptyServices")}
                  </p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {list.map((svc) => (
                      <li
                        key={svc.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-border/70 px-3.5 py-2.5"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm font-medium">
                              {svc.label.ko}
                            </span>
                            {!svc.active ? (
                              <Badge variant="outline">
                                {t("console.menu.inactive")}
                              </Badge>
                            ) : null}
                            {svc.rankPrices &&
                            Object.keys(svc.rankPrices).length ? (
                              <Badge variant="info">
                                {t("console.menu.hasRankPrice")}
                              </Badge>
                            ) : null}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {t("console.menu.fromPrice", {
                              price: svc.basePriceFrom.toLocaleString("ko-KR"),
                            })}
                          </span>
                        </div>
                        <div className="flex shrink-0 gap-1.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              setSvcForm({
                                open: true,
                                categoryId: svc.categoryId,
                                edit: svc,
                              })
                            }
                          >
                            {t("console.edit")}
                          </Button>
                          <DeleteServiceButton
                            ownerToken={ownerToken}
                            service={svc}
                            onChanged={onChanged}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}

      <CategoryDialog
        key={catForm.open ? catForm.edit?.id ?? "new" : "closed"}
        ownerToken={ownerToken}
        open={catForm.open}
        edit={catForm.edit}
        onOpenChange={(open) => setCatForm((s) => ({ ...s, open }))}
        onChanged={onChanged}
      />
      <ServiceDialog
        key={
          svcForm.open
            ? `${svcForm.categoryId ?? ""}:${svcForm.edit?.id ?? "new"}`
            : "closed"
        }
        ownerToken={ownerToken}
        open={svcForm.open}
        categoryId={svcForm.categoryId}
        edit={svcForm.edit}
        ranks={ranks}
        onOpenChange={(open) => setSvcForm((s) => ({ ...s, open }))}
        onChanged={onChanged}
      />
    </div>
  );
}

/* ── 시술 삭제 (확인 다이얼로그) ───────────────────────── */
function DeleteServiceButton({
  ownerToken,
  service,
  onChanged,
}: {
  ownerToken: string;
  service: SalonService;
  onChanged: () => void;
}) {
  const t = useTranslations("Admin");
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  const onConfirm = async () => {
    setPending(true);
    const res = await salonDeleteService({ ownerToken, id: service.id });
    setPending(false);
    if (res.ok) {
      toast.success(t("console.menu.deleted"));
      setOpen(false);
      onChanged();
    } else {
      toast.error(t("console.error"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
        {t("console.delete")}
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("console.menu.deleteTitle")}</DialogTitle>
          <DialogDescription>
            {t("console.menu.deleteConfirm", { name: service.label.ko })}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t("console.cancel")}
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={pending}
          >
            {t("console.delete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── 카테고리 추가/수정 다이얼로그 ─────────────────────── */
function CategoryDialog({
  ownerToken,
  open,
  edit,
  onOpenChange,
  onChanged,
}: {
  ownerToken: string;
  open: boolean;
  edit?: SalonServiceCategory;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
}) {
  const t = useTranslations("Admin");
  const [label, setLabel] = React.useState<LocalizedText>(
    edit ? { ...edit.label } : emptyLabel(),
  );
  const [pending, setPending] = React.useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.ko.trim()) {
      toast.error(t("console.menu.koRequired"));
      return;
    }
    setPending(true);
    const res = await salonUpsertCategory({
      ownerToken,
      id: edit?.id,
      label: {
        ko: label.ko.trim(),
        ja: label.ja.trim() || label.ko.trim(),
        en: label.en.trim() || label.ko.trim(),
        zh: label.zh?.trim() || undefined,
      },
    });
    setPending(false);
    if (res.ok) {
      toast.success(t("console.saved"));
      onOpenChange(false);
      onChanged();
    } else {
      toast.error(t("console.error"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {edit ? t("console.menu.editCategory") : t("console.menu.addCategory")}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <FormField label={t("console.labelKo")} required>
            <Input
              value={label.ko}
              onChange={(e) =>
                setLabel((l) => ({ ...l, ko: e.target.value }))
              }
              placeholder="컷"
            />
          </FormField>
          <FormField label={t("console.labelJa")}>
            <Input
              value={label.ja}
              onChange={(e) =>
                setLabel((l) => ({ ...l, ja: e.target.value }))
              }
              placeholder="カット"
            />
          </FormField>
          <FormField label={t("console.labelEn")}>
            <Input
              value={label.en}
              onChange={(e) =>
                setLabel((l) => ({ ...l, en: e.target.value }))
              }
              placeholder="Cut"
            />
          </FormField>
          <FormField label={t("console.labelZh")}>
            <Input
              value={label.zh ?? ""}
              onChange={(e) =>
                setLabel((l) => ({ ...l, zh: e.target.value }))
              }
              placeholder="剪发"
            />
          </FormField>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t("console.cancel")}
            </Button>
            <Button type="submit" disabled={pending}>
              {t("console.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ── 시술 추가/수정 다이얼로그 (직급별 가격 옵션) ──────── */
function ServiceDialog({
  ownerToken,
  open,
  categoryId,
  edit,
  ranks,
  onOpenChange,
  onChanged,
}: {
  ownerToken: string;
  open: boolean;
  categoryId?: string;
  edit?: SalonService;
  ranks: DesignerRank[];
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
}) {
  const t = useTranslations("Admin");
  const [label, setLabel] = React.useState<LocalizedText>(
    edit ? { ...edit.label } : emptyLabel(),
  );
  const [basePrice, setBasePrice] = React.useState(
    edit ? String(edit.basePriceFrom) : "",
  );
  const [active, setActive] = React.useState(edit ? edit.active : true);
  // rankId -> 입력 문자열(빈칸이면 미적용)
  const [rankPrices, setRankPrices] = React.useState<Record<string, string>>(
    () => {
      const rp: Record<string, string> = {};
      if (edit?.rankPrices) {
        for (const r of ranks) {
          const v = edit.rankPrices[r.id];
          if (typeof v === "number") rp[r.id] = String(v);
        }
      }
      return rp;
    },
  );
  const [pending, setPending] = React.useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryId) return;
    if (!label.ko.trim()) {
      toast.error(t("console.menu.koRequired"));
      return;
    }
    const base = Number(basePrice);
    if (!Number.isFinite(base) || base < 0) {
      toast.error(t("console.menu.priceInvalid"));
      return;
    }
    const rp: Record<string, number> = {};
    for (const r of ranks) {
      const raw = rankPrices[r.id]?.trim();
      if (!raw) continue;
      const n = Number(raw);
      if (Number.isFinite(n) && n > 0) rp[r.id] = n;
    }
    setPending(true);
    const res = await salonUpsertService({
      ownerToken,
      id: edit?.id,
      categoryId,
      label: {
        ko: label.ko.trim(),
        ja: label.ja.trim() || label.ko.trim(),
        en: label.en.trim() || label.ko.trim(),
        zh: label.zh?.trim() || undefined,
      },
      basePriceFrom: base,
      rankPrices: Object.keys(rp).length ? rp : undefined,
      active,
    });
    setPending(false);
    if (res.ok) {
      toast.success(t("console.saved"));
      onOpenChange(false);
      onChanged();
    } else {
      toast.error(t("console.error"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {edit ? t("console.menu.editService") : t("console.menu.addService")}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <FormField label={t("console.labelKo")} required>
            <Input
              value={label.ko}
              onChange={(e) => setLabel((l) => ({ ...l, ko: e.target.value }))}
              placeholder="여성 컷"
            />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label={t("console.labelJa")}>
              <Input
                value={label.ja}
                onChange={(e) =>
                  setLabel((l) => ({ ...l, ja: e.target.value }))
                }
                placeholder="レディースカット"
              />
            </FormField>
            <FormField label={t("console.labelEn")}>
              <Input
                value={label.en}
                onChange={(e) =>
                  setLabel((l) => ({ ...l, en: e.target.value }))
                }
                placeholder="Women's Cut"
              />
            </FormField>
            <FormField label={t("console.labelZh")}>
              <Input
                value={label.zh ?? ""}
                onChange={(e) =>
                  setLabel((l) => ({ ...l, zh: e.target.value }))
                }
                placeholder="女士剪发"
              />
            </FormField>
          </div>
          <FormField
            label={t("console.menu.basePrice")}
            hint={t("console.menu.basePriceHint")}
            required
          >
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              step={1000}
              value={basePrice}
              onChange={(e) => setBasePrice(e.target.value)}
              placeholder="35000"
            />
          </FormField>

          {ranks.length ? (
            <div className="space-y-2 rounded-xl border border-border/70 bg-muted/30 p-3.5">
              <p className="text-sm font-semibold text-foreground">
                {t("console.menu.rankPrices")}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("console.menu.rankPricesHint")}
              </p>
              <div className="space-y-2.5 pt-1">
                {ranks.map((r) => (
                  // 콘솔은 ko 고정 뷰 — 직급 라벨(LocalizedText)에서 ko 만 표기.
                  <FormField key={r.id} label={r.label.ko}>
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      step={1000}
                      value={rankPrices[r.id] ?? ""}
                      onChange={(e) =>
                        setRankPrices((p) => ({ ...p, [r.id]: e.target.value }))
                      }
                      placeholder={t("console.menu.rankPricePlaceholder")}
                    />
                  </FormField>
                ))}
              </div>
            </div>
          ) : null}

          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="size-4 rounded border-input accent-foreground"
            />
            {t("console.menu.activeLabel")}
          </label>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t("console.cancel")}
            </Button>
            <Button type="submit" disabled={pending}>
              {t("console.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
