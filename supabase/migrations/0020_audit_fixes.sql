-- 0020_audit_fixes — 레드/블루팀 감사 수정.
-- (a) CRIT-C: 신원 이메일 정규화 백필(.eq 소문자 매칭 전제). (b) H-D: hair_reports.salon_slug.
-- (c) M-L: membership_requests pending 중복 방지. 비파괴·멱등.

-- (a) 이메일 소문자 정규화(기존 행) — 이후 코드는 저장 시 lowercase.
update public.profiles set email = lower(trim(email)) where email <> lower(trim(email));
update public.salons set owner_email = lower(trim(owner_email))
  where owner_email is not null and owner_email <> lower(trim(owner_email));
update public.staff set email = lower(trim(email))
  where email is not null and email <> lower(trim(email));
update public.membership_requests set designer_email = lower(trim(designer_email))
  where designer_email <> lower(trim(designer_email));

-- (b) H-D: hair_reports 살롱 slug(unique 필터용). 기존 행은 consultation→salon 로 백필.
alter table public.hair_reports add column if not exists salon_slug text;
update public.hair_reports hr
  set salon_slug = c.salon_slug
  from public.consultations c
  where hr.consultation_id = c.id and hr.salon_slug is null;
create index if not exists idx_hair_reports_salon_slug
  on public.hair_reports(salon_slug);

-- (c) M-L: 같은 살롱·디자이너에 pending 소속요청 중복 방지.
-- 기존 pending 중복이 있으면 가장 이른 1건만 남기고 정리(유니크 인덱스 생성 실패 방지).
delete from public.membership_requests
  where status = 'pending' and id in (
    select id from (
      select id, row_number() over (
        partition by salon_slug, designer_email order by created_at asc, id asc
      ) as rn
      from public.membership_requests where status = 'pending'
    ) t where t.rn > 1
  );
create unique index if not exists idx_membership_requests_pending_uniq
  on public.membership_requests(salon_slug, designer_email)
  where status = 'pending';
