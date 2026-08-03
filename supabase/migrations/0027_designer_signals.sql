-- 0027: 손님 여정 신호 (B1) — 디자이너 진행을 손님 화면에 라이브 반영.
-- present/채팅의 "멈춘 느낌"을 없애려면 디자이너가 어디까지 왔는지 신호가 필요하다.
-- best-effort set-if-null(0012 write-on-read 패턴), status enum 은 건드리지 않는다(낮은 blast radius).
--   * designer_viewed_at — 디자이너가 요약을 연 시점(=손님 "확인 중").
--   * chat_started_at    — 디자이너 "상담 시작"(=손님 채팅 자동입장).
-- RLS: consultations 는 0001 에서 service_role-only(force) → 신규 컬럼 정책 상속(추가 불필요).
alter table public.consultations
  add column if not exists designer_viewed_at timestamptz,
  add column if not exists chat_started_at timestamptz;
