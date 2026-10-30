-- Run once in Supabase SQL Editor. User data is protected by Auth + RLS.
begin;
create table if not exists public.travel_plans (
    user_id uuid not null references auth.users(id) on delete cascade,
    trip_key text not null,
    payload jsonb not null,
    revision integer not null default 1 check (revision > 0),
    updated_at timestamptz not null default now(),
    primary key (user_id, trip_key),
    check (jsonb_typeof(payload) = 'object'),
    check (octet_length(payload::text) <= 3000000)
);
alter table public.travel_plans enable row level security;
revoke all on public.travel_plans from anon;
grant select, insert, update, delete on public.travel_plans to authenticated;
drop policy if exists own_travel_plans on public.travel_plans;
create policy own_travel_plans on public.travel_plans
    for all to authenticated
    using ((select auth.uid()) = user_id)
    with check ((select auth.uid()) = user_id);

-- Atomic optimistic save: a stale device never overwrites a newer revision.
create or replace function public.save_travel_plan(
    p_trip_key text,
    p_payload jsonb,
    p_expected_revision integer
) returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
    v_uid uuid := auth.uid();
    v_revision integer;
begin
    if v_uid is null then raise exception 'authentication_required'; end if;
    if p_trip_key <> 'kagoshima-2026' or p_expected_revision is null or p_expected_revision < 0 then
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
    if v_revision is null then raise exception 'revision_conflict'; end if;
    return v_revision;
end;
$$;
revoke all on function public.save_travel_plan(text, jsonb, integer) from public, anon;
grant execute on function public.save_travel_plan(text, jsonb, integer) to authenticated;
commit;
