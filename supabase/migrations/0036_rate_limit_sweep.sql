-- 0036 — rate_limits 에 자동 청소를 붙인다
--
-- ## 왜 지금인가
--
-- `0003` 의 주석은 청소를 약속했다:
--   "만료 윈도우 청소용(주기적 delete where window_start < now() - interval '1 hour')"
-- 그 인덱스는 만들어졌지만 **delete 를 하는 코드는 어디에도 없다.** 양쪽 레포 전수
-- 확인. 크론도 없다. 즉 이 테이블은 첫 요청 이후로 한 번도 줄어든 적이 없다.
--
-- 지금까지는 그저 지저분한 문제였다 — 버킷 이름이 대부분 capability 토큰이었으니까.
-- 그런데 `enforceRate` 의 주 상한이 IP 로 옮겨가면서(`intake-ip:`, `invite-view:`,
-- `accept-invite:`, `signup:`) **이 테이블은 접속기록이 된다.** 누가 언제 어느 IP 에서
-- 이 서비스를 건드렸는지가 10분 단위로 무기한 쌓인다.
--
-- 보관 목적이 없는 개인정보는 보관하지 않는다. 상한 판정에 필요한 건 **현재
-- 윈도우뿐**이고, 그게 지나면 이 행은 아무 일도 하지 않는다.
--
-- ## 왜 크론이 아니라 함수 안에서인가
--
-- 별도 스케줄러(pg_cron·외부 크론)를 붙이면 그것도 운영 대상이 되고, 파일럿에서
-- 조용히 죽으면 아무도 모른다. 청소가 필요한 시점은 정확히 이 함수가 불릴 때이므로
-- 여기 붙인다 — 트래픽이 있으면 청소도 돌고, 트래픽이 없으면 쌓일 것도 없다.
--
-- 확률로 거는 이유는 모든 요청에 DELETE 를 태우지 않기 위해서다. 2% 면 하루 수백
-- 건의 요청에서 하루 여러 번 돈다.
--
-- ## 호환
--
-- 시그니처·반환값·권한은 그대로다. MAKEDOL 도 같은 RPC 를 쓰지만(같은 프로젝트)
-- 호출부가 볼 수 있는 동작은 변하지 않는다.

create or replace function public.rate_limit_hit(
  p_bucket text,
  p_window_start timestamptz
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  insert into public.rate_limits (bucket, window_start, count)
  values (p_bucket, p_window_start, 1)
  on conflict (bucket, window_start)
    do update set count = public.rate_limits.count + 1
  returning count into v_count;

  -- 기회주의적 청소. 1시간이 지난 윈도우는 어떤 판정에도 쓰이지 않는다.
  -- `idx_rate_limits_window` 가 이 조건을 그대로 받는다.
  if random() < 0.02 then
    delete from public.rate_limits
     where window_start < now() - interval '1 hour';
  end if;

  return v_count;
end;
$$;

-- `create or replace` 는 권한을 유지하지만, 명시해 둔다 —
-- 이 함수는 service_role 만 부른다.
revoke all on function public.rate_limit_hit(text, timestamptz) from public;
grant execute on function public.rate_limit_hit(text, timestamptz) to service_role;
