"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import {
  Button,
  Input,
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

/**
 * 직급 편집기 — 콘솔/어드민 공통.
 * 전체 직급 목록을 통째로 보내는 액션(salonUpdateRanks) 규약을 따른다(델타 아님).
 * - 기존 직급은 id 유지(라벨만 바꿔도 같은 id 로 보냄).
 * - 신규 직급은 라틴 라벨이면 안정적 slug id 를 붙이고, 그 외(한글 등)는 id 미지정 →
 *   액션이 service.ts normalizeRankId 규칙으로 생성한다.
 */

type Row = {
  /** 안정 key (렌더 전용). 기존 직급은 직급 id, 신규는 임시 uid. */
  key: string;
  /** 기존 직급 id (신규면 undefined → 액션이 생성). */
  id?: string;
  label: string;
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
    () => ranks.map((r) => ({ key: r.id, id: r.id, label: r.label })),
    [ranks],
  );
  const [rows, setRows] = React.useState<Row[]>(initial);
  const [pending, setPending] = React.useState(false);
  const [confirm, setConfirm] = React.useState<{ open: boolean; key?: string }>(
    { open: false },
  );

  // 서버 데이터(refresh)로 props 가 바뀌면 편집 상태를 재동기화 — effect 대신
  // "prop 변화 시 렌더 중 state 조정" 패턴(이전 props 식별자를 추적).
  const [prevRanks, setPrevRanks] = React.useState(ranks);
  if (prevRanks !== ranks) {
    setPrevRanks(ranks);
    setRows(initial);
  }

  const dirty = React.useMemo(() => {
    if (rows.length !== initial.length) return true;
    return rows.some((r, i) => {
      const o = initial[i];
      return !o || o.id !== r.id || o.label !== r.label;
    });
  }, [rows, initial]);

  const setLabel = (key: string, label: string) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, label } : r)));

  const addRow = () =>
    setRows((rs) => [...rs, { key: nextKey(), label: "" }]);

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
    const cleaned = rows.map((r) => ({ ...r, label: r.label.trim() }));
    if (cleaned.some((r) => !r.label)) {
      toast.error(t("console.ranks.nameRequired"));
      return;
    }
    const payload: DesignerRank[] = cleaned.map((r) => ({
      // 기존 직급은 id 유지; 신규는 라틴 slug 가 있으면 그걸로 안정화, 없으면 액션 위임.
      id: r.id ?? latinSlug(r.label) ?? "",
      label: r.label,
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
        <ul className="mt-4 space-y-2">
          {rows.map((row) => (
            <li key={row.key} className="flex items-center gap-2">
              <Input
                value={row.label}
                onChange={(e) => setLabel(row.key, e.target.value)}
                placeholder={t("console.ranks.namePlaceholder")}
                aria-label={t("console.ranks.title")}
              />
              <Button
                size="sm"
                variant="ghost"
                onClick={() => requestRemove(row)}
                aria-label={t("console.ranks.removeRow")}
              >
                {t("console.ranks.removeRow")}
              </Button>
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
                name: confirmRow?.label || "",
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
