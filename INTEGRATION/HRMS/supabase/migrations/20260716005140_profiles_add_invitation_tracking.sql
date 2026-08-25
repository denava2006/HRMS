alter table public.profiles
  add column invited_at timestamptz,
  add column activated_at timestamptz;
