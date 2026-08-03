-- 0028: 입력중 신호 (B2) — 디자이너가 모발상태를 입력하는 "가장 긴 사각지대"를 손님 화면에 표시.
-- designer_viewed_at(열람)과 별개로, 디자이너가 실제 입력을 시작한 시점(첫 상호작용).
-- set-if-null(0027 패턴), status enum 무변경.
alter table public.consultations
  add column if not exists designer_editing_at timestamptz;
