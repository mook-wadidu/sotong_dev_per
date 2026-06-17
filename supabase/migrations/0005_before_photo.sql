-- 소통(Sotong) — 0005 시술 전(before) 사진
-- 디자이너가 요약 단계에서 '시술 전' 사진을 촬영해 상담건에 보존한다.
-- completeConsultation 이 리포트 발송 시 이 값을 before 로 우선 사용(없으면 폼 입력 폴백).
--
-- 비파괴·멱등: add column if not exists 만 사용. 기존 행은 안전(새 컬럼 nullable).
-- 메인이 supabase db push 로 적용.

alter table public.consultations
  add column if not exists before_photo_url text;
