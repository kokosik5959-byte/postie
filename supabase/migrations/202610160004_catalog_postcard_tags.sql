create table if not exists public.catalog_postcard_tags (
  postcard_id text primary key,
  country text not null default '',
  city text not null default '',
  style text not null default '',
  occasion text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.catalog_postcard_tags enable row level security;
grant select on public.catalog_postcard_tags to anon, authenticated;
grant insert, update on public.catalog_postcard_tags to authenticated;

drop policy if exists "Anyone can read catalog postcard tags" on public.catalog_postcard_tags;
create policy "Anyone can read catalog postcard tags" on public.catalog_postcard_tags
  for select to anon, authenticated using (true);

drop policy if exists "Only catalog owner can add tags" on public.catalog_postcard_tags;
create policy "Only catalog owner can add tags" on public.catalog_postcard_tags
  for insert to authenticated
  with check (lower((select auth.jwt() ->> 'email')) = 'kokosik5959@gmail.com');

drop policy if exists "Only catalog owner can edit tags" on public.catalog_postcard_tags;
create policy "Only catalog owner can edit tags" on public.catalog_postcard_tags
  for update to authenticated
  using (lower((select auth.jwt() ->> 'email')) = 'kokosik5959@gmail.com')
  with check (lower((select auth.jwt() ->> 'email')) = 'kokosik5959@gmail.com');
