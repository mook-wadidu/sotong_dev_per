-- 0029: 시술 전 동의 핸드셰이크 (B동의) — "시술 시작"을 손님 동의 뒤로 게이트.
--   * plan_ready_at        — 디자이너 "시술 시작" 1차 press(동의여부 무관 set-if-null): 동의 요청 시점.
--                            (미동의여도 기록 → "요청→확인" 구간 측정 시작점 보존.)
--   * customer_consented_at — 손님 [확인했어요] 시점.
-- 둘 다 set-if-null. status enum 무변경(consulting 유지, 손님 확인 후 startService 로 in_service).
alter table public.consultations
  add column if not exists plan_ready_at timestamptz,
  add column if not exists customer_consented_at timestamptz;
