import { headers } from "next/headers";
import IntroDemoFunnel from "@/components/intro-demo/IntroDemoFunnel";
import { logVisit } from "@/lib/service";

/**
 * /demo — demo_intro 랜딩+인터랙티브 데모를 이식한 자기완결형 세일즈 페이지.
 * 로케일 무관(한국어 마케팅, 폰 안 콘텐츠는 데모 시나리오 하드코딩).
 * 구 DemoPlayer(`@/components/demo/demo-player`)는 롤백용으로 남겨둠(미사용).
 *
 * 홍보 유입 추적(어드민 확인용): 리플렛 QR 은 순수 `/ko/demo`(표식 없음, 이미 인쇄)로
 * 들어오므로 URL 로는 홈 클릭 유입과 구분할 수 없다. 대신 QR 스캔 = 브라우저의 최상위
 * 문서 로드(`Sec-Fetch-Dest: document`)라는 점을 이용해, document 진입만 방문으로 남긴다.
 * (홈의 "데모 보기"는 Next SPA 전환 → sec-fetch-dest: empty → 제외, 프리페치도 제외.)
 */
export const metadata = {
  title: "소통 데모 · Sotong demo",
  description:
    "손님은 자기 언어로, 디자이너는 한국어로 — 소통이 실제로 어떻게 작동하는지 확인해 보세요.",
};

export default async function DemoPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const h = await headers();

  // 최상위 문서 직접 로드(QR 스캔/주소 직접입력)만 유입으로 기록.
  // Sec-Fetch-Dest 미지원 구형 브라우저는 헤더가 없어 제외된다(모던 모바일은 모두 전송).
  if (h.get("sec-fetch-dest") === "document") {
    await logVisit({
      source: "qr",
      path: `/${locale}/demo`,
      referrer: h.get("referer") ?? undefined,
    });
  }

  return <IntroDemoFunnel />;
}
