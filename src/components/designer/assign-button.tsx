"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button, toast } from "@/components/ui";
import { assignConsultation } from "@/lib/actions";

/**
 * 미배정 상담을 '내 손님으로 가져오기' — 디자이너 인박스의 unassigned 항목용.
 * staffToken(본인) + consultationToken(=designerToken) 으로 배정 후 새로고침.
 */
export function AssignButton({
  staffToken,
  consultationToken,
  labels,
}: {
  staffToken: string;
  consultationToken: string;
  labels: {
    assign: string;
    assigning: string;
    assigned: string;
    failed: string;
  };
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  const onClick = React.useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (pending) return;
      setPending(true);
      try {
        const res = await assignConsultation(staffToken, consultationToken);
        if (res.ok) {
          toast.success(labels.assigned);
          router.refresh();
        } else {
          toast.error(labels.failed);
        }
      } catch {
        toast.error(labels.failed);
      } finally {
        setPending(false);
      }
    },
    [pending, staffToken, consultationToken, labels, router],
  );

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={onClick}
      disabled={pending}
    >
      {pending ? labels.assigning : labels.assign}
    </Button>
  );
}
