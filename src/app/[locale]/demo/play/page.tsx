import { DemoPlayer } from "@/components/demo/demo-player";

/**
 * /demo/play — 기존 데모 화면(폰으로 보는 세일즈 자산, 완전 하드코딩).
 * 랜딩(/demo)의 "30초 데모 보기" CTA가 이리로 넘어온다. 로케일 무관.
 */
export const metadata = {
  title: "소통 데모 · Sotong demo",
};

export default function DemoPlayPage() {
  return <DemoPlayer />;
}
