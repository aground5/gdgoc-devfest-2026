-- Logout: unbind the current auth user from its participant before signing out,
-- so the row doesn't keep pointing at an anonymous account nobody can reuse.
create or replace function public.release_participant()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.participants set user_id = null where user_id = auth.uid();
$$;

revoke all on function public.release_participant() from public, anon;
grant execute on function public.release_participant() to authenticated;
