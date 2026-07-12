"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Button, Input, FormField, toast } from "@/components/ui";
import { SalonQR } from "@/components/admin/salon-qr";
import { CopyButton } from "@/components/admin/copy-button";
import {
  rotateSalonEntryKey,
  rotateDesignerEntryKey,
  rotateDesignerStaffToken,
  rotateOwnerToken,
  adminProvisionOwner,
} from "@/lib/actions";
import { salonConsolePath } from "@/lib/links";
import type { AdminSalon } from "@/lib/db/types";
import type { SalonConsole as SalonConsoleData } from "@/lib/actions";

type DesignerEntry = SalonConsoleData["designerEntries"][number];

/**
 * 어드민 살롱 "접속 정보" 패널 — 생성 직후에만 보이던 토큰/링크를 상시 재확인.
 * - owner 토큰 + 콘솔 링크(절대 URL)
 * - 살롱 공용 QR + 디자이너별 입장 QR
 * - 디자이너별 입장/인박스 토큰·링크(복사)
 * QR 재발급은 기존 rotate 액션 재사용(저장 후 onChanged → 서버 재조회).
 */
export function SalonManage({
  ownerToken,
  origin,
  salon,
  designerEntries,
  onChanged,
}: {
  ownerToken: string;
  origin: string;
  /** getAdminData 의 AdminSalon (공용 입장 토큰/경로 + 디자이너 입장 토큰 보유) */
  salon: AdminSalon;
  /** getSalonConsole 의 designerEntries (inboxPath 포함) */
  designerEntries: DesignerEntry[];
  onChanged: () => void;
}) {
  const t = useTranslations("Admin");

  const consoleUrl = origin
    ? origin + salonConsolePath(ownerToken)
    : salonConsolePath(ownerToken);

  const qrLabels = {
    copy: t("qr.copy"),
    copied: t("qr.copied"),
    print: t("qr.print"),
  };

  const entryById = React.useMemo(() => {
    const m = new Map<string, DesignerEntry>();
    for (const e of designerEntries) m.set(e.id, e);
    return m;
  }, [designerEntries]);

  const [rotatingSalon, setRotatingSalon] = React.useState(false);
  const [rotatingDesigner, setRotatingDesigner] = React.useState<string | null>(
    null,
  );
  const [rotatingInbox, setRotatingInbox] = React.useState<string | null>(null);
  const [rotatingOwner, setRotatingOwner] = React.useState(false);

  const onRotateOwner = async () => {
    if (!window.confirm(t("manage.rotateOwnerConfirm"))) return;
    setRotatingOwner(true);
    const res = await rotateOwnerToken(ownerToken);
    setRotatingOwner(false);
    if (res.ok) {
      toast.success(t("manage.ownerRotated"));
      // 살롱은 slug 로 식별 → 어드민 페이지 재조회 시 새 ownerToken 으로 패널 갱신.
      onChanged();
    } else {
      toast.error(t("console.error"));
    }
  };

  const onRotateSalon = async () => {
    if (!window.confirm(t("manage.rotateConfirm"))) return;
    setRotatingSalon(true);
    const res = await rotateSalonEntryKey(ownerToken);
    setRotatingSalon(false);
    if (res.ok) {
      toast.success(t("manage.rotated"));
      onChanged();
    } else {
      toast.error(t("console.error"));
    }
  };

  const onRotateDesigner = async (designerId: string) => {
    if (!window.confirm(t("manage.rotateConfirm"))) return;
    setRotatingDesigner(designerId);
    const res = await rotateDesignerEntryKey({ ownerToken, designerId });
    setRotatingDesigner(null);
    if (res.ok) {
      toast.success(t("manage.rotated"));
      onChanged();
    } else {
      toast.error(t("console.error"));
    }
  };

  // 인박스(staff_token) 재발급 — 디자이너 인박스 링크 유출 대응(옛 링크 무효).
  const onRotateInbox = async (designerId: string) => {
    if (!window.confirm(t("manage.rotateInboxConfirm"))) return;
    setRotatingInbox(designerId);
    const res = await rotateDesignerStaffToken({ ownerToken, designerId });
    setRotatingInbox(null);
    if (res.ok) {
      toast.success(t("manage.rotated"));
      onChanged(); // 재조회 → inboxPath 가 새 토큰으로 갱신
    } else {
      toast.error(t("console.error"));
    }
  };

  const placement = salon.placementLabel ?? salon.address;

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="border-b border-border pb-3">
        <h3 className="font-semibold leading-tight">{t("manage.title")}</h3>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {t("manage.hint")}
        </p>
      </div>

      {/* 토큰/링크 */}
      <div className="mt-4 space-y-2">
        <CredRow label={t("manage.ownerToken")} value={ownerToken} />
        <CredRow label={t("manage.consoleLink")} value={consoleUrl} />
        <div className="flex justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRotateOwner}
            disabled={rotatingOwner}
          >
            {t("manage.rotateOwner")}
          </Button>
        </div>
        {/* 오너 계정(로그인) — 없으면 발급(백필) */}
        <OwnerAccountRow ownerToken={ownerToken} salon={salon} />
      </div>

      {/* QR */}
      <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <div className="flex flex-col gap-2">
          <p className="text-center text-sm font-medium text-accent-text">
            {t("qr.sharedLabel")}
          </p>
          <SalonQR
            entryUrl={
              origin ? origin + salon.salonEntryPath : salon.salonEntryPath
            }
            entryPath={salon.salonEntryPath}
            salonName={`${salon.name} · ${t("qr.sharedLabel")}`}
            placement={placement}
            labels={qrLabels}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRotateSalon}
            disabled={rotatingSalon}
          >
            {t("manage.rotate")}
          </Button>
        </div>

        {salon.designers.map((d) => {
          const entry = entryById.get(d.id);
          return (
            <div key={d.id} className="flex flex-col gap-2">
              <p className="text-center text-sm font-medium text-foreground">
                {d.name}
              </p>
              <SalonQR
                entryUrl={origin ? origin + d.entryPath : d.entryPath}
                entryPath={d.entryPath}
                salonName={`${salon.name} · ${d.name}`}
                placement={placement}
                labels={qrLabels}
              />
              {entry ? (
                <a
                  href={entry.inboxPath}
                  className="block truncate rounded-lg border border-border px-3 py-2 text-center text-sm font-medium text-foreground transition-colors hover:bg-muted"
                >
                  {t("console.designers.inboxLink")}
                </a>
              ) : null}
              <div className="flex flex-wrap justify-center gap-1.5">
                <CopyButton
                  value={d.staffToken}
                  label={t("console.designers.token")}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onRotateDesigner(d.id)}
                  disabled={rotatingDesigner === d.id}
                >
                  {t("manage.rotate")}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onRotateInbox(d.id)}
                  disabled={rotatingInbox === d.id}
                >
                  {t("manage.rotateInbox")}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** 토큰/링크 1행 — 복사 버튼 포함. */
/** 오너 로그인 계정 — 있으면 표시, 없으면 이메일로 발급(백필). */
function OwnerAccountRow({
  ownerToken,
  salon,
}: {
  ownerToken: string;
  salon: AdminSalon;
}) {
  const t = useTranslations("Admin");
  const [email, setEmail] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [pw, setPw] = React.useState<string | null>(null);

  if (salon.ownerEmail) {
    return (
      <p className="pt-1 text-xs text-muted-foreground">
        {t("console.account.has", { email: salon.ownerEmail })}
      </p>
    );
  }
  if (pw !== null) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg border border-border/70 bg-muted/30 px-3 py-2">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">
            {t("onboarding.tempPassword")}
          </p>
          <p className="truncate font-mono text-xs text-foreground">{pw}</p>
        </div>
        <CopyButton value={pw} label={t("qr.copy")} />
      </div>
    );
  }

  const onProvision = async () => {
    const e = email.trim();
    if (!e) return;
    setPending(true);
    const res = await adminProvisionOwner(ownerToken, e);
    setPending(false);
    if (res.ok) {
      setPw(res.tempPassword ?? "");
      toast.success(t("console.account.issued"));
    } else {
      toast.error(res.error ?? t("console.error"));
    }
  };

  return (
    <div className="flex items-end gap-2 pt-1">
      <div className="flex-1">
        <FormField label={t("console.account.ownerEmailLabel")}>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="owner@salon.com"
          />
        </FormField>
      </div>
      <Button
        type="button"
        size="sm"
        onClick={onProvision}
        disabled={pending || !email.trim()}
      >
        {t("console.account.provision")}
      </Button>
    </div>
  );
}

function CredRow({ label, value }: { label: string; value: string }) {
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
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={onCopy}
        aria-label={`${label} ${t("qr.copy")}`}
      >
        {t("qr.copy")}
      </Button>
    </div>
  );
}
