create extension if not exists pgcrypto;

create type app_role as enum ('user', 'admin');
create type account_status as enum ('active', 'suspended', 'banned');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  username text unique not null,
  avatar_url text,
  status account_status not null default 'active',
  invitation_limit integer not null default 5 check (invitation_limit >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_roles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  role app_role not null default 'user'
);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  inviter_id uuid not null references public.profiles(id) on delete cascade,
  invitee_id uuid references public.profiles(id) on delete set null,
  code text unique not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.movie_categories (id uuid primary key default gen_random_uuid(), name text unique not null);
create table public.movies (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  poster_path text,
  video_path text not null,
  subtitle_path text,
  category_id uuid references public.movie_categories(id),
  release_year integer not null check (release_year between 1888 and 2100),
  language text not null,
  duration_seconds integer check (duration_seconds > 0),
  file_size_bytes bigint check (file_size_bytes >= 0),
  featured boolean not null default false,
  download_count bigint not null default 0,
  published boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.downloads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  movie_id uuid not null references public.movies(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(user_id, movie_id)
);

create table public.conversations (id uuid primary key default gen_random_uuid(), title text, is_group boolean not null default false, created_by uuid references public.profiles(id), created_at timestamptz not null default now());
create table public.conversation_members (conversation_id uuid references public.conversations(id) on delete cascade, user_id uuid references public.profiles(id) on delete cascade, role text not null default 'member', joined_at timestamptz not null default now(), primary key(conversation_id,user_id));
create table public.messages (id uuid primary key default gen_random_uuid(), conversation_id uuid not null references public.conversations(id) on delete cascade, sender_id uuid not null references public.profiles(id) on delete cascade, body text, attachment_path text, reply_to uuid references public.messages(id), deleted_at timestamptz, created_at timestamptz not null default now());
create table public.notifications (id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade, type text not null, title text not null, body text not null, link text, read_at timestamptz, created_at timestamptz not null default now());
create table public.announcements (id uuid primary key default gen_random_uuid(), title text not null, body text not null, published boolean not null default true, created_by uuid references public.profiles(id), created_at timestamptz not null default now());
create table public.user_activity (id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade, action text not null, metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now());
create table public.reports (id uuid primary key default gen_random_uuid(), reporter_id uuid not null references public.profiles(id), target_type text not null, target_id uuid not null, reason text not null, status text not null default 'pending', resolved_by uuid references public.profiles(id), created_at timestamptz not null default now());
create table public.user_presence (user_id uuid primary key references public.profiles(id) on delete cascade, online boolean not null default false, last_seen_at timestamptz not null default now());
create table public.favorites (user_id uuid references public.profiles(id) on delete cascade, movie_id uuid references public.movies(id) on delete cascade, created_at timestamptz not null default now(), primary key(user_id,movie_id));

create index on public.movies(published, created_at desc);
create index on public.messages(conversation_id, created_at desc);
create index on public.notifications(user_id, read_at, created_at desc);
create index on public.downloads(movie_id);

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.user_roles where user_id=auth.uid() and role='admin')
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public as $$
declare base_username text;
begin
  base_username := coalesce(new.raw_user_meta_data->>'username', split_part(new.email,'@',1));
  insert into public.profiles(id,full_name,username)
  values(new.id,coalesce(new.raw_user_meta_data->>'full_name','New Member'),base_username)
  on conflict(username) do update set username=excluded.username||'-'||substr(new.id::text,1,8);
  insert into public.user_roles(user_id,role) values(new.id,'user') on conflict(user_id) do nothing;
  insert into public.user_presence(user_id) values(new.id) on conflict(user_id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.invitations enable row level security;
alter table public.movies enable row level security;
alter table public.movie_categories enable row level security;
alter table public.downloads enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.notifications enable row level security;
alter table public.announcements enable row level security;
alter table public.user_activity enable row level security;
alter table public.reports enable row level security;
alter table public.user_presence enable row level security;
alter table public.favorites enable row level security;

create policy "Public profiles" on public.profiles for select using (true);
create policy "Update own profile" on public.profiles for update using (id=auth.uid()) with check (id=auth.uid());
create policy "Admins manage profiles" on public.profiles for all using (public.is_admin());
create policy "Own role" on public.user_roles for select using (user_id=auth.uid() or public.is_admin());
create policy "Published movies" on public.movies for select using (published=true);
create policy "Admins manage movies" on public.movies for all using (public.is_admin());
create policy "Read categories" on public.movie_categories for select using (true);
create policy "Admins manage categories" on public.movie_categories for all using (public.is_admin());
create policy "Own downloads" on public.downloads for select using (user_id=auth.uid());
create policy "Create own download" on public.downloads for insert with check (user_id=auth.uid());
create policy "Own favorites" on public.favorites for all using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy "Own notifications" on public.notifications for all using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy "Read announcements" on public.announcements for select using (published=true);
create policy "Admins manage announcements" on public.announcements for all using (public.is_admin());
create policy "Own invitations" on public.invitations for select using (inviter_id=auth.uid() or invitee_id=auth.uid());
create policy "Create invitation" on public.invitations for insert with check (inviter_id=auth.uid());
create policy "Own presence" on public.user_presence for all using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy "Own activity" on public.user_activity for select using (user_id=auth.uid() or public.is_admin());
create policy "Create report" on public.reports for insert with check (reporter_id=auth.uid());
create policy "Manage own or admin reports" on public.reports for select using (reporter_id=auth.uid() or public.is_admin());
create policy "Admin report management" on public.reports for update using (public.is_admin());
create policy "Conversation members" on public.conversations for select using (exists(select 1 from public.conversation_members cm where cm.conversation_id=conversations.id and cm.user_id=auth.uid()));
create policy "Own memberships" on public.conversation_members for select using (user_id=auth.uid() or public.is_admin());
create policy "Read member messages" on public.messages for select using (exists(select 1 from public.conversation_members cm where cm.conversation_id=messages.conversation_id and cm.user_id=auth.uid()));
create policy "Send member message" on public.messages for insert with check (sender_id=auth.uid() and exists(select 1 from public.conversation_members cm where cm.conversation_id=messages.conversation_id and cm.user_id=auth.uid()));
create policy "Delete own message" on public.messages for update using (sender_id=auth.uid()) with check (sender_id=auth.uid());

insert into storage.buckets(id,name,public) values('avatars','avatars',true),('posters','posters',false),('movies','movies',false),('subtitles','subtitles',false),('chat-files','chat-files',false) on conflict(id) do nothing;

create policy "Public avatar read" on storage.objects for select using (bucket_id='avatars');
create policy "Users upload avatar" on storage.objects for insert with check (bucket_id='avatars' and auth.uid() is not null);
create policy "Authorized movie read" on storage.objects for select using (bucket_id='movies' and auth.uid() is not null);
create policy "Admins manage private media" on storage.objects for all using (bucket_id in ('posters','movies','subtitles','chat-files') and public.is_admin());
