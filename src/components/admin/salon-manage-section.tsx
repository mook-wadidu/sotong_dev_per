"use client";

import { useRouter } from "next/navigation";
import { SalonManage } from "@/components/admin/salon-manage";
import { SalonConsole } from "@/components/salon-console/salon-console";
import type { AdminSalon } from "@/lib/db/types";
import type { SalonConsole as SalonConsoleData } from "@/lib/actions";

/**
 * 어드민 "지점 관리" 섹션 — 접속 정보 패널(SalonManage) + 전체 편집(SalonConsole) 임베드.
 * 서버 컴포넌트(page.tsx)는 함수를 props 로 못 넘기므로, refresh 콜백을 여기서 제공한다.
 * onChanged → router.refresh() → 어드민 서버 컴포넌트 재실행(재조회).
 */
export function SalonManageSection({
  ownerToken,
  origin,
  salon,
  data,
}: {
  ownerToken: string;
  origin: string;
  /** getAdminData 의 AdminSalon (공용/디자이너 입장 토큰 보유) */
  salon: AdminSalon;
  /** getSalonConsole 결과 (메뉴·디자이너·직급·QR·접수 전체) */
  data: SalonConsoleData;
}) {
  const router = useRouter();
  const refresh = () => router.refresh();

  return (
    <div className="space-y-6">
      <SalonManage
        ownerToken={ownerToken}
        origin={origin}
        salon={salon}
        designerEntries={data.designerEntries}
        onChanged={refresh}
      />
      <SalonConsole ownerToken={ownerToken} origin={origin} data={data} />
    </div>
  );
}
