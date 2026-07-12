"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, toast } from "@/components/ui";
import { respondMembership } from "@/lib/actions";
import type { MembershipRequest } from "@/lib/db/types";

export interface MembershipRequestsLabels {
  title: string;
  empty: string;
  accept: string;
  decline: string;
  joinLabel: string; // "{salon} 합류 요청" — {salon} 치환
}

/**
 * 받은 소속 요청 — 디자이너가 수락/거절. 수락 시 소속 확정 → refresh 하면
 * /login 이 인박스로 라우팅(더 이상 미소속 아님).
 */
export function MembershipRequests({
  initial,
  labels,
}: {
  initial: MembershipRequest[];
  labels: MembershipRequestsLabels;
}) {
  const router = useRouter();
  const [reqs, setReqs] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);

  const respond = async (id: string, accept: boolean) => {
    setBusy(id);
    const res = await respondMembership(id, accept);
    setBusy(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setReqs((r) => r.filter((x) => x.id !== id));
    // 수락이면 소속 확정 → 리로드로 인박스 라우팅.
    if (accept) window.location.reload();
    else router.refresh();
  };

  return (
    <div className="w-full max-w-sm space-y-3 text-left">
      <p className="text-sm font-semibold text-foreground">{labels.title}</p>
      {reqs.length === 0 ? (
        <p className="text-sm text-muted-foreground">{labels.empty}</p>
      ) : (
        <ul className="space-y-2.5">
          {reqs.map((r) => (
            <li
              key={r.id}
              className="rounded-xl border border-border bg-card p-4"
            >
              <p className="text-sm font-medium text-foreground">
                {labels.joinLabel.replace("{salon}", r.salonName ?? r.salonSlug)}
              </p>
              <div className="mt-3 flex gap-2">
                <Button
                  size="sm"
                  onClick={() => respond(r.id, true)}
                  disabled={busy === r.id}
                >
                  {labels.accept}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => respond(r.id, false)}
                  disabled={busy === r.id}
                >
                  {labels.decline}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
