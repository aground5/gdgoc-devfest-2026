-- Change feeds the screens subscribe to (they refetch on any change; RLS filters per subscriber).
alter publication supabase_realtime add table
  public.teams, public.participants, public.participant_private, public.investments,
  public.ticks, public.demo_entries, public.demo_assets;
