"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import {
  Button,
  Input,
  FormField,
  toast,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui";
import { salonUpdateRanks } from "@/lib/actions";
import type { DesignerRank } from "@/lib/db/types";
import type { LocalizedText } from "@/lib/domain/types";

/**
 * 직급 편집기 — 콘솔/어드민 공통. 직급 라벨을 ko/ja/en/zh 다국어로 입력한다
 * (손님 진입화면이 손님 언어로 직급을 보여주므로). 메뉴 라벨 에디터와 동일 패턴:
 * ko 필수, ja/en 비우면 저장 시 ko 폴백, zh 는 생략 시 tx 가 ko 폴백.
 * 전체 직급 목록을 통째로 보내는 salonUpdateRanks 규약을 따른다(델타 아님).
 */

type Row = {
  /** 안정 key (렌더 전용). 기존 직급은 직급 id, 신규는 임시 uid. */
  key: string;
  /** 기존 직급 id (신규면 undefined → 액션이 생성). */
  id?: string;
  ko: string;
  ja: string;
  en: string;
  zh: string;
};

let uidSeq = 0;
const nextKey = () => `new-${uidSeq++}`;

/** 라틴 라벨에서만 안정 slug id 추출. 비라틴(한글 등)이면 undefined → 액션 위임. */
function latinSlug(label: string): string | undefined {
  const slug = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  return slug || undefined;
}

export function RanksEditor({
  ownerToken,
  ranks,
  onChanged,
}: {
  ownerToken: string;
  ranks: DesignerRank[];
  onChanged: () => void;
}) {
  const t = useTranslations("Admin");

  const initial = React.useMemo<Row[]>(
    () =>
      ranks.map((r) => ({
        key: r.id,
        id: r.id,
        ko: r.label.ko,
        ja: r.label.ja ?? "",
        en: r.label.en ?? "",
        zh: r.label.zh ?? "",
      })),
    [ranks],
  );
  const [rows, setRows] = React.useState<Row[]>(initial);
  const [pending, setPending] = React.useState(false);
  // 저장 시도 후 필수(ko) 미입력 필드를 강조(toast 만으로는 어디가 문제인지 모름).
  const [showErrors, setShowErrors] = React.useState(false);
  const [confirm, setConfirm] = React.useState<{ open: boolean; key?: string }>(
    { open: false },
  );

  // 서버 데이터(refresh)로 props 가 바뀌면 편집 상태를 재동기화(렌더 중 조정 패턴).
  const [prevRanks, setPrevRanks] = React.useState(ranks);
  if (prevRanks !== ranks) {
    setPrevRanks(ranks);
    setRows(initial);
  }

  const dirty = React.useMemo(() => {
    if (rows.length !== initial.length) return true;
    return rows.some((r, i) => {
      const o = initial[i];
      return (
        !o ||
        o.id !== r.id ||
        o.ko !== r.ko ||
        o.ja !== r.ja ||
        o.en !== r.en ||
        o.zh !== r.zh
      );
    });
  }, [rows, initial]);

  const setField = (key: string, field: "ko" | "ja" | "en" | "zh", v: string) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, [field]: v } : r)));

  const addRow = () =>
    setRows((rs) => [...rs, { key: nextKey(), ko: "", ja: "", en: "", zh: "" }]);

  const removeRow = (key: string) =>
    setRows((rs) => rs.filter((r) => r.key !== key));

  const requestRemove = (row: Row) => {
    // 신규(미저장) 행은 즉시 제거, 기존 직급은 확인 다이얼로그.
    if (!row.id) {
      removeRow(row.key);
      return;
    }
    setConfirm({ open: true, key: row.key });
  };

  const onSave = async () => {
    const cleaned = rows.map((r) => ({
      ...r,
      ko: r.ko.trim(),
      ja: r.ja.trim(),
      en: r.en.trim(),
      zh: r.zh.trim(),
    }));
    if (cleaned.some((r) => !r.ko)) {
      setShowErrors(true);
      toast.error(t("console.ranks.nameRequired"));
      return;
    }
    setShowErrors(false);
    const payload: DesignerRank[] = cleaned.map((r) => ({
      // 기존 직급은 id 유지; 신규는 라틴 slug 있으면 안정화, 없으면 액션 위임.
      id: r.id ?? latinSlug(r.ko) ?? "",
      // ko 필수, ja/en 비면 ko 폴백, zh 는 있을 때만(없으면 tx 가 ko 폴백).
      label: {
        ko: r.ko,
        ja: r.ja || r.ko,
        en: r.en || r.ko,
        zh: r.zh || undefined,
      } as LocalizedText,
    }));
    setPending(true);
    const res = await salonUpdateRanks(ownerToken, payload);
    setPending(false);
    if (res.ok) {
      toast.success(t("console.ranks.saved"));
      onChanged();
    } else {
      toast.error(t("console.error"));
    }
  };

  const confirmRow = confirm.key
    ? rows.find((r) => r.key === confirm.key)
    : undefined;

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold leading-tight">
            {t("console.ranks.title")}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("console.ranks.hint")}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={addRow}>
          {t("console.ranks.add")}
        </Button>
      </div>

      {rows.length === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed border-border bg-card/50 p-8 text-center text-sm text-muted-foreground">
          {t("console.ranks.empty")}
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {rows.map((row) => (
            <li
              key={row.key}
              className="rounded-lg border border-border/70 p-3.5"
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <FormField
                  label={t("console.labelKo")}
                  required
                  error={
                    showErrors && !row.ko.trim()
                      ? t("console.ranks.nameRequired")
                      : undefined
                  }
                >
                  <Input
                    value={row.ko}
                    aria-invalid={
                      showErrors && !row.ko.trim() ? true : undefined
                    }
                    onChange={(e) => setField(row.key, "ko", e.target.value)}
                    placeholder="원장"
                  />
                </FormField>
                <FormField label={t("console.labelJa")}>
                  <Input
                    value={row.ja}
                    onChange={(e) => setField(row.key, "ja", e.target.value)}
                    placeholder="院長"
                  />
                </FormField>
                <FormField label={t("console.labelEn")}>
                  <Input
                    value={row.en}
                    onChange={(e) => setField(row.key, "en", e.target.value)}
                    placeholder="Director"
                  />
                </FormField>
                <FormField label={t("console.labelZh")}>
                  <Input
                    value={row.zh}
                    onChange={(e) => setField(row.key, "zh", e.target.value)}
                    placeholder="院长"
                  />
                </FormField>
              </div>
              <div className="mt-2 flex justify-end">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => requestRemove(row)}
                  aria-label={t("console.ranks.removeRow")}
                >
                  {t("console.ranks.removeRow")}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-3 text-xs text-muted-foreground">
        {t("console.ranks.usageHint")}
      </p>

      <div className="mt-4 flex justify-end">
        <Button onClick={onSave} disabled={pending || !dirty}>
          {t("console.ranks.save")}
        </Button>
      </div>

      <Dialog
        open={confirm.open}
        onOpenChange={(open) => setConfirm((s) => ({ ...s, open }))}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("console.ranks.deleteTitle")}</DialogTitle>
            <DialogDescription>
              {t("console.ranks.deleteConfirm", {
                name: confirmRow?.ko || "",
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirm({ open: false })}
            >
              {t("console.cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (confirm.key) removeRow(confirm.key);
                setConfirm({ open: false });
              }}
            >
              {t("console.ranks.removeRow")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
