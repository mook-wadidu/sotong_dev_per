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
  FormField,
  Input,
  RadioGroup,
  toast,
} from "@/components/ui";
import { SalonQR } from "@/components/admin/salon-qr";
import { CopyButton } from "@/components/admin/copy-button";
import { salonUpsertDesigner, createSalonInvite } from "@/lib/actions";
import type { Designer, DesignerRank } from "@/lib/db/types";
import type { SalonConsole as SalonConsoleData } from "@/lib/actions";
import { RanksEditor } from "./ranks-editor";

type DesignerEntry = SalonConsoleData["designerEntries"][number];

export function DesignersTab({
  ownerToken,
  origin,
  designers,
  designerEntries,
  ranks,
  salonName,
  onChanged,
}: {
  ownerToken: string;
  origin: string;
  designers: Designer[];
  designerEntries: DesignerEntry[];
  ranks: DesignerRank[];
  salonName: string;
  onChanged: () => void;
}) {
  const t = useTranslations("Admin");
  const [form, setForm] = React.useState<{ open: boolean; edit?: Designer }>({
    open: false,
  });
  const [inviteUrl, setInviteUrl] = React.useState<string | null>(null);
  const [inviting, setInviting] = React.useState(false);

  const onInvite = async () => {
    setInviting(true);
    const res = await createSalonInvite(ownerToken);
    setInviting(false);
    if (res.ok) {
      setInviteUrl(origin ? origin + res.path : res.path);
      toast.success(t("console.invite.created"));
    } else {
      toast.error(res.error);
    }
  };

  const entryById = React.useMemo(() => {
    const m = new Map<string, DesignerEntry>();
    for (const e of designerEntries) m.set(e.id, e);
    return m;
  }, [designerEntries]);

  // 콘솔은 ko 고정 뷰 — 직급 라벨(LocalizedText)에서 ko 만 표기(다국어 입력은 Phase 2).
  const rankLabel = (rankId?: string) =>
    ranks.find((r) => r.id === rankId)?.label.ko;

  const qrLabels = {
    copy: t("qr.copy"),
    copied: t("qr.copied"),
    print: t("qr.print"),
  };

  return (
    <div className="space-y-6">
      <RanksEditor
        ownerToken={ownerToken}
        ranks={ranks}
        onChanged={onChanged}
      />

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {t("console.designers.hint")}
        </p>
        <div className="flex shrink-0 gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={onInvite}
            disabled={inviting}
          >
            {t("console.invite.button")}
          </Button>
          <Button size="sm" onClick={() => setForm({ open: true })}>
            {t("console.designers.add")}
          </Button>
        </div>
      </div>

      {inviteUrl ? (
        <div className="space-y-2 rounded-xl border border-border bg-muted/30 p-4">
          <p className="text-xs font-medium text-muted-foreground">
            {t("console.invite.hint")}
          </p>
          <div className="flex items-center justify-between gap-2">
            <p className="truncate font-mono text-xs text-foreground">
              {inviteUrl}
            </p>
            <CopyButton value={inviteUrl} label={qrLabels.copy} />
          </div>
        </div>
      ) : null}

      {designers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/50 p-12 text-center text-sm text-muted-foreground">
          {t("console.designers.empty")}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {designers.map((d) => {
            const entry = entryById.get(d.id);
            return (
              <section
                key={d.id}
                className="rounded-xl border border-border bg-card p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold leading-tight">
                      {d.name}
                    </h3>
                    <div className="mt-1">
                      {rankLabel(d.rankId) ? (
                        <Badge variant="outline">{rankLabel(d.rankId)}</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {t("console.designers.noRank")}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setForm({ open: true, edit: d })}
                  >
                    {t("console.edit")}
                  </Button>
                </div>

                {entry ? (
                  <div className="mt-4 space-y-3 border-t border-border pt-4">
                    <SalonQR
                      entryUrl={
                        origin ? origin + entry.entryPath : entry.entryPath
                      }
                      entryPath={entry.entryPath}
                      salonName={`${salonName} · ${d.name}`}
                      labels={qrLabels}
                    />
                    <a
                      href={entry.inboxPath}
                      className="block truncate rounded-lg border border-border px-3 py-2 text-center text-sm font-medium text-foreground transition-colors hover:bg-muted"
                    >
                      {t("console.designers.inboxLink")}
                    </a>
                    <div className="flex justify-center">
                      <CopyButton
                        value={d.staffToken}
                        label={t("console.designers.token")}
                      />
                    </div>
                  </div>
                ) : null}
              </section>
            );
          })}
        </div>
      )}

      <DesignerDialog
        key={form.open ? form.edit?.id ?? "new" : "closed"}
        ownerToken={ownerToken}
        open={form.open}
        edit={form.edit}
        ranks={ranks}
        onOpenChange={(open) => setForm((s) => ({ ...s, open }))}
        onChanged={onChanged}
      />
    </div>
  );
}

function DesignerDialog({
  ownerToken,
  open,
  edit,
  ranks,
  onOpenChange,
  onChanged,
}: {
  ownerToken: string;
  open: boolean;
  edit?: Designer;
  ranks: DesignerRank[];
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
}) {
  const t = useTranslations("Admin");
  const [name, setName] = React.useState(edit?.name ?? "");
  const [rankId, setRankId] = React.useState<string>(edit?.rankId ?? "");
  const [pending, setPending] = React.useState(false);

  const rankOptions = [
    { value: "", label: t("console.designers.noRank") },
    ...ranks.map((r) => ({ value: r.id, label: r.label.ko })),
  ];

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error(t("console.designers.nameRequired"));
      return;
    }
    setPending(true);
    const res = await salonUpsertDesigner({
      ownerToken,
      id: edit?.id,
      name: name.trim(),
      rankId: rankId || undefined,
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
            {edit
              ? t("console.designers.editTitle")
              : t("console.designers.addTitle")}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <FormField label={t("console.designers.name")} required>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="김민지"
            />
          </FormField>
          <div>
            <p className="mb-2 text-sm font-semibold text-foreground">
              {t("console.designers.rank")}
            </p>
            <RadioGroup
              label={t("console.designers.rank")}
              value={rankId}
              onValueChange={setRankId}
              options={rankOptions}
            />
          </div>
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
