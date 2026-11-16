-- =====================================================================
--  Faire-part de mariage : schéma Supabase complet
--  À exécuter une seule fois dans Supabase > SQL Editor > New query.
--  Le premier compte créé dans l'application devient automatiquement
--  administrateur ; les suivants attendent d'être activés par lui.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

do $$ begin
  create type public.user_role as enum ('pending', 'admin', 'inviter', 'security');
exception when duplicate_object then null; end $$;

-- ---------- Tables ----------------------------------------------------

create table if not exists public.settings (
  id            integer primary key default 1 check (id = 1),
  couple_names  text not null default 'Fredoly & Rose',
  wedding_date  date default '2027-02-13',
  rsvp_deadline date default '2027-01-31',
  theme         jsonb,
  welcome_fr    text default 'Nous serions heureux de partager avec vous ce jour qui unit nos vies.',
  welcome_en    text default 'We would be delighted to share with you the day our lives become one.',
  thanks_fr     text default 'Chers {noms}, merci du fond du cœur d''avoir été à nos côtés le jour de notre mariage. Votre présence a rendu cette journée inoubliable. {couple}',
  thanks_en     text default 'Dear {noms}, thank you from the bottom of our hearts for being with us on our wedding day. Your presence made it unforgettable. {couple}',
  contact_phone text,
  updated_at    timestamptz not null default now()
);
insert into public.settings (id) values (1) on conflict (id) do nothing;

create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text,
  full_name  text,
  phone      text,
  role       public.user_role not null default 'pending',
  quota      integer not null default 0 check (quota >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.events (
  id         uuid primary key default gen_random_uuid(),
  title_fr   text not null,
  title_en   text,
  starts_at  timestamptz not null,
  ends_at    timestamptz,
  venue_name text,
  address    text,
  map_url    text,
  notes_fr   text,
  notes_en   text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.invitations (
  id             uuid primary key default gen_random_uuid(),
  token          text not null unique default encode(extensions.gen_random_bytes(18), 'hex'),
  household_name text not null,
  language       text not null default 'fr' check (language in ('fr', 'en')),
  template       text not null default 'marine' check (template in ('marine', 'jardin', 'ivoire', 'nuit')),
  phone          text,
  email          text,
  message        text,
  inviter_id     uuid references public.profiles (id) on delete set null default auth.uid(),
  opened_at      timestamptz,
  thanked_at     timestamptz,
  created_at     timestamptz not null default now()
);
create index if not exists invitations_inviter_idx on public.invitations (inviter_id);

create table if not exists public.invitation_events (
  invitation_id uuid not null references public.invitations (id) on delete cascade,
  event_id      uuid not null references public.events (id) on delete cascade,
  primary key (invitation_id, event_id)
);

create table if not exists public.guests (
  id            uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references public.invitations (id) on delete cascade,
  full_name     text not null,
  is_child      boolean not null default false,
  table_label   text,
  checked_in_at timestamptz,
  checked_in_by uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now()
);
create index if not exists guests_invitation_idx on public.guests (invitation_id);

create table if not exists public.rsvps (
  guest_id     uuid not null references public.guests (id) on delete cascade,
  event_id     uuid not null references public.events (id) on delete cascade,
  status       text not null check (status in ('yes', 'no')),
  responded_at timestamptz not null default now(),
  primary key (guest_id, event_id)
);
create index if not exists rsvps_event_idx on public.rsvps (event_id);

create table if not exists public.audit_log (
  id         bigserial primary key,
  actor      uuid,
  action     text not null,
  details    jsonb,
  created_at timestamptz not null default now()
);

-- ---------- Fonctions d'autorisation ------------------------------------

create or replace function public.app_role() returns public.user_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false)
$$;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role in ('admin', 'inviter', 'security') from public.profiles where id = auth.uid()), false)
$$;

create or replace function public.can_check_in() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role in ('admin', 'security') from public.profiles where id = auth.uid()), false)
$$;

create or replace function public.can_manage_invitation(p_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.invitations i
    where i.id = p_id
      and (public.is_admin() or (public.app_role() = 'inviter' and i.inviter_id = auth.uid()))
  )
$$;

create or replace function public.can_view_invitation(p_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.can_manage_invitation(p_id) or public.app_role() = 'security'
$$;

-- ---------- Création automatique du profil ---------------------------------

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    case when exists (select 1 from public.profiles where role = 'admin')
         then 'pending'::public.user_role else 'admin'::public.user_role end
  );
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Quota d'invités par inviteur -----------------------------------

create or replace function public.enforce_quota() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_inviter uuid; v_role public.user_role; v_quota integer; v_used integer;
begin
  select inviter_id into v_inviter from public.invitations where id = new.invitation_id;
  if v_inviter is null then return new; end if;
  select role, quota into v_role, v_quota from public.profiles where id = v_inviter;
  if v_role = 'admin' then return new; end if;
  select count(*) into v_used
    from public.guests g join public.invitations i on i.id = g.invitation_id
   where i.inviter_id = v_inviter;
  if v_used >= coalesce(v_quota, 0) then
    raise exception 'QUOTA_EXCEEDED' using hint = 'Le quota d''invités de ce compte est atteint.';
  end if;
  return new;
end $$;

drop trigger if exists guests_quota on public.guests;
create trigger guests_quota before insert on public.guests
  for each row execute function public.enforce_quota();

-- ---------- Sécurité au niveau des lignes (RLS) ----------------------------

alter table public.settings          enable row level security;
alter table public.profiles          enable row level security;
alter table public.events            enable row level security;
alter table public.invitations       enable row level security;
alter table public.invitation_events enable row level security;
alter table public.guests            enable row level security;
alter table public.rsvps             enable row level security;
alter table public.audit_log         enable row level security;

drop policy if exists settings_read on public.settings;
create policy settings_read on public.settings for select using (true);
drop policy if exists settings_write on public.settings;
create policy settings_write on public.settings for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select using (id = auth.uid() or public.is_admin());
drop policy if exists profiles_write on public.profiles;
create policy profiles_write on public.profiles for update using (public.is_admin()) with check (public.is_admin());
drop policy if exists profiles_delete on public.profiles;
create policy profiles_delete on public.profiles for delete using (public.is_admin() and id <> auth.uid());

drop policy if exists events_read on public.events;
create policy events_read on public.events for select using (public.is_staff());
drop policy if exists events_insert on public.events;
create policy events_insert on public.events for insert with check (public.is_admin());
drop policy if exists events_update on public.events;
create policy events_update on public.events for update using (public.is_admin()) with check (public.is_admin());
drop policy if exists events_delete on public.events;
create policy events_delete on public.events for delete using (public.is_admin());

drop policy if exists invitations_read on public.invitations;
create policy invitations_read on public.invitations for select
  using (public.is_admin() or public.app_role() = 'security' or inviter_id = auth.uid());
drop policy if exists invitations_insert on public.invitations;
create policy invitations_insert on public.invitations for insert
  with check (public.is_admin() or (public.app_role() = 'inviter' and inviter_id = auth.uid()));
drop policy if exists invitations_update on public.invitations;
create policy invitations_update on public.invitations for update
  using (public.is_admin() or (public.app_role() = 'inviter' and inviter_id = auth.uid()))
  with check (public.is_admin() or (public.app_role() = 'inviter' and inviter_id = auth.uid()));
drop policy if exists invitations_delete on public.invitations;
create policy invitations_delete on public.invitations for delete
  using (public.is_admin() or (public.app_role() = 'inviter' and inviter_id = auth.uid()));

drop policy if exists inv_events_read on public.invitation_events;
create policy inv_events_read on public.invitation_events for select using (public.can_view_invitation(invitation_id));
drop policy if exists inv_events_write on public.invitation_events;
create policy inv_events_write on public.invitation_events for all
  using (public.can_manage_invitation(invitation_id)) with check (public.can_manage_invitation(invitation_id));

drop policy if exists guests_read on public.guests;
create policy guests_read on public.guests for select using (public.can_view_invitation(invitation_id));
drop policy if exists guests_insert on public.guests;
create policy guests_insert on public.guests for insert with check (public.can_manage_invitation(invitation_id));
drop policy if exists guests_update on public.guests;
create policy guests_update on public.guests for update
  using (public.can_manage_invitation(invitation_id)) with check (public.can_manage_invitation(invitation_id));
drop policy if exists guests_delete on public.guests;
create policy guests_delete on public.guests for delete using (public.can_manage_invitation(invitation_id));

drop policy if exists rsvps_read on public.rsvps;
create policy rsvps_read on public.rsvps for select
  using (exists (select 1 from public.guests g where g.id = guest_id and public.can_view_invitation(g.invitation_id)));
drop policy if exists rsvps_write on public.rsvps;
create policy rsvps_write on public.rsvps for all
  using (exists (select 1 from public.guests g where g.id = guest_id and public.can_manage_invitation(g.invitation_id)))
  with check (exists (select 1 from public.guests g where g.id = guest_id and public.can_manage_invitation(g.invitation_id)));

drop policy if exists audit_read on public.audit_log;
create policy audit_read on public.audit_log for select using (public.is_admin());

-- ---------- Fonctions publiques (invités) -----------------------------------

create or replace function public.get_invitation(p_token text, p_track boolean default true) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_inv public.invitations;
begin
  select * into v_inv from public.invitations where token = p_token;
  if not found then return null; end if;
  if p_track and v_inv.opened_at is null then
    update public.invitations set opened_at = now() where id = v_inv.id;
  end if;
  return jsonb_build_object(
    'invitation', jsonb_build_object(
      'id', v_inv.id, 'household_name', v_inv.household_name, 'language', v_inv.language,
      'template', v_inv.template, 'message', v_inv.message),
    'guests', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', g.id, 'full_name', g.full_name, 'is_child', g.is_child,
        'table_label', g.table_label, 'checked_in_at', g.checked_in_at,
        'rsvps', coalesce((select jsonb_agg(jsonb_build_object('event_id', r.event_id, 'status', r.status))
                             from public.rsvps r where r.guest_id = g.id), '[]'::jsonb)
      ) order by g.created_at)
      from public.guests g where g.invitation_id = v_inv.id), '[]'::jsonb),
    'events', coalesce((
      select jsonb_agg(to_jsonb(e) order by e.starts_at, e.sort_order)
        from public.events e
        join public.invitation_events ie on ie.event_id = e.id
       where ie.invitation_id = v_inv.id), '[]'::jsonb),
    'settings', (select to_jsonb(s) - 'id' - 'updated_at' from public.settings s where s.id = 1)
  );
end $$;

create or replace function public.submit_rsvp(p_token text, p_answers jsonb) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_inv public.invitations; v_deadline date; a jsonb; v_guest uuid; v_event uuid;
begin
  select * into v_inv from public.invitations where token = p_token;
  if not found then raise exception 'INVITATION_NOT_FOUND'; end if;
  select rsvp_deadline into v_deadline from public.settings where id = 1;
  if v_deadline is not null and (now() at time zone 'Africa/Douala')::date > v_deadline then
    raise exception 'RSVP_CLOSED';
  end if;
  for a in select * from jsonb_array_elements(p_answers) loop
    if coalesce(a ->> 'status', '') not in ('yes', 'no') then continue; end if;
    begin
      v_guest := (a ->> 'guest_id')::uuid; v_event := (a ->> 'event_id')::uuid;
    exception when others then continue; end;
    if not exists (select 1 from public.guests where id = v_guest and invitation_id = v_inv.id) then continue; end if;
    if not exists (select 1 from public.invitation_events where invitation_id = v_inv.id and event_id = v_event) then continue; end if;
    insert into public.rsvps (guest_id, event_id, status, responded_at)
    values (v_guest, v_event, a ->> 'status', now())
    on conflict (guest_id, event_id) do update set status = excluded.status, responded_at = now();
  end loop;
  insert into public.audit_log (actor, action, details)
  values (null, 'rsvp', jsonb_build_object('invitation', v_inv.id, 'household', v_inv.household_name));
  return true;
end $$;

-- ---------- Fonctions de l'équipe d'accueil -----------------------------------

create or replace function public.check_in_guests(p_guest_ids uuid[], p_at timestamptz default now()) returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if not public.can_check_in() then raise exception 'FORBIDDEN'; end if;
  update public.guests
     set checked_in_at = coalesce(p_at, now()), checked_in_by = auth.uid()
   where id = any (p_guest_ids) and checked_in_at is null;
  get diagnostics n = row_count;
  insert into public.audit_log (actor, action, details)
  values (auth.uid(), 'check_in', jsonb_build_object('guests', p_guest_ids, 'count', n));
  return n;
end $$;

create or replace function public.undo_check_in(p_guest_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.can_check_in() then raise exception 'FORBIDDEN'; end if;
  update public.guests set checked_in_at = null, checked_in_by = null where id = p_guest_id;
  insert into public.audit_log (actor, action, details)
  values (auth.uid(), 'undo_check_in', jsonb_build_object('guest', p_guest_id));
end $$;

revoke all on function public.check_in_guests(uuid[], timestamptz) from anon;
revoke all on function public.undo_check_in(uuid) from anon;
grant execute on function public.get_invitation(text, boolean) to anon, authenticated;
grant execute on function public.submit_rsvp(text, jsonb) to anon, authenticated;
grant execute on function public.check_in_guests(uuid[], timestamptz) to authenticated;
grant execute on function public.undo_check_in(uuid) to authenticated;
