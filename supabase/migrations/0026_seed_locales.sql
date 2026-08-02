-- locales 참조 테이블 seed.
-- 0001_core 는 public.locales 테이블만 생성하고 seed(ko/ja/en/zh)는 마이그 밖(수동)에
-- 있었다. 그래서 스키마만 이전한 새 프로젝트(2026-08 서울 이전)엔 이 데이터가 없어
-- consultations.customer_locale 의 FK(→ locales.code)가 깨지고 상담 생성이 500 났다.
-- 마이그로 박아 어떤 새 프로젝트에도 자동 적용되게 한다(idempotent).
insert into public.locales (code, label, is_customer, sort_order) values
  ('ko', '한국어', true, 1),
  ('ja', '日本語', true, 2),
  ('en', 'English', true, 3),
  ('zh', '中文', true, 4)
on conflict (code) do nothing;
