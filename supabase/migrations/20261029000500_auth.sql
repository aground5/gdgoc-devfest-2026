-- Who may have an account, and linking auth users to participant/staff rows.
--   Staff: whitelisted emails in public.staff, signing in with an email magic link / code.
--   Participants: staff-issued login codes. The app creates the auth user
--   <login_id>@participants.devfest.invalid (password = secret) through the admin API.

create function private.participant_login_id(p_email text)
returns text
language sql immutable set search_path = ''
as $$
  select case when lower(p_email) like '%@participants.devfest.invalid'
    then upper(split_part(p_email, '@', 1)) end
$$;

-- Auth hook: reject every sign-up that isn't a whitelisted staff email or a registered participant id.
create function public.hook_before_user_created(event jsonb)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_email text := lower(event -> 'user' ->> 'email');
  v_login text := private.participant_login_id(v_email);
begin
  if (v_login is not null and exists (select 1 from public.participant_private where login_id = v_login))
     or (v_login is null and exists (select 1 from public.staff where email = v_email)) then
    return '{}'::jsonb;
  end if;
  return jsonb_build_object(
    'error', jsonb_build_object('http_code', 403, 'message', '등록되지 않은 계정입니다.')
  );
end
$$;

revoke execute on function public.hook_before_user_created(jsonb) from public, anon, authenticated;
-- Runs as its owner (security definer), so the auth role only needs execute.
grant execute on function public.hook_before_user_created(jsonb) to supabase_auth_admin;

-- New auth user -> link the matching participant or staff row.
create function private.link_auth_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_login text := private.participant_login_id(new.email);
begin
  if v_login is not null then
    update public.participant_private set user_id = new.id where login_id = v_login;
  else
    update public.staff set user_id = new.id where email = lower(new.email);
  end if;
  return new;
end
$$;

create trigger link_auth_user
  after insert or update of email on auth.users
  for each row execute function private.link_auth_user();

-- Staff row added (or email changed) after that person already has an account -> link it now.
create function private.link_staff_by_email()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.email is distinct from old.email then
    new.email := lower(new.email);
    new.user_id := (select id from auth.users where lower(email) = new.email limit 1);
  end if;
  return new;
end
$$;

create trigger staff_link
  before insert or update of email on public.staff
  for each row execute function private.link_staff_by_email();

revoke all on all functions in schema private from public, anon, authenticated;
