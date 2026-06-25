-- 소통(Sotong) — 0007 디자이너용 리포트 토큰
-- completeConsultation 이 손님용 reportToken(손님 언어) 외에 디자이너용 ko 리포트
-- 토큰을 별도 발급한다. Consultation.designerReportToken 의 영속 컬럼.
--
-- 비파괴·멱등: add column if not exists (nullable) + unique. 기존 상담 안전.
-- 메인이 supabase db push 로 적용.

alter table public.consultations
  add column if not exists designer_report_token text unique;
