import IntroDemoFunnel from "@/components/intro-demo/IntroDemoFunnel";
import { trackEvent } from "@/lib/track";

/**
 * /demo — demo_intro 랜딩+인터랙티브 데모를 이식한 자기완결형 세일즈 페이지.
 * 로케일 무관(한국어 마케팅, 폰 안 콘텐츠는 데모 시나리오 하드코딩).
 * 구 DemoPlayer(`@/components/demo/demo-player`)는 롤백용으로 남겨둠(미사용).
 */
export const metadata = {
  title: "소통 데모 · Sotong demo",
  description:
    "손님은 자기 언어로, 디자이너는 한국어로 — 소통이 실제로 어떻게 작동하는지 확인해 보세요.",
};

// 조회수 트래킹을 위해 매 요청 렌더(정적 캐시 아님).
export const dynamic = "force-dynamic";

export default async function DemoPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await trackEvent("demo_view", { locale }); // /demo 조회수
  return <IntroDemoFunnel />;
}
