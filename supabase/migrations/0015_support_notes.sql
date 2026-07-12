-- 0015_support_notes — 고객센터/운영 인박스 이슈 메모(상담별). 비파괴·멱등.
-- 어드민이 상담 건에 남기는 내부 메모(손님 비노출). error_logs(머신 진단)와 별개 개념.

create table if not exists public.support_notes (
  id              uuid primary key default gen_random_uuid(),
  consultation_id uuid not null references public.consultations(id) on delete cascade,
  body            text not null,
  author          text,                    -- 어드민 이메일 또는 라벨(선택)
  created_at      timestamptz not null default now()
);
create index if not exists idx_support_notes_consultation
  on public.support_notes(consultation_id, created_at desc);

-- RLS force(서버 service-role 전용).
alter table public.support_notes enable row level security;
alter table public.support_notes force row level security;
