-- 공용 여행 저장소 (로그인 없음): 앱에 접속한 누구나 모든 여행을 읽고 편집할 수 있습니다.
-- ⚠ 공개 키(publishable)만으로 누구나 읽기·수정·삭제가 가능하므로, 로그인 기능을 추가하기 전까지는
--   주소를 아는 사람만 쓰는 용도로 사용하세요. (나중에 로그인 추가 시 owner 컬럼 + RLS 로 좁힐 예정)
--
-- 구조
--  - 여행 1개 = 1행 (id = 앱의 여행 ID, payload = 여행 전체 JSON)
--  - revision: 저장할 때마다 1씩 증가. 앱이 알고 있는 revision 과 다르면 저장을 거부(revision_conflict)해
--    다른 기기의 변경을 모르고 덮어쓰는 일을 막습니다.
--  - deleted_at: 휴지통 방식 삭제. 값이 있으면 목록에서 숨기고, 복구하면 다시 null.
--  - 쓰기는 아래 함수(save_trip / delete_trip / restore_trip)로만 가능하고, 테이블 직접 쓰기는 막습니다.
--    (검증·revision 비교를 항상 거치게 하기 위함)
-- 기존 개인용 travel_plans 테이블은 나중 로그인 작업 때 정리하기 위해 그대로 둡니다.

create table if not exists public.trips (
    id text primary key check (id ~ '^[A-Za-z0-9_-]{1,100}$'),      -- 앱 여행 ID 규칙 (영문·숫자·_·-)
    payload jsonb not null
        check (jsonb_typeof(payload) = 'object')                     -- JSON 객체만
        check (octet_length(payload::text) <= 3000000),              -- 여행 1개 최대 약 3MB
    revision integer not null default 1 check (revision > 0),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz                                           -- null = 사용 중, 값 = 휴지통
);
-- 목록(삭제 안 된 여행)·휴지통 조회용 인덱스
create index if not exists trips_deleted_at_idx on public.trips (deleted_at);

-- 읽기: 누구나(anon·authenticated) 모든 행 조회 가능. 쓰기 권한은 주지 않습니다.
alter table public.trips enable row level security;
revoke all on public.trips from anon, authenticated;
grant select on public.trips to anon, authenticated;
drop policy if exists trips_read_all on public.trips;
create policy trips_read_all on public.trips
    for select to anon, authenticated
    using (true);

-- 저장(추가·수정). p_expected_revision = 0 이면 "새 여행"(행이 없을 때만 추가),
-- 그 외에는 DB 의 revision 이 같을 때만 갱신합니다. 갱신하면 휴지통 상태도 해제(deleted_at = null)합니다.
-- 성공하면 새 revision, 충돌하면 'revision_conflict' 예외.
create or replace function public.save_trip(
    p_id text,
    p_payload jsonb,
    p_expected_revision integer
) returns integer
language plpgsql
security definer      -- 테이블 쓰기 권한이 없는 anon 도 이 함수를 통해서만 쓸 수 있게 함
set search_path = ''  -- 스키마 이름을 모두 명시해 search_path 조작 공격 방지
as $$
declare
    v_revision integer;
begin
    -- 입력 검증: ID 형식, JSON 객체, payload 안의 id 와 행 id 일치, revision 범위
    if p_id is null or p_id !~ '^[A-Za-z0-9_-]{1,100}$'
        or p_payload is null or jsonb_typeof(p_payload) <> 'object'
        or (p_payload ->> 'id') is distinct from p_id
        or p_expected_revision is null or p_expected_revision < 0 then
        raise exception 'invalid_request';
    end if;
    if p_expected_revision = 0 then
        insert into public.trips (id, payload)
            values (p_id, p_payload)
            on conflict (id) do nothing          -- 이미 있으면(다른 기기가 먼저 만듦·휴지통 포함) 충돌
            returning revision into v_revision;
    else
        update public.trips
            set payload = p_payload, revision = revision + 1, updated_at = now(), deleted_at = null
            where id = p_id and revision = p_expected_revision
            returning revision into v_revision;
    end if;
    if v_revision is null then raise exception 'revision_conflict'; end if;
    return v_revision;
end;
$$;

-- 휴지통으로 보내기. 이미 삭제됐거나 없는 여행이면 0 을 돌려줍니다. (오프라인 삭제 재시도 시 오류 없이 끝나도록)
create or replace function public.delete_trip(p_id text) returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_revision integer;
begin
    if p_id is null or p_id !~ '^[A-Za-z0-9_-]{1,100}$' then raise exception 'invalid_request'; end if;
    update public.trips
        set deleted_at = now(), revision = revision + 1, updated_at = now()
        where id = p_id and deleted_at is null
        returning revision into v_revision;
    return coalesce(v_revision, 0);
end;
$$;

-- 휴지통에서 복구. 성공하면 새 revision, 휴지통에 없으면 'not_found' 예외.
create or replace function public.restore_trip(p_id text) returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_revision integer;
begin
    if p_id is null or p_id !~ '^[A-Za-z0-9_-]{1,100}$' then raise exception 'invalid_request'; end if;
    update public.trips
        set deleted_at = null, revision = revision + 1, updated_at = now()
        where id = p_id and deleted_at is not null
        returning revision into v_revision;
    if v_revision is null then raise exception 'not_found'; end if;
    return v_revision;
end;
$$;

-- 함수 실행 권한: 기본(public) 권한을 없애고 anon·authenticated 에만 명시적으로 부여
revoke all on function public.save_trip(text, jsonb, integer) from public;
revoke all on function public.delete_trip(text) from public;
revoke all on function public.restore_trip(text) from public;
grant execute on function public.save_trip(text, jsonb, integer) to anon, authenticated;
grant execute on function public.delete_trip(text) to anon, authenticated;
grant execute on function public.restore_trip(text) to anon, authenticated;
