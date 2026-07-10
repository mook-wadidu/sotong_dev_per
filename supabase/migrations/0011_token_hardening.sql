-- 0011: 캡슐 토큰 하드닝 — 개별 revoke 플래그.
--
-- 배경: owner_token/staff_token 은 URL·QR·설치형 PWA 매니페스트에 박히는 bearer capability.
--   유출 시 지금은 "회전(rotate)"만 가능 = 새 토큰으로 교체 → 새 링크를 재배포해야 한다.
--   revoke 플래그는 **재발급 없이** 유출 토큰을 즉시 무효화한다(외과적 kill).
--   무효화된 토큰 lookup(getSalonByOwnerToken / getDesignerByStaffToken)은 null 반환(없는 것과 동일).
--
-- revoke 운영 핸들(지금은 SQL 직접 — repo 메서드 setOwnerTokenRevoked/setStaffTokenRevoked 도 존재):
--   무효화:   update public.salons set owner_token_revoked = true  where slug = '<slug>';
--             update public.staff  set staff_token_revoked = true  where id   = '<designer_id>';
--   되돌리기: 위 UPDATE 에 false.
--
-- RLS: salons/staff 는 0001 의 루프로 이미 service_role-only(force RLS). 신규 컬럼도 테이블 정책을
--   상속하므로 추가 정책 불필요.
-- 참고: 유출 감지용 last_seen(시각·IP)은 후속 증분에서 별도 추가한다(스로틀 write-on-read).

alter table public.salons
  add column if not exists owner_token_revoked boolean not null default false;

alter table public.staff
  add column if not exists staff_token_revoked boolean not null default false;
