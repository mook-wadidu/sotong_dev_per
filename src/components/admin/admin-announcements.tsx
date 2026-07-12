"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, toast } from "@/components/ui";
import { createAnnouncement, setAnnouncementActive } from "@/lib/actions";
import type { Announcement, AnnouncementAudience } from "@/lib/db/types";
import type { Locale } from "@/lib/domain/types";

const LOCALES: Locale[] = ["ko", "ja", "en", "zh"];
const emptyText = (): Record<Locale, string> => ({ ko: "", ja: "", en: "", zh: "" });
const trimmed = (m: Record<Locale, string>): Partial<Record<Locale, string>> => {
  const out: Partial<Record<Locale, string>> = {};
  for (const l of LOCALES) if (m[l].trim()) out[l] = m[l].trim();
  return out;
};

/**
 * 공지 관리(어드민) — 생성 폼 + 목록 + 활성 토글.
 * title/body 는 ko 우선 입력(다국어 입력·노출 서피스는 후속). 흑백.
 */
export function AdminAnnouncements({ items }: { items: Announcement[] }) {
  const t = useTranslations("Admin");
  const router = useRouter();
  const [titles, setTitles] = React.useState<Record<Locale, string>>(emptyText);
  const [bodies, setBodies] = React.useState<Record<Locale, string>>(emptyText);
  const [lang, setLang] = React.useState<Locale>("ko");
  const [audience, setAudience] =
    React.useState<AnnouncementAudience>("platform");
  const [pending, setPending] = React.useState(false);

  const audiences: AnnouncementAudience[] = ["platform", "salon", "customer"];

  const setTitle = (v: string) =>
    setTitles((m) => ({ ...m, [lang]: v }));
  const setBody = (v: string) => setBodies((m) => ({ ...m, [lang]: v }));

  const submit = async () => {
    if (!titles.ko.trim()) {
      toast.error(t("notices.needTitle")); // ko 필수
      setLang("ko");
      return;
    }
    setPending(true);
    const res = await createAnnouncement({
      title: trimmed(titles),
      body: trimmed(bodies),
      audience,
    });
    setPending(false);
    if (res.ok) {
      toast.success(t("notices.created"));
      setTitles(emptyText());
      setBodies(emptyText());
      setLang("ko");
      router.refresh();
    } else {
      toast.error(res.error);
    }
  };

  const toggle = async (a: Announcement) => {
    const res = await setAnnouncementActive(a.id, !a.active);
    if (res.ok) router.refresh();
    else toast.error(res.error);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* 생성 폼 */}
      <section className="space-y-3 rounded-xl border border-border bg-card p-4 sm:p-5">
        <h2 className="text-base font-semibold leading-tight">
          {t("notices.newTitle")}
        </h2>
        {/* 언어 탭 — ko 필수, 나머지 선택(비우면 ko 폴백) */}
        <div className="flex flex-wrap gap-1.5">
          {LOCALES.map((l) => {
            const filled = !!titles[l].trim() || !!bodies[l].trim();
            return (
              <button
                key={l}
                type="button"
                onClick={() => setLang(l)}
                aria-pressed={lang === l}
                className={
                  lang === l
                    ? "inline-flex h-8 items-center rounded-lg bg-foreground px-3 text-xs font-medium uppercase text-background"
                    : "inline-flex h-8 items-center rounded-lg border border-border bg-card px-3 text-xs font-medium uppercase text-foreground hover:bg-muted"
                }
              >
                {l}
                {l === "ko" ? " *" : filled ? " •" : ""}
              </button>
            );
          })}
        </div>
        <label className="block space-y-1">
          <span className="text-xs font-medium text-muted-foreground">
            {t("notices.field.title")}
          </span>
          <input
            value={titles[lang]}
            onChange={(e) => setTitle(e.target.value)}
            className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-foreground"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-medium text-muted-foreground">
            {t("notices.field.body")}
          </span>
          <textarea
            value={bodies[lang]}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground"
          />
        </label>
        <div className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground">
            {t("notices.field.audience")}
          </span>
          <div className="flex flex-wrap gap-2">
            {audiences.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setAudience(a)}
                aria-pressed={audience === a}
                className={
                  audience === a
                    ? "inline-flex h-9 items-center rounded-lg bg-foreground px-3 text-sm font-medium text-background"
                    : "inline-flex h-9 items-center rounded-lg border border-border bg-card px-3 text-sm font-medium text-foreground hover:bg-muted"
                }
              >
                {t(`notices.audience.${a}` as never)}
              </button>
            ))}
          </div>
        </div>
        <Button type="button" onClick={submit} disabled={pending}>
          {pending ? t("notices.creating") : t("notices.create")}
        </Button>
      </section>

      {/* 목록 */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold leading-tight">
          {t("notices.listTitle")}
        </h2>
        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card/50 p-12 text-center text-sm text-muted-foreground">
            {t("notices.empty")}
          </div>
        ) : (
          <ul className="space-y-2.5">
            {items.map((a) => (
              <li
                key={a.id}
                className="rounded-xl border border-border bg-card p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center rounded border border-border px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                        {t(`notices.audience.${a.audience}` as never)}
                      </span>
                      {!a.active ? (
                        <span className="inline-flex items-center rounded border border-dashed border-border px-1.5 py-0.5 text-xs text-muted-foreground">
                          {t("notices.inactive")}
                        </span>
                      ) : null}
                    </div>
                    <h3 className="mt-1.5 truncate font-semibold leading-tight">
                      {a.title.ko ?? Object.values(a.title)[0] ?? "—"}
                    </h3>
                    {a.body.ko ? (
                      <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
                        {a.body.ko}
                      </p>
                    ) : null}
                    <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                      {a.createdAt.slice(0, 10)}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => toggle(a)}
                  >
                    {a.active
                      ? t("notices.deactivate")
                      : t("notices.activate")}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
