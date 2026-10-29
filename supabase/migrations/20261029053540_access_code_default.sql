-- participants.access_code defaults to generate_access_code(), which runs as the
-- inserting role. Staff insert as `authenticated`, so they need EXECUTE.
-- (It only returns a random string; RLS still decides who may insert.)
grant execute on function public.generate_access_code(int) to authenticated;
