-- bulk_import without access codes in the file. Participants are matched to
-- existing ones by name + school (so codes already handed out stay valid);
-- anyone new gets a random code from generate_access_code().
--
-- p_people: [{ "name": "...", "school": "ku", "table": "A-01" | "" }]
-- Errors (hint): dup_person (same name + school twice in the file),
-- ambiguous_person (several existing participants share that name + school)

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
  v_name   text;
  v_tid    uuid;
  v_pid    uuid;
  v_n      int;
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

  perform pg_advisory_xact_lock(hashtext('public.bulk_import'));

  if exists (
    select 1 from jsonb_array_elements(p_teams) e
    group by btrim(e ->> 'table') having count(*) > 1
  ) then
    raise exception 'duplicate team table' using errcode = 'P0001', hint = 'dup_table';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_people) e
    group by btrim(e ->> 'name'), e ->> 'school' having count(*) > 1
  ) then
    raise exception 'duplicate participant' using errcode = 'P0001', hint = 'dup_person';
  end if;

  -- Teams (by table label)
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

  -- Participants (by name + school)
  for p in select * from jsonb_array_elements(p_people) loop
    v_name := btrim(coalesce(p ->> 'name', ''));
    if v_name = '' then
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

    select count(*), min(x.id::text)::uuid into v_n, v_pid
    from public.participants x
    where btrim(x.name) = v_name and x.school = p ->> 'school';
    if v_n > 1 then
      raise exception 'ambiguous participant %', v_name using errcode = 'P0001', hint = 'ambiguous_person';
    end if;

    if v_pid is null then
      insert into public.participants (name, school, team_id)   -- access_code: random default
      values (v_name, p ->> 'school', v_tid)
      returning id into v_pid;
      p_add := p_add + 1;
    else
      update public.participants x set team_id = v_tid where x.id = v_pid and x.team_id is distinct from v_tid;
      p_upd := p_upd + (case when found then 1 else 0 end);
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
