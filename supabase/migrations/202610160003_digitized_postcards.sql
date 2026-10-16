create table if not exists public.digitized_postcards (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null default 'Старая открытка',
  front_image_path text not null,
  back_image_path text not null,
  notes text not null default '',
  created_at timestamptz not null default now(),
  constraint digitized_postcards_title_length check (char_length(title) between 1 and 100),
  constraint digitized_postcards_notes_length check (char_length(notes) <= 2000),
  constraint digitized_postcards_distinct_sides check (front_image_path <> back_image_path)
);

create index if not exists digitized_postcards_owner_created_idx
  on public.digitized_postcards (owner_id, created_at desc);

alter table public.digitized_postcards enable row level security;
grant select, insert, delete on public.digitized_postcards to authenticated;

create policy "Owners can view their digitized postcards" on public.digitized_postcards
  for select to authenticated using (owner_id = (select auth.uid()));
create policy "Owners can add their digitized postcards" on public.digitized_postcards
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "Owners can delete their digitized postcards" on public.digitized_postcards
  for delete to authenticated using (owner_id = (select auth.uid()));
