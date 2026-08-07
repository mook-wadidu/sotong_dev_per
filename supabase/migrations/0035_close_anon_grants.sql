-- 0035 — anon/authenticated 에서 테이블 권한을 걷는다
--
-- ## 왜
--
-- `0001_core.sql:439` 의 주석은 이렇게 말한다:
--   "테이블 권한도 service_role 에만 부여(anon/authenticated 에는 미부여 =
--    GRANT 단계에서도 차단)"
--
-- **거짓이다.** 그 파일은 `grant all ... to service_role` 만 하고 anon 을 revoke 하지
-- 않았다. Supabase 프로젝트 기본 grant 가 그대로 남아 있고, 실측하면 이렇다:
--
--   profiles → anon: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE
--
-- 지금 막고 있는 건 **RLS 하나뿐**이다. 대시보드에서 "쿼리 하나만 확인하자"고 RLS 를
-- 끄는 순간, 시스템의 모든 자격증명이 공개 anon 키로 열린다 —
-- `salons.owner_token` · `staff.staff_token` · `consultations.consultation_token` ·
-- `designer_token` · `report_token` · `salon_invites.token`.
--
-- `0022:337` 이 이미 같은 이유를 적어뒀다("방어선 이중화: RLS 를 잠시 끄더라도 anon 이
-- 쓰지 못하게"). 다만 `0022`·`0023`·`0024` 가 덮은 건 **9개 테이블**뿐이다.
--
-- ## 왜 열거하지 않는가
--
-- 처음엔 `0001` 의 23개를 열거하려 했다. 그러면 **`profiles` 가 빠진다** — `0016` 산이라
-- 그 목록에 없다. 그리고 하필 그 테이블이 어드민 권한의 출처가 되는 참이다
-- (`getAdminUser` 가 이제 `profiles.role` 을 본다). `salon_invites`(살아있는 초대 토큰)도
-- 같은 이유로 빠진다.
--
-- **열거하면 다음에 추가된 테이블이 또 빠진다.** 그래서 스키마 전체로 간다.
--
-- ## 그리고 43번째 테이블
--
-- 기존 REVOKE 세 파일은 전부 `alter default privileges` 를 하지 않았다. 그래서 지금
-- 걷어도 **다음에 만드는 테이블은 다시 열린 채로 태어난다.** 그 한 줄은 MAKEDOL 의
-- 적용된 적 없는 파일에 이미 쓰여 있었다(`web/supabase/migrations/0002_close_anon_write.sql:55-57`
-- — "Future tables created in this schema must not inherit write access either").
-- 회수해 온다.
--
-- ## 동작 변화가 0인 근거
--
-- 양쪽 레포 전수 확인: anon/authenticated 로 **테이블에 접근하는 코드가 없다.**
--   소통 browser.ts 호출부 3곳 · ssr-server.ts 4곳 → 전부 auth 전용
--     (signInWithPassword / signOut / getUser / exchangeCodeForSession)
--   MAKEDOL client.ts 2곳 · server.ts 3곳 → 전부 auth 전용
--   테이블 접근은 양쪽 다 service-role 클라이언트만 지난다
-- 그리고 `service_role` 은 `rolbypassrls = true` 이므로 RLS·GRANT 어느 쪽에도 안 걸린다.
--
-- 깨지지 않는 것도 확인했다:
--   Realtime      사용 0건
--   Storage       `storage.objects` 는 다른 스키마 — `public.*` REVOKE 와 무관
--   PostgREST     introspection 은 `authenticator` 롤이 한다. 게다가 0022/0023/0024 가
--                 이미 9개 테이블에 같은 REVOKE 를 걸었고 그것들이 지금 정상 동작 중이다
--                 — 선례가 곧 증명이다
--   rate_limit_hit  SECURITY DEFINER 이고 `0003:53-54` 가 함수 권한을 따로 관리한다
--   뷰            0개 / 트리거 8개는 전부 service_role 쓰기 경로

revoke all on all tables in schema public from anon, authenticated;

-- 시퀀스도 같이. `nextval` 만으로 행을 만들 수는 없지만, 열어둘 이유가 없다.
revoke all on all sequences in schema public from anon, authenticated;

-- 앞으로 만들어지는 테이블·시퀀스도 상속하지 않게. 이게 없으면 이 마이그레이션은
-- **오늘까지만** 유효하다.
alter default privileges in schema public
  revoke all on tables from anon, authenticated;
alter default privileges in schema public
  revoke all on sequences from anon, authenticated;

-- ⚠️ 함수는 건드리지 않는다. `rate_limit_hit` 은 `0003` 이 이미 `revoke ... from public`
-- + `grant execute to service_role` 로 관리하고, 여기서 일괄로 걷으면 그 설계와 충돌한다.
