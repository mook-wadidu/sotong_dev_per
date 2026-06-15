import { Badge } from "@/components/ui";
import type { ConsultationStatus } from "@/lib/domain/types";

/**
 * 상담 상태 → Badge variant + 라벨.
 * 색만으로 의미를 전달하지 않도록 항상 텍스트 라벨을 동반한다(P1).
 * 라벨은 Designer.inbox.* 키에서 받아 넘긴다(ko 고정).
 * Phase 2: 상태를 대기(intake·consulting) / 진행중(in_service) / 완료(completed)로
 * 단순화 — 대기 두 상태는 같은 비주얼(outline)로 묶는다.
 */
const VARIANT: Record<
  ConsultationStatus,
  "info" | "accent" | "warning" | "success" | "outline"
> = {
  intake: "outline",
  consulting: "outline",
  in_service: "warning",
  completed: "success",
  cancelled: "outline",
};

export function StatusBadge({
  status,
  label,
}: {
  status: ConsultationStatus;
  label: string;
}) {
  return <Badge variant={VARIANT[status]}>{label}</Badge>;
}
