"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Button,
  Badge,
  FormField,
  Input,
  RadioGroup,
  toast,
} from "@/components/ui";
import { adminCreateSalon, adminCreateDesigner } from "@/lib/actions";
import type { AdminSalon } from "@/lib/db/types";
import type {
  CreatedDesignerResult,
  CreatedSalonResult,
} from "@/lib/service";

/**
 * 플랫폼 어드민 온보딩 — 살롱 생성 + 디자이너 생성.
 * 생성 후 ownerToken·콘솔 링크·staffToken/QR 경로를 전달용으로 표시한다.
 * 모든 액션은 서버에서 adminKey 를 재검증한다.
 */
export function Onboarding({
  adminKey,
  salons,
  origin,
}: {
  adminKey: string;
  salons: AdminSalon[];
  origin: string;
}) {
  const router = useRouter();

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <SalonForm
        adminKey={adminKey}
        origin={origin}
        onCreated={() => router.refresh()}
      />
      <DesignerForm
        adminKey={adminKey}
        salons={salons}
        origin={origin}
        onCreated={() => router.refresh()}
      />
    </div>
  );
}

/* ── 전달용 경로/토큰 카드 ─────────────────────────────── */
function CredRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  const t = useTranslations("Admin");
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(t("qr.copied"));
    } catch {
      toast.error(t("qr.copy"));
    }
  };
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-border/70 bg-muted/30 px-3 py-2">
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="truncate font-mono text-xs text-foreground">{value}</p>
      </div>
      <Button type="button" size="sm" variant="ghost" onClick={onCopy}>
        {t("qr.copy")}
      </Button>
    </div>
  );
}

/* ── 살롱 생성 ─────────────────────────────────────────── */
function SalonForm({
  adminKey,
  origin,
  onCreated,
}: {
  adminKey: string;
  origin: string;
  onCreated: () => void;
}) {
  const t = useTranslations("Admin");
  const [slug, setSlug] = React.useState("");
  const [name, setName] = React.useState("");
  const [address, setAddress] = React.useState("");
  const [error, setError] = React.useState<string | undefined>();
  const [pending, setPending] = React.useState(false);
  const [created, setCreated] = React.useState<CreatedSalonResult | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(undefined);
    setPending(true);
    const res = await adminCreateSalon(adminKey, {
      slug: slug.trim(),
      name: name.trim(),
      address: address.trim() || undefined,
    });
    setPending(false);
    if (res.ok) {
      setCreated(res.result);
      toast.success(t("onboarding.salonCreated"));
      setSlug("");
      setName("");
      setAddress("");
      onCreated();
    } else {
      setError(res.error);
    }
  };

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <h3 className="font-semibold leading-tight">
        {t("onboarding.salonTitle")}
      </h3>
      <p className="mt-0.5 text-sm text-muted-foreground">
        {t("onboarding.salonHint")}
      </p>
      <form onSubmit={onSubmit} className="mt-4 space-y-4">
        <FormField
          label={t("onboarding.slug")}
          hint={t("onboarding.slugHint")}
          error={error}
          required
        >
          <Input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="salon-gangnam"
            autoComplete="off"
          />
        </FormField>
        <FormField label={t("onboarding.salonName")} required>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="소통 헤어 강남점"
          />
        </FormField>
        <FormField label={t("onboarding.address")}>
          <Input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="서울 강남구 …"
          />
        </FormField>
        <Button type="submit" disabled={pending} className="w-full">
          {t("onboarding.createSalon")}
        </Button>
      </form>

      {created ? (
        <div className="mt-5 space-y-2 border-t border-border pt-4">
          <div className="flex items-center gap-2">
            <Badge variant="success">{t("onboarding.created")}</Badge>
            <span className="text-sm font-medium">{created.salon.name}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            {t("onboarding.shareHint")}
          </p>
          <CredRow
            label={t("onboarding.ownerToken")}
            value={created.salon.ownerToken}
          />
          <CredRow
            label={t("onboarding.consoleLink")}
            value={origin ? origin + created.consolePath : created.consolePath}
          />
        </div>
      ) : null}
    </section>
  );
}

/* ── 디자이너 생성 ─────────────────────────────────────── */
function DesignerForm({
  adminKey,
  salons,
  origin,
  onCreated,
}: {
  adminKey: string;
  salons: AdminSalon[];
  origin: string;
  onCreated: () => void;
}) {
  const t = useTranslations("Admin");
  const [salonSlug, setSalonSlug] = React.useState<string>(
    salons[0]?.slug ?? "",
  );
  const [name, setName] = React.useState("");
  const [rankId, setRankId] = React.useState<string>("");
  const [error, setError] = React.useState<string | undefined>();
  const [pending, setPending] = React.useState(false);
  const [created, setCreated] = React.useState<CreatedDesignerResult | null>(
    null,
  );

  const selectedSalon = salons.find((s) => s.slug === salonSlug);
  const ranks = selectedSalon?.designerRanks ?? [];

  // 살롱이 바뀌면 직급 선택 초기화(이전 살롱 직급일 수 있음)
  const onSalonChange = (slug: string) => {
    setSalonSlug(slug);
    setRankId("");
  };

  const rankOptions = [
    { value: "", label: t("onboarding.noRank") },
    ...ranks.map((r) => ({ value: r.id, label: r.label })),
  ];

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(undefined);
    if (!salonSlug) {
      setError(t("onboarding.selectSalonFirst"));
      return;
    }
    setPending(true);
    const res = await adminCreateDesigner(adminKey, {
      salonSlug,
      name: name.trim(),
      rankId: rankId || undefined,
    });
    setPending(false);
    if (res.ok) {
      setCreated(res.result);
      toast.success(t("onboarding.designerCreated"));
      setName("");
      setRankId("");
      onCreated();
    } else {
      setError(res.error);
    }
  };

  if (salons.length === 0) {
    return (
      <section className="rounded-xl border border-dashed border-border bg-card/50 p-5">
        <h3 className="font-semibold leading-tight">
          {t("onboarding.designerTitle")}
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("onboarding.designerNeedsSalon")}
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <h3 className="font-semibold leading-tight">
        {t("onboarding.designerTitle")}
      </h3>
      <p className="mt-0.5 text-sm text-muted-foreground">
        {t("onboarding.designerHint")}
      </p>
      <form onSubmit={onSubmit} className="mt-4 space-y-4">
        <FormField label={t("onboarding.selectSalon")} required>
          <select
            value={salonSlug}
            onChange={(e) => onSalonChange(e.target.value)}
            className="h-13 w-full rounded-xl border border-input bg-card px-4 text-base text-foreground outline-none transition-colors focus-visible:border-accent focus-visible:ring-1 focus-visible:ring-accent"
          >
            {salons.map((s) => (
              <option key={s.slug} value={s.slug}>
                {s.name}
              </option>
            ))}
          </select>
        </FormField>
        <FormField
          label={t("onboarding.designerName")}
          error={error}
          required
        >
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="김민지"
          />
        </FormField>
        <div>
          <p className="mb-2 text-sm font-semibold text-foreground">
            {t("onboarding.rank")}
          </p>
          <RadioGroup
            label={t("onboarding.rank")}
            value={rankId}
            onValueChange={setRankId}
            options={rankOptions}
          />
        </div>
        <Button type="submit" disabled={pending} className="w-full">
          {t("onboarding.createDesigner")}
        </Button>
      </form>

      {created ? (
        <div className="mt-5 space-y-2 border-t border-border pt-4">
          <div className="flex items-center gap-2">
            <Badge variant="success">{t("onboarding.created")}</Badge>
            <span className="text-sm font-medium">{created.designer.name}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            {t("onboarding.designerShareHint")}
          </p>
          <CredRow
            label={t("onboarding.staffToken")}
            value={created.designer.staffToken}
          />
          <CredRow
            label={t("onboarding.inboxLink")}
            value={origin ? origin + created.inboxPath : created.inboxPath}
          />
          <CredRow
            label={t("onboarding.qrLink")}
            value={origin ? origin + created.entryPath : created.entryPath}
          />
        </div>
      ) : null}
    </section>
  );
}
