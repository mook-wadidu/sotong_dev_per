-- 0012: 캡슐 토큰 last_seen — 유출 감지 soft 신호.
--
-- revoke(0011) 킬 스위치를 "언제 써야 하나" 감지용. 토큰이 언제/어디서 마지막으로 쓰였는지 기록해
-- 이상 신호(휴면 토큰 급사용·이상 시각)를 눈치채게 한다.
--
--   * **실 신호 = last_seen_at(시각).** 휴면 후 첫 접근은 항상 스로틀 window 밖이라 반드시 기록된다.
--   * ip 는 coarse **soft hint** — 모바일-퍼스트라 셀룰러/CGNAT 로 원래 계속 바뀜. 그리고
--     **위조 불가 소스(x-real-ip 등 플랫폼 보장 헤더)만** 쓴다(client-supplied XFF leftmost 는 위조 가능
--     = false confidence 라 안 씀; 없으면 null).
--   * 기록은 **write-on-read 스로틀(10분)** — 진입점(콘솔/인박스 로드, 인박스는 12s refresh)마다 쓰면
--     증폭 → 조건부 UPDATE(WHERE last_seen_at IS NULL OR < now-10min)로 10분에 한 번만 실제 write.
--   * touch 는 응답 후 after() 백그라운드·best-effort(실패 삼킴) — 읽기 경로 지연 0.
--
-- RLS: salons/staff 는 0001 루프로 service_role-only(force). 신규 컬럼 정책 상속 → 추가 불필요.
-- 0011(revoke)과 별 마이그레이션 — 독립 revert 가능.

alter table public.salons
  add column if not exists owner_token_last_seen_at timestamptz,
  add column if not exists owner_token_last_seen_ip text;

alter table public.staff
  add column if not exists staff_token_last_seen_at timestamptz,
  add column if not exists staff_token_last_seen_ip text;
