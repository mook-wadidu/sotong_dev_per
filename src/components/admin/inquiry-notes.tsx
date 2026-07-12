"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  Button,
  toast,
} from "@/components/ui";
import { listSupportNotes, addSupportNote } from "@/lib/actions";
import type { SupportNote } from "@/lib/db/types";

/**
 * 고객센터 이슈 메모 — 상담 행에서 Sheet 로 열어 메모 목록 조회 + 추가.
 * 행 클릭(EMR 이동)과 충돌 방지: 트리거 셀에서 이벤트 전파 차단.
 */
export function InquiryNotes({
  consultationId,
  title,
}: {
  consultationId: string;
  title: string;
}) {
  const t = useTranslations("Admin");
  const [open, setOpen] = React.useState(false);
  const [notes, setNotes] = React.useState<SupportNote[] | null>(null);
  const [body, setBody] = React.useState("");
  const [pending, setPending] = React.useState(false);

  const load = async () => {
    setNotes(null);
    const res = await listSupportNotes(consultationId);
    if (res.ok) setNotes(res.notes);
    else {
      toast.error(res.error);
      setNotes([]);
    }
  };

  const onOpen = () => {
    setOpen(true);
    void load();
  };

  const submit = async () => {
    if (!body.trim()) return;
    setPending(true);
    const res = await addSupportNote({ consultationId, body: body.trim() });
    setPending(false);
    if (res.ok) {
      setBody("");
      setNotes((n) => [res.note, ...(n ?? [])]);
    } else {
      toast.error(res.error);
    }
  };

  return (
    <span onClick={(e) => e.stopPropagation()}>
      <Button type="button" variant="outline" size="sm" onClick={onOpen}>
        {t("inquiries.notes")}
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent closeLabel={t("nav.close")}>
          <SheetHeader>
            <SheetTitle>{t("inquiries.notesTitle")}</SheetTitle>
          </SheetHeader>
          <p className="mb-4 line-clamp-2 text-sm text-muted-foreground">
            {title}
          </p>

          {/* 추가 */}
          <div className="space-y-2">
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
              placeholder={t("inquiries.notePlaceholder")}
              className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground"
            />
            <Button
              type="button"
              size="sm"
              onClick={submit}
              disabled={pending || !body.trim()}
            >
              {pending ? t("inquiries.noteSaving") : t("inquiries.noteAdd")}
            </Button>
          </div>

          {/* 목록 */}
          <div className="mt-5 space-y-2.5">
            {notes === null ? (
              <p className="text-sm text-muted-foreground">
                {t("inquiries.noteLoading")}
              </p>
            ) : notes.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("inquiries.noteEmpty")}
              </p>
            ) : (
              notes.map((n) => (
                <div
                  key={n.id}
                  className="rounded-lg border border-border bg-card p-3"
                >
                  <p className="whitespace-pre-line text-sm text-foreground">
                    {n.body}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                    {n.createdAt.slice(0, 16).replace("T", " ")}
                    {n.author ? ` · ${n.author}` : ""}
                  </p>
                </div>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>
    </span>
  );
}
