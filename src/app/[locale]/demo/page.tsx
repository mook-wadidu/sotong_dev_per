import { headers } from "next/headers";
import { DemoPlayer } from "@/components/demo/demo-player";

/**
 * MVP 데모 — QR 하나로 손님 전체 여정을 탭으로 재생(완전 하드코딩, 백엔드 0).
 * QR 절대 URL 은 요청 Host 로 서버에서 만든다(클라 origin·hydration 의존 제거).
 */
export const metadata = {
  title: "소통 데모 · Sotong demo",
};

export default async function DemoPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const h = await headers();
  const host = h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  const url = host ? `${proto}://${host}/${locale}/demo` : "";
  return <DemoPlayer url={url} />;
}
