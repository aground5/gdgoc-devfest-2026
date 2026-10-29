-- Initial staff accounts (Google). Add more here or from the dashboard.
insert into public.staff_emails (email, note) values
  ('aground5@korea.ac.kr', '운영진')
on conflict (email) do nothing;
