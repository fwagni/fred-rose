-- 003 : invitations à une ou plusieurs personnes, civilité, visioconférence.
-- Idempotent : peut être ré-exécuté sans risque.

-- 1. Le nom affiché devient facultatif : vide = on affiche les noms des personnes.
alter table public.invitations alter column household_name drop not null;

-- 2. Civilité facultative par personne (sert aux accords : Cher / Chère / Chers).
alter table public.guests add column if not exists civility text;
alter table public.guests drop constraint if exists guests_civility_check;
alter table public.guests add constraint guests_civility_check
  check (civility is null or civility in ('m', 'mme', 'mlle', 'dr'));

-- 3. Lien de visioconférence facultatif par moment de la journée.
alter table public.events add column if not exists stream_url text;

-- 4. Nouvelle réponse possible : « remote » (suivra en ligne).
alter table public.rsvps drop constraint if exists rsvps_status_check;
alter table public.rsvps add constraint rsvps_status_check check (status in ('yes', 'no', 'remote'));

-- 5. get_invitation renvoie aussi la civilité (les events renvoient déjà toutes leurs colonnes, dont stream_url).
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
        'id', g.id, 'full_name', g.full_name, 'civility', g.civility, 'is_child', g.is_child,
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

-- 6. submit_rsvp accepte « remote », uniquement pour un moment qui a un lien de visio.
create or replace function public.submit_rsvp(p_token text, p_answers jsonb) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_inv public.invitations; v_deadline date; a jsonb; v_guest uuid; v_event uuid; v_status text;
begin
  select * into v_inv from public.invitations where token = p_token;
  if not found then raise exception 'INVITATION_NOT_FOUND'; end if;
  select rsvp_deadline into v_deadline from public.settings where id = 1;
  if v_deadline is not null and (now() at time zone 'Africa/Douala')::date > v_deadline then
    raise exception 'RSVP_CLOSED';
  end if;
  for a in select * from jsonb_array_elements(p_answers) loop
    v_status := coalesce(a ->> 'status', '');
    if v_status not in ('yes', 'no', 'remote') then continue; end if;
    begin
      v_guest := (a ->> 'guest_id')::uuid; v_event := (a ->> 'event_id')::uuid;
    exception when others then continue; end;
    if not exists (select 1 from public.guests where id = v_guest and invitation_id = v_inv.id) then continue; end if;
    if not exists (select 1 from public.invitation_events where invitation_id = v_inv.id and event_id = v_event) then continue; end if;
    if v_status = 'remote' and not exists (
      select 1 from public.events where id = v_event and coalesce(stream_url, '') <> ''
    ) then continue; end if;
    insert into public.rsvps (guest_id, event_id, status, responded_at)
    values (v_guest, v_event, v_status, now())
    on conflict (guest_id, event_id) do update set status = excluded.status, responded_at = now();
  end loop;
  insert into public.audit_log (actor, action, details)
  values (null, 'rsvp', jsonb_build_object('invitation', v_inv.id, 'household', v_inv.household_name));
  return true;
end $$;

grant execute on function public.get_invitation(text, boolean) to anon, authenticated;
grant execute on function public.submit_rsvp(text, jsonb) to anon, authenticated;

-- 7. Remerciements : « Chers {noms} » devient « {cher} {noms} » (Cher / Chère / Chers / Chères selon les personnes).
alter table public.settings alter column thanks_fr
  set default '{cher} {noms}, merci du fond du cœur d''avoir été à nos côtés le jour de notre mariage. Votre présence a rendu cette journée inoubliable. {couple}';
update public.settings set thanks_fr = '{cher}' || substr(thanks_fr, length('Chers') + 1)
 where id = 1 and thanks_fr like 'Chers {noms}%';
alter table public.settings alter column thanks_en
  set default '{cher} {noms}, thank you from the bottom of our hearts for being with us on our wedding day. Your presence made it unforgettable. {couple}';
update public.settings set thanks_en = '{cher}' || substr(thanks_en, length('Dear') + 1)
 where id = 1 and thanks_en like 'Dear {noms}%';
