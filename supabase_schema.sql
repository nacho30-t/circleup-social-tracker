-- ============================================================
-- HIGHLIFE — SUPABASE DATABASE
-- Run this entire file once in Supabase > SQL Editor.
-- It creates real accounts-linked profiles, interactions,
-- friend requests, accepted friendships, friend circles,
-- and a privacy-aware second-degree network graph.
-- ============================================================

create extension if not exists pgcrypto;

-- ---------- TABLES ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  display_name text not null check (char_length(display_name) between 1 and 60),
  discoverable boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.interactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  interaction_date date not null default current_date,
  category text not null check (category in ('social','professional','new-person','event')),
  note text check (note is null or char_length(note) <= 160),
  created_at timestamptz not null default now()
);

create index if not exists interactions_user_date_idx
  on public.interactions(user_id, interaction_date);

create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending','accepted','declined')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint no_self_friendship check (requester_id <> addressee_id)
);

create unique index if not exists friendships_unique_pair
  on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));

create index if not exists friendships_requester_idx on public.friendships(requester_id,status);
create index if not exists friendships_addressee_idx on public.friendships(addressee_id,status);

-- ---------- NEW AUTH USER -> PROFILE ----------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  proposed_name text;
  proposed_discoverable boolean;
begin
  proposed_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'display_name'),''),
    nullif(trim(new.raw_user_meta_data ->> 'full_name'),''),
    split_part(coalesce(new.email,'Highlife'), '@', 1)
  );

  proposed_discoverable := coalesce((new.raw_user_meta_data ->> 'discoverable')::boolean, false);

  insert into public.profiles(id,email,display_name,discoverable)
  values(new.id, lower(new.email), left(proposed_name,60), proposed_discoverable)
  on conflict (id) do update
    set email = excluded.email;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Backfill profiles for accounts that existed before this schema was installed.
insert into public.profiles(id,email,display_name,discoverable)
select
  u.id,
  lower(u.email),
  left(coalesce(
    nullif(trim(u.raw_user_meta_data ->> 'display_name'),''),
    nullif(trim(u.raw_user_meta_data ->> 'full_name'),''),
    split_part(u.email,'@',1)
  ),60),
  false
from auth.users u
where u.email is not null
on conflict (id) do nothing;

-- ---------- HARD LIMIT: MAX 4 INTERACTIONS / DAY ----------
create or replace function public.enforce_daily_interaction_limit()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (
    select count(*)
    from public.interactions
    where user_id = new.user_id
      and interaction_date = new.interaction_date
  ) >= 4 then
    raise exception 'Daily interaction limit reached (4).';
  end if;
  return new;
end;
$$;

drop trigger if exists interaction_daily_limit on public.interactions;
create trigger interaction_daily_limit
before insert on public.interactions
for each row execute procedure public.enforce_daily_interaction_limit();

-- ---------- FRIENDSHIP HELPER ----------
create or replace function public.are_friends(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1
    from public.friendships f
    where f.status='accepted'
      and (
        (f.requester_id=a and f.addressee_id=b)
        or
        (f.requester_id=b and f.addressee_id=a)
      )
  );
$$;

-- ---------- RLS ----------
alter table public.profiles enable row level security;
alter table public.interactions enable row level security;
alter table public.friendships enable row level security;

revoke all on table public.profiles from anon, authenticated;
revoke all on table public.interactions from anon, authenticated;
revoke all on table public.friendships from anon, authenticated;

grant select, update on table public.profiles to authenticated;
grant select, insert, delete on table public.interactions to authenticated;
grant select, delete on table public.friendships to authenticated;

drop policy if exists profiles_select_own_or_friend on public.profiles;
create policy profiles_select_own_or_friend
on public.profiles for select
to authenticated
using (
  auth.uid() is not null
  and (id = auth.uid() or public.are_friends(auth.uid(), id))
);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists interactions_select_own on public.interactions;
create policy interactions_select_own
on public.interactions for select
to authenticated
using (user_id = auth.uid());

drop policy if exists interactions_insert_own on public.interactions;
create policy interactions_insert_own
on public.interactions for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists interactions_delete_own on public.interactions;
create policy interactions_delete_own
on public.interactions for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists friendships_select_involved on public.friendships;
create policy friendships_select_involved
on public.friendships for select
to authenticated
using (requester_id = auth.uid() or addressee_id = auth.uid());

drop policy if exists friendships_delete_involved on public.friendships;
create policy friendships_delete_involved
on public.friendships for delete
to authenticated
using (requester_id = auth.uid() or addressee_id = auth.uid());

-- ---------- SEND REQUEST BY EXACT EMAIL ----------
create or replace function public.send_friend_request(target_email text)
returns table(friendship_id uuid, result_status text, target_name text)
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  target public.profiles%rowtype;
  existing public.friendships%rowtype;
begin
  if me is null then raise exception 'You must be signed in.'; end if;

  select * into target
  from public.profiles p
  where lower(p.email) = lower(trim(target_email))
  limit 1;

  if target.id is null then
    raise exception 'No Highlife account exists for that email.';
  end if;
  if target.id = me then
    raise exception 'You cannot add yourself.';
  end if;

  select * into existing
  from public.friendships f
  where (f.requester_id=me and f.addressee_id=target.id)
     or (f.requester_id=target.id and f.addressee_id=me)
  limit 1;

  if existing.id is not null then
    if existing.status='accepted' then
      raise exception 'You are already friends on Highlife.';
    elsif existing.status='pending' and existing.requester_id=target.id and existing.addressee_id=me then
      update public.friendships
      set status='accepted', responded_at=now()
      where id=existing.id;
      return query select existing.id, 'accepted'::text, target.display_name;
      return;
    elsif existing.status='pending' then
      raise exception 'A friend request is already pending.';
    else
      update public.friendships
      set requester_id=me, addressee_id=target.id, status='pending', created_at=now(), responded_at=null
      where id=existing.id;
      return query select existing.id, 'pending'::text, target.display_name;
      return;
    end if;
  end if;

  insert into public.friendships(requester_id,addressee_id,status)
  values(me,target.id,'pending')
  returning id into existing.id;

  return query select existing.id, 'pending'::text, target.display_name;
end;
$$;

-- ---------- INCOMING REQUESTS ----------
create or replace function public.get_incoming_friend_requests()
returns table(request_id uuid, requester_id uuid, display_name text, email text, created_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select f.id, p.id, p.display_name, p.email, f.created_at
  from public.friendships f
  join public.profiles p on p.id=f.requester_id
  where f.addressee_id=auth.uid()
    and f.status='pending'
  order by f.created_at desc;
$$;

-- ---------- ACCEPT / DECLINE ----------
create or replace function public.respond_friend_request(request_id uuid, accept_request boolean)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.friendships
  set status = case when accept_request then 'accepted' else 'declined' end,
      responded_at = now()
  where id=request_id
    and addressee_id=auth.uid()
    and status='pending';

  if not found then
    raise exception 'Friend request not found or no longer pending.';
  end if;
  return true;
end;
$$;

-- ---------- ACCEPTED FRIENDS + REAL MONTH STATS ----------
create or replace function public.get_friends()
returns table(
  friend_id uuid,
  display_name text,
  email text,
  month_interactions bigint,
  social_days bigint,
  second_degree_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with direct as (
    select
      case when f.requester_id=auth.uid() then f.addressee_id else f.requester_id end as friend_id
    from public.friendships f
    where f.status='accepted'
      and (f.requester_id=auth.uid() or f.addressee_id=auth.uid())
  )
  select
    p.id,
    p.display_name,
    p.email,
    (
      select count(*)
      from public.interactions i
      where i.user_id=p.id
        and i.interaction_date >= date_trunc('month',current_date)::date
        and i.interaction_date < (date_trunc('month',current_date)+interval '1 month')::date
    ) as month_interactions,
    (
      select count(distinct i.interaction_date)
      from public.interactions i
      where i.user_id=p.id
        and i.interaction_date >= date_trunc('month',current_date)::date
        and i.interaction_date < (date_trunc('month',current_date)+interval '1 month')::date
    ) as social_days,
    (
      select count(*)
      from public.friendships f2
      where f2.status='accepted'
        and (f2.requester_id=p.id or f2.addressee_id=p.id)
        and (case when f2.requester_id=p.id then f2.addressee_id else f2.requester_id end) <> auth.uid()
    ) as second_degree_count
  from direct d
  join public.profiles p on p.id=d.friend_id
  order by p.display_name;
$$;

-- ---------- FRIEND CIRCLE: DATE + CATEGORY ONLY, NO NOTES ----------
create or replace function public.get_friend_circle(friend_id uuid, month_start date)
returns table(interaction_date date, category text)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.are_friends(auth.uid(), friend_id) then
    raise exception 'You can only view the circle of an accepted friend.';
  end if;

  return query
  select i.interaction_date, i.category
  from public.interactions i
  where i.user_id=friend_id
    and i.interaction_date >= date_trunc('month',month_start)::date
    and i.interaction_date < (date_trunc('month',month_start)+interval '1 month')::date
  order by i.interaction_date, i.created_at;
end;
$$;

-- ---------- REMOVE FRIEND ----------
create or replace function public.remove_friend(friend_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.friendships f
  where f.status='accepted'
    and (
      (f.requester_id=auth.uid() and f.addressee_id=friend_id)
      or
      (f.requester_id=friend_id and f.addressee_id=auth.uid())
    );
  if not found then raise exception 'Friendship not found.'; end if;
  return true;
end;
$$;

-- ---------- PRIVACY-AWARE REAL NETWORK GRAPH ----------
-- Direct friends are named.
-- Second-degree users are named only if THEY enabled discoverable.
-- Otherwise the connection exists but appears as "Private connection".
create or replace function public.get_network_graph()
returns table(
  node_key text,
  display_name text,
  degree integer,
  via_friend_key text,
  via_friend_name text,
  is_private boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with direct as (
    select
      case when f.requester_id=auth.uid() then f.addressee_id else f.requester_id end as friend_id
    from public.friendships f
    where f.status='accepted'
      and (f.requester_id=auth.uid() or f.addressee_id=auth.uid())
  ),
  direct_named as (
    select d.friend_id, p.display_name
    from direct d join public.profiles p on p.id=d.friend_id
  ),
  second_raw as (
    select
      dn.friend_id as via_friend_id,
      dn.display_name as via_friend_name,
      case when f2.requester_id=dn.friend_id then f2.addressee_id else f2.requester_id end as second_id
    from direct_named dn
    join public.friendships f2
      on f2.status='accepted'
     and (f2.requester_id=dn.friend_id or f2.addressee_id=dn.friend_id)
  ),
  second_filtered as (
    select distinct on (sr.second_id)
      sr.second_id, sr.via_friend_id, sr.via_friend_name
    from second_raw sr
    where sr.second_id <> auth.uid()
      and not exists (select 1 from direct d where d.friend_id=sr.second_id)
    order by sr.second_id, sr.via_friend_id
  )
  select
    dn.friend_id::text,
    dn.display_name,
    1,
    null::text,
    null::text,
    false
  from direct_named dn

  union all

  select
    case
      when p.discoverable then p.id::text
      else 'private-' || substr(md5(p.id::text || auth.uid()::text),1,16)
    end,
    case when p.discoverable then p.display_name else 'Private connection' end,
    2,
    sf.via_friend_id::text,
    sf.via_friend_name,
    not p.discoverable
  from second_filtered sf
  join public.profiles p on p.id=sf.second_id;
$$;

-- ---------- FUNCTION PERMISSIONS ----------
revoke all on function public.are_friends(uuid,uuid) from public;
revoke all on function public.send_friend_request(text) from public;
revoke all on function public.get_incoming_friend_requests() from public;
revoke all on function public.respond_friend_request(uuid,boolean) from public;
revoke all on function public.get_friends() from public;
revoke all on function public.get_friend_circle(uuid,date) from public;
revoke all on function public.remove_friend(uuid) from public;
revoke all on function public.get_network_graph() from public;

grant execute on function public.are_friends(uuid,uuid) to authenticated;
grant execute on function public.send_friend_request(text) to authenticated;
grant execute on function public.get_incoming_friend_requests() to authenticated;
grant execute on function public.respond_friend_request(uuid,boolean) to authenticated;
grant execute on function public.get_friends() to authenticated;
grant execute on function public.get_friend_circle(uuid,date) to authenticated;
grant execute on function public.remove_friend(uuid) to authenticated;
grant execute on function public.get_network_graph() to authenticated;

-- No anonymous table or function access is required for Highlife.
