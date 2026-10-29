-- Mock data from src/data/guide.ts (seedTeams, seedParticipants).
-- Access codes are fixed so the mockup can be tested; replace them before the real event.
-- Loaded with `supabase db push --include-seed`; skipped if teams already has rows.

do $$
begin
  if exists (select 1 from public.teams) then
    return;
  end if;

  insert into public.teams (name, table_label, project, description) values
    ('Vision Makers', 'A-01', 'SightLine', '시각장애인을 위한 Gemini 기반 길 안내 앱'),
    ('Blue Byte', 'A-02', 'StudyMate', '강의 녹음을 요약해 주는 학습 도우미'),
    ('Green Light', 'A-03', 'EcoRoute', '탄소 배출이 가장 적은 경로 추천'),
    ('Sky Lab', 'B-01', 'LabNote', '실험 노트를 자동으로 정리하는 AI'),
    ('Crimson Code', 'B-02', 'CampusEats', '학식 메뉴와 혼잡도를 한눈에'),
    ('Eagle Eye', 'B-03', 'SafeWalk', '야간 귀갓길 안심 동행 서비스'),
    ('Sprout', 'C-01', 'PlantPal', '사진 한 장으로 식물 상태 진단'),
    ('Orbit', 'C-02', 'SpaceQuiz', '우주 과학 퀴즈로 배우는 물리');

  create temp table seed_people (name text, school text, table_label text, code text, checked_in boolean) on commit drop;
  insert into seed_people values
    ('김민준', 'ku', 'A-01', 'G9CT38', true),
    ('이서연', 'yu', 'A-01', 'WSTHDQ', true),
    ('박도윤', 'kaist', 'A-01', 'B2HJVZ', true),
    ('최하은', 'ku', 'A-01', 'M6CXQ2', false),
    ('정지호', 'yu', 'A-02', 'P34692', true),
    ('강수아', 'yu', 'A-02', 'ASDXMD', true),
    ('윤시우', 'yu', 'A-02', 'RPD9D4', false),
    ('조예준', 'skku', 'A-03', 'UTF4MB', false),
    ('한지민', 'ku', 'A-03', 'EG8Z5J', false),
    ('오서준', 'kaist', 'A-03', '8AZ67B', false),
    ('신유나', 'skku', 'A-03', '284NH8', false),
    ('임건우', 'kaist', 'B-01', '3PDBGE', true),
    ('서하린', 'kaist', 'B-01', 'HVYZD2', true),
    ('황준서', 'skku', 'B-01', 'JGEJD5', false),
    ('송지안', 'ku', 'B-02', 'E34DGN', false),
    ('문채원', 'ku', 'B-02', 'NWCEAX', false),
    ('배현우', 'ku', 'B-02', 'T7REF8', false),
    ('권도현', 'yu', 'B-03', '3GRKN3', true),
    ('유소율', 'skku', 'B-03', 'XNATXB', true),
    ('장민서', 'ku', 'B-03', '8Z4XDR', true),
    ('노은우', 'kaist', 'B-03', 'Q68DPF', false),
    ('홍예린', 'skku', 'C-01', '5HB9K2', true),
    ('전시윤', 'skku', 'C-01', 'SHUJ9R', true),
    ('고태윤', 'yu', 'C-01', '9RTRJ2', false),
    ('남지우', 'kaist', 'C-02', 'DBK2VY', false),
    ('심하준', 'ku', 'C-02', 'Q2P2X5', false),
    ('류다인', 'kaist', 'C-02', 'FKFS47', false),
    ('이도현', 'yu', null, '4MYZJV', false);

  insert into public.participants (name, school, team_id, access_code)
  select v.name, v.school, t.id, v.code
  from seed_people v
  left join public.teams t on t.table_label = v.table_label;

  -- Mock check-ins (checked_in = true in guide.ts)
  insert into public.attendance (participant_id, method)
  select p.id, 'staff'
  from seed_people v
  join public.participants p on p.access_code = v.code
  where v.checked_in;
end
$$;
