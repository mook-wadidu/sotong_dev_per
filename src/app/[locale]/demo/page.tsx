import { DemoPlayer } from "@/components/demo/demo-player";

/**
 * MVP 데모 — 큰 그레이 나래이션 + "이어서 보기"로 구간 자동재생(완전 하드코딩, 백엔드 0).
 * 폰으로 보는 세일즈 자산이라 QR/절대 URL 불필요.
 */
export const metadata = {
  title: "소통 데모 · Sotong demo",
};

export default function DemoPage() {
  return <DemoPlayer />;
}
