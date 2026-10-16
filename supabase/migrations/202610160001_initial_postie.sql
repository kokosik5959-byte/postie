create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Друг Postie',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
create policy "Signed-in users can view display names" on public.profiles
  for select to authenticated using (true);
create policy "Users can update their own profile" on public.profiles
  for update to authenticated using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), 'Друг Postie'))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_postie on auth.users;
create trigger on_auth_user_created_postie
  after insert on auth.users
  for each row execute procedure public.create_profile_for_new_user();

create table if not exists public.postcards (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid references public.profiles(id) on delete set null,
  recipient_email text,
  title text not null default 'Тёплая открытка',
  image_path text not null,
  front_caption text not null default '',
  message text not null default '',
  share_token uuid unique,
  share_enabled boolean not null default false,
  opened_at timestamptz,
  created_at timestamptz not null default now(),
  constraint postcards_recipient_required check (recipient_id is not null or recipient_email is not null or share_enabled)
);

create index if not exists postcards_sender_created_idx on public.postcards (sender_id, created_at desc);
create index if not exists postcards_recipient_created_idx on public.postcards (recipient_id, created_at desc);

create or replace function public.resolve_postcard_recipient()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.recipient_email is not null then
    select u.id into new.recipient_id
    from auth.users as u
    where lower(u.email) = lower(trim(new.recipient_email))
    limit 1;
  else
    new.recipient_id := null;
  end if;
  if new.share_enabled and new.share_token is null then
    new.share_token := gen_random_uuid();
  end if;
  return new;
end;
$$;

drop trigger if exists resolve_postcard_recipient_before_write on public.postcards;
create trigger resolve_postcard_recipient_before_write
  before insert or update of recipient_email, share_enabled on public.postcards
  for each row execute procedure public.resolve_postcard_recipient();

alter table public.postcards enable row level security;
create policy "Senders and recipients can view postcards" on public.postcards
  for select to authenticated using (sender_id = (select auth.uid()) or recipient_id = (select auth.uid()));
create policy "Authenticated users can send their postcards" on public.postcards
  for insert to authenticated with check (sender_id = (select auth.uid()));
create policy "Senders can edit their postcards" on public.postcards
  for update to authenticated using (sender_id = (select auth.uid()))
  with check (sender_id = (select auth.uid()));
create policy "Senders can delete their postcards" on public.postcards
  for delete to authenticated using (sender_id = (select auth.uid()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('postcard-images', 'postcard-images', false, 12582912, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false, file_size_limit = 12582912, allowed_mime_types = excluded.allowed_mime_types;

create policy "Users can upload their postcard images" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'postcard-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy "Users and recipients can view postcard images" on storage.objects
  for select to authenticated using (
    bucket_id = 'postcard-images'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or exists (
        select 1 from public.postcards as p
        where p.image_path = name
          and (p.sender_id = (select auth.uid()) or p.recipient_id = (select auth.uid()))
      )
    )
  );
create policy "Users can replace their postcard images" on storage.objects
  for update to authenticated using (
    bucket_id = 'postcard-images' and (storage.foldername(name))[1] = (select auth.uid())::text
  ) with check (
    bucket_id = 'postcard-images' and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy "Users can delete their postcard images" on storage.objects
  for delete to authenticated using (
    bucket_id = 'postcard-images' and (storage.foldername(name))[1] = (select auth.uid())::text
  );
