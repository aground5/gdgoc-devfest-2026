-- Staff manage the staff whitelist from /organize. Every staff member may add,
-- edit the note of, and remove emails, except their own: removing yourself
-- (or renaming your own email) would lock you out, so the database refuses it.

-- Who added each email (the adder's sign-in email, kept as text so it
-- survives that person being removed)
alter table public.staff_emails
  add column added_by text default lower(auth.jwt() ->> 'email');

-- The caller's sign-in email, lowercased like staff_emails.email
create or replace function public.my_email()
returns text
language sql
stable
set search_path = ''
as $$
  select lower(auth.jwt() ->> 'email');
$$;

revoke all on function public.my_email() from public, anon;
grant execute on function public.my_email() to authenticated;

-- Email is the key and is never updated; only the note can change
grant select, insert, delete on public.staff_emails to authenticated;
grant update (note) on public.staff_emails to authenticated;

create policy "staff read whitelist"
  on public.staff_emails for select to authenticated
  using ((select public.is_staff()));

create policy "staff add to whitelist"
  on public.staff_emails for insert to authenticated
  with check ((select public.is_staff()));

create policy "staff edit whitelist notes"
  on public.staff_emails for update to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));

create policy "staff remove others from whitelist"
  on public.staff_emails for delete to authenticated
  using ((select public.is_staff()) and email <> (select public.my_email()));

alter publication supabase_realtime add table public.staff_emails;
