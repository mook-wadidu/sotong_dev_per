"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui";
import type { SalonConsole as SalonConsoleData } from "@/lib/actions";
import { MenuTab } from "./menu-tab";
import { DesignersTab } from "./designers-tab";
import { ConsoleQrTab } from "./qr-tab";
import { ConsoleInquiriesTab } from "./inquiries-tab";
import { OwnerAnalyticsTab } from "./owner-analytics-tab";
import { OwnerDesignersTab } from "./owner-designers-tab";
import { OwnerReportsTab } from "./owner-reports-tab";
import { OwnerMembersTab } from "./owner-members-tab";

/**
 * 살롱 오너 콘솔 셸 — 탭(문의·리포트/디자이너/메뉴/QR).
 * 일상 사용(문의·리포트)을 첫 탭으로, 세팅성(메뉴·QR)은 뒤로.
 * 편집 액션은 각 탭이 server action 을 호출한 뒤 router.refresh() 로 재로드한다.
 */
export function SalonConsole({
  ownerToken,
  origin,
  data,
}: {
  ownerToken: string;
  origin: string;
  data: SalonConsoleData;
}) {
  const t = useTranslations("Admin");
  const router = useRouter();
  const refresh = React.useCallback(() => router.refresh(), [router]);

  return (
    <Tabs defaultValue="inquiries">
      <TabsList>
        <TabsTrigger value="inquiries">
          {t("console.tabs.inquiries")}
        </TabsTrigger>
        <TabsTrigger value="analytics">
          {t("console.tabs.analytics")}
        </TabsTrigger>
        <TabsTrigger value="performance">
          {t("console.tabs.performance")}
        </TabsTrigger>
        <TabsTrigger value="reports">{t("console.tabs.reports")}</TabsTrigger>
        <TabsTrigger value="members">{t("console.tabs.members")}</TabsTrigger>
        <TabsTrigger value="designers">
          {t("console.tabs.designers")}
        </TabsTrigger>
        <TabsTrigger value="menu">{t("console.tabs.menu")}</TabsTrigger>
        <TabsTrigger value="qr">{t("console.tabs.qr")}</TabsTrigger>
      </TabsList>

      <TabsContent value="analytics">
        <OwnerAnalyticsTab ownerToken={ownerToken} />
      </TabsContent>

      <TabsContent value="performance">
        <OwnerDesignersTab ownerToken={ownerToken} />
      </TabsContent>

      <TabsContent value="reports">
        <OwnerReportsTab ownerToken={ownerToken} />
      </TabsContent>

      <TabsContent value="members">
        <OwnerMembersTab
          ownerToken={ownerToken}
          consultations={data.consultations}
        />
      </TabsContent>

      <TabsContent value="menu">
        <MenuTab
          ownerToken={ownerToken}
          categories={data.categories}
          services={data.services}
          ranks={data.salon.designerRanks}
          onChanged={refresh}
        />
      </TabsContent>

      <TabsContent value="designers">
        <DesignersTab
          ownerToken={ownerToken}
          origin={origin}
          designers={data.designers}
          designerEntries={data.designerEntries}
          ranks={data.salon.designerRanks}
          salonName={data.salon.name}
          onChanged={refresh}
        />
      </TabsContent>

      <TabsContent value="qr">
        <ConsoleQrTab
          origin={origin}
          salonName={data.salon.name}
          placement={data.salon.placementLabel ?? data.salon.address}
          designers={data.designers}
          designerEntries={data.designerEntries}
          salonEntryPath={data.salonEntryPath}
        />
      </TabsContent>

      <TabsContent value="inquiries">
        <ConsoleInquiriesTab
          consultations={data.consultations}
          ownerToken={ownerToken}
        />
      </TabsContent>
    </Tabs>
  );
}
