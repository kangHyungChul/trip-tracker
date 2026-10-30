-- 최초 스키마: 여행 저장 테이블 + RLS + 저장 함수.
-- `npm run db:push`(supabase db push)가 이 파일을 원격 DB에 실행하고, 실행 이력을 supabase_migrations 스키마에 기록합니다.
-- 내용은 supabase/schema.sql(SQL Editor 붙여넣기용)과 같습니다. 다만 db push 가 마이그레이션마다 트랜잭션을 직접 관리하므로
-- begin; / commit; 은 넣지 않았습니다.
-- 모든 문장이 재실행 안전(if not exists / drop … if exists / create or replace)이라
-- 이미 SQL Editor 로 schema.sql 을 실행한 프로젝트에 push 해도 기존 데이터는 그대로입니다.

-- 여행 1개 = 1행. (사용자 ID, 여행 ID) 쌍이 기본키입니다.
create table if not exists public.travel_plans (
    user_id uuid not null references auth.users(id) on delete cascade, -- 계정이 삭제되면 여행도 함께 삭제
    trip_key text not null,                                             -- 앱의 여행 ID
    payload jsonb not null,                                             -- 여행 전체 데이터(JSON)
    revision integer not null default 1 check (revision > 0),           -- 저장할 때마다 1씩 증가 (충돌 검사용)
    updated_at timestamptz not null default now(),
    primary key (user_id, trip_key),
    check (jsonb_typeof(payload) = 'object'),        -- JSON 객체만 허용
    check (octet_length(payload::text) <= 3000000)   -- 여행 1개 최대 약 3MB
);

-- RLS(행 수준 보안): 로그인한 사용자는 자기 user_id 행만 읽고 쓸 수 있고, 비로그인(anon)은 접근 불가
alter table public.travel_plans enable row level security;
revoke all on public.travel_plans from anon;
grant select, insert, update, delete on public.travel_plans to authenticated;
drop policy if exists own_travel_plans on public.travel_plans;
create policy own_travel_plans on public.travel_plans
    for all to authenticated
    using ((select auth.uid()) = user_id)
    with check ((select auth.uid()) = user_id);

-- 원자적 낙관적 저장: 앱이 알고 있는 revision(p_expected_revision)과 DB 값이 같을 때만 저장합니다.
-- 다르면 다른 기기가 먼저 저장한 것이므로 revision_conflict 오류 → 오래된 기기가 새 데이터를 덮어쓰지 못함.
-- p_expected_revision = 0 은 "처음 저장"(행이 없을 때만 insert)입니다.
create or replace function public.save_travel_plan(
    p_trip_key text,
    p_payload jsonb,
    p_expected_revision integer
) returns integer
language plpgsql
security invoker      -- 호출한 사용자 권한으로 실행 → 위 RLS 가 그대로 적용됨
set search_path = ''  -- 스키마 이름을 모두 명시해 search_path 조작 공격 방지
as $$
declare
    v_uid uuid := auth.uid();
    v_revision integer;
begin
    if v_uid is null then raise exception 'authentication_required'; end if;
    -- 여행 키: 앱의 여행 ID 규칙(영문·숫자·_·-, 1~100자)만 허용 (여러 여행 지원)
    if p_trip_key is null or p_trip_key !~ '^[A-Za-z0-9_-]{1,100}$' or p_expected_revision is null or p_expected_revision < 0 then
        raise exception 'invalid_request';
    end if;
    if p_expected_revision = 0 then
        insert into public.travel_plans (user_id, trip_key, payload, revision)
            values (v_uid, p_trip_key, p_payload, 1)
            on conflict do nothing returning revision into v_revision;
    else
        update public.travel_plans
            set payload = p_payload, revision = revision + 1, updated_at = now()
            where user_id = v_uid and trip_key = p_trip_key and revision = p_expected_revision
            returning revision into v_revision;
    end if;
    -- insert/update 된 행이 없으면(이미 있거나 revision 불일치) 충돌
    if v_revision is null then raise exception 'revision_conflict'; end if;
    return v_revision;
end;
$$;
-- 비로그인 사용자는 함수 호출 불가, 로그인 사용자만 실행 가능
revoke all on function public.save_travel_plan(text, jsonb, integer) from public, anon;
grant execute on function public.save_travel_plan(text, jsonb, integer) to authenticated;
