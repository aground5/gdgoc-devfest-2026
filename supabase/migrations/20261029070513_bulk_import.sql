-- Bulk update of teams and participants from an uploaded file (/organize).
-- Runs in one transaction: either the whole file applies or nothing does.
--
-- p_teams:  [{ "table": "A-01", "name": "...", "project": "...", "desc": "..." }]
--           matched to existing teams by table label
-- p_people: [{ "code": "ABC123" | "", "name": "...", "school": "ku", "table": "A-01" | "" }]
--           matched to existing participants by access code; no code = new
--           participant with a generated code
-- p_delete_missing: also delete teams / participants that aren't in the file
--           (their attendance and investments go with them)
--
-- Returns counts: { teams: {added, updated, deleted}, people: {added, updated, deleted} }

create or replace function public.bulk_import(p_teams jsonb, p_people jsonb, p_delete_missing boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  t        jsonb;
  p        jsonb;
  v_table  text;
  v_code   text;
  v_tid    uuid;
  v_pid    uuid;
  kept_t   uuid[] := '{}';
  kept_p   uuid[] := '{}';
  t_add int := 0; t_upd int := 0; t_del int := 0;
  p_add int := 0; p_upd int := 0; p_del int := 0;
begin
  if not public.is_staff() then
    raise exception 'staff only' using errcode = '42501';
  end if;
  if jsonb_typeof(p_teams) <> 'array' or jsonb_typeof(p_people) <> 'array' then
    raise exception 'teams and people must be arrays' using errcode = '22023';
  end if;

  -- One import at a time
  perform pg_advisory_xact_lock(hashtext('public.bulk_import'));

  -- File-level checks
  if exists (
    select 1 from jsonb_array_elements(p_teams) e
    group by btrim(e ->> 'table') having count(*) > 1
  ) then
    raise exception 'duplicate team table' using errcode = 'P0001', hint = 'dup_table';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_people) e
    where btrim(coalesce(e ->> 'code', '')) <> ''
    group by upper(btrim(e ->> 'code')) having count(*) > 1
  ) then
    raise exception 'duplicate participant code' using errcode = 'P0001', hint = 'dup_code';
  end if;

  -- Teams
  for t in select * from jsonb_array_elements(p_teams) loop
    v_table := btrim(coalesce(t ->> 'table', ''));
    if v_table = '' or btrim(coalesce(t ->> 'name', '')) = '' then
      raise exception 'team needs table and name' using errcode = 'P0001', hint = 'team_required';
    end if;
    select x.id into v_tid from public.teams x where x.table_label = v_table limit 1;
    if v_tid is null then
      insert into public.teams (table_label, name, project, description)
      values (v_table, btrim(t ->> 'name'), btrim(coalesce(t ->> 'project', '')), btrim(coalesce(t ->> 'desc', '')))
      returning id into v_tid;
      t_add := t_add + 1;
    else
      update public.teams x
         set name = btrim(t ->> 'name'),
             project = btrim(coalesce(t ->> 'project', '')),
             description = btrim(coalesce(t ->> 'desc', ''))
       where x.id = v_tid;
      t_upd := t_upd + 1;
    end if;
    kept_t := kept_t || v_tid;
  end loop;

  -- Participants
  for p in select * from jsonb_array_elements(p_people) loop
    if btrim(coalesce(p ->> 'name', '')) = '' then
      raise exception 'participant needs a name' using errcode = 'P0001', hint = 'person_required';
    end if;
    if coalesce(p ->> 'school', '') not in ('ku', 'yu', 'skku', 'kaist') then
      raise exception 'unknown school' using errcode = 'P0001', hint = 'bad_school';
    end if;

    v_table := btrim(coalesce(p ->> 'table', ''));
    v_tid := null;
    if v_table <> '' then
      select x.id into v_tid from public.teams x where x.table_label = v_table limit 1;
      if v_tid is null or (p_delete_missing and not v_tid = any (kept_t)) then
        raise exception 'unknown team table %', v_table using errcode = 'P0001', hint = 'bad_table';
      end if;
    end if;

    v_code := upper(btrim(coalesce(p ->> 'code', '')));
    v_pid := null;
    if v_code <> '' then
      select x.id into v_pid from public.participants x where x.access_code = v_code;
    end if;

    if v_pid is null then
      if v_code <> '' and v_code !~ '^[0-9A-Z]{4,12}$' then
        raise exception 'bad participant code' using errcode = 'P0001', hint = 'bad_code';
      end if;
      insert into public.participants (name, school, team_id, access_code)
      values (btrim(p ->> 'name'), p ->> 'school', v_tid, coalesce(nullif(v_code, ''), public.generate_access_code()))
      returning id into v_pid;
      p_add := p_add + 1;
    else
      update public.participants x
         set name = btrim(p ->> 'name'), school = p ->> 'school', team_id = v_tid
       where x.id = v_pid;
      p_upd := p_upd + 1;
    end if;
    kept_p := kept_p || v_pid;
  end loop;

  if p_delete_missing then
    delete from public.participants x where not x.id = any (kept_p);
    get diagnostics p_del = row_count;
    delete from public.teams x where not x.id = any (kept_t);
    get diagnostics t_del = row_count;
  end if;

  return jsonb_build_object(
    'teams', jsonb_build_object('added', t_add, 'updated', t_upd, 'deleted', t_del),
    'people', jsonb_build_object('added', p_add, 'updated', p_upd, 'deleted', p_del)
  );
end;
$$;

revoke all on function public.bulk_import(jsonb, jsonb, boolean) from public, anon;
grant execute on function public.bulk_import(jsonb, jsonb, boolean) to authenticated;
