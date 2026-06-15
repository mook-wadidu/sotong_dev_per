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

/**
 * 살롱 오너 콘솔 셸 — 탭(메뉴/디자이너/QR/문의).
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
    <Tabs defaultValue="menu">
      <TabsList>
        <TabsTrigger value="menu">{t("console.tabs.menu")}</TabsTrigger>
        <TabsTrigger value="designers">
          {t("console.tabs.designers")}
        </TabsTrigger>
        <TabsTrigger value="qr">{t("console.tabs.qr")}</TabsTrigger>
        <TabsTrigger value="inquiries">
          {t("console.tabs.inquiries")}
        </TabsTrigger>
      </TabsList>

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
        <ConsoleInquiriesTab consultations={data.consultations} />
      </TabsContent>
    </Tabs>
  );
}
