-- Change events for the app's live views (RLS still filters what each user receives)
alter publication supabase_realtime add table public.participants, public.teams, public.attendance, public.attendance_settings;
