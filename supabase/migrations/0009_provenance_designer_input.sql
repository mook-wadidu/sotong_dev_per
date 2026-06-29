-- 0009: 데이터 출처(provenance) + 디자이너 입력 신체정보 (MVP 수정)
-- 손님이 보던 신체정보(얼굴형·볼륨·머리숱·모질·성별)를 디자이너 전문판단으로 옮기고,
-- AI 학습 가치를 위해 "누가 입력했나(input_by)"·"실제 시술 vs 손님 희망(services_input_by)"을
-- 기록한다. treatment_records 의 salon_id/designer_id 는 0004 에서 이미 추가됨.

-- 디자이너가 요약 화면에서 입력한 신체정보 스냅샷(완료 시 카르테·학습에 반영)
alter table public.consultations
  add column if not exists designer_input jsonb;

-- 카르테: 디자이너 입력 신체정보 영속 + 출처 태그 + 알레르기 디자이너 재확인(안전)
alter table public.treatment_records
  add column if not exists face_shape   face_shape,
  add column if not exists crown_volume three_level,
  add column if not exists hair_density three_level,
  add column if not exists hair_type    hair_type,
  add column if not exists gender       text,
  add column if not exists input_by     text,          -- 신체정보 출처: 'customer' | 'designer'
  add column if not exists services_input_by text,     -- 시술 출처: 'designer'(실제) | 'customer'(희망 폴백)
  add column if not exists allergy_confirmed_by_designer boolean,
  add column if not exists has_before_photo boolean,   -- H4 촬영습관 측정
  add column if not exists has_after_photo  boolean;

-- 학습 샘플: 출처 태그 + 데이터를 받은 디자이너 귀속
alter table public.training_samples
  add column if not exists input_by          text,
  add column if not exists services_input_by text,
  add column if not exists designer_id       text
    references public.staff(id) on delete set null,
  add column if not exists has_before_photo  boolean,
  add column if not exists has_after_photo   boolean;
