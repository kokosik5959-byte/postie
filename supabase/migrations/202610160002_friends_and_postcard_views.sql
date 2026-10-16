create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  constraint friendships_not_self check (requester_id <> addressee_id)
);

create unique index if not exists friendships_unique_pair_idx
  on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
create index if not exists friendships_addressee_status_idx on public.friendships (addressee_id, status);
alter table public.friendships enable row level security;
grant select, update, delete on public.friendships to authenticated;

create policy "Users can view their friendships" on public.friendships
  for select to authenticated using (requester_id = (select auth.uid()) or addressee_id = (select auth.uid()));
create policy "Addressees can accept friend requests" on public.friendships
  for update to authenticated using (addressee_id = (select auth.uid()) and status = 'pending')
  with check (addressee_id = (select auth.uid()) and status = 'accepted');
create policy "Participants can decline or remove friendships" on public.friendships
  for delete to authenticated using (requester_id = (select auth.uid()) or addressee_id = (select auth.uid()));

create or replace function public.request_friend_by_email(target_email text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_id uuid;
  existing public.friendships%rowtype;
begin
  if auth.uid() is null then raise exception 'Войди в Postie, чтобы добавить друга.'; end if;
  select u.id into target_id from auth.users u where lower(u.email) = lower(trim(target_email)) limit 1;
  if target_id is null then raise exception 'Аккаунт с такой почтой не найден.'; end if;
  if target_id = auth.uid() then raise exception 'Нельзя добавить в друзья свой аккаунт.'; end if;
  select * into existing from public.friendships f
   where (f.requester_id = auth.uid() and f.addressee_id = target_id)
      or (f.requester_id = target_id and f.addressee_id = auth.uid()) limit 1;
  if existing.id is not null then
    if existing.status = 'accepted' then return 'already_friends'; end if;
    if existing.requester_id = auth.uid() then return 'pending'; end if;
    return 'incoming_pending';
  end if;
  insert into public.friendships(requester_id, addressee_id) values (auth.uid(), target_id);
  return 'pending';
end;
$$;
revoke all on function public.request_friend_by_email(text) from public;
grant execute on function public.request_friend_by_email(text) to authenticated;

alter table public.postcards add column if not exists front_caption_x numeric not null default 50;
alter table public.postcards add column if not exists front_caption_y numeric not null default 80;
alter table public.postcards drop constraint if exists postcards_front_caption_x_range;
alter table public.postcards add constraint postcards_front_caption_x_range check (front_caption_x between 0 and 100);
alter table public.postcards drop constraint if exists postcards_front_caption_y_range;
alter table public.postcards add constraint postcards_front_caption_y_range check (front_caption_y between 0 and 100);

create or replace function public.resolve_postcard_recipient()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.recipient_email is not null then
    select u.id into new.recipient_id from auth.users u
     where lower(u.email) = lower(trim(new.recipient_email)) limit 1;
  end if;
  if new.share_enabled and new.share_token is null then new.share_token := gen_random_uuid(); end if;
  return new;
end;
$$;
