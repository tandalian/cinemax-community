create table public.message_likes (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

create index message_likes_user_id_idx on public.message_likes(user_id);

alter table public.message_likes enable row level security;
alter table public.messages
  add constraint messages_body_length_check
  check (body is null or char_length(body) <= 4000) not valid;

create or replace function public.is_conversation_member(target_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.conversation_members
    where conversation_id = target_conversation_id
      and user_id = auth.uid()
  )
$$;

revoke all on function public.is_conversation_member(uuid) from public, anon;
grant execute on function public.is_conversation_member(uuid) to authenticated;

drop policy "Own memberships" on public.conversation_members;
create policy "Read conversation participants"
  on public.conversation_members for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_conversation_member(conversation_id)
    or public.is_admin()
  );

drop policy "Create invitation" on public.invitations;

create or replace function public.create_invitation()
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_user_id uuid := auth.uid();
  allowed_invites integer;
  used_invites integer;
  invite_code text;
begin
  if current_user_id is null then
    raise exception 'Sign in to create an invitation.';
  end if;

  select invitation_limit into allowed_invites
  from public.profiles
  where id = current_user_id and status = 'active'
  for update;

  if not found then
    raise exception 'An active member profile is required to invite friends.';
  end if;

  select count(*) into used_invites
  from public.invitations
  where inviter_id = current_user_id;

  if used_invites >= allowed_invites then
    raise exception 'You have used all of your invitations.';
  end if;

  loop
    invite_code := encode(gen_random_bytes(12), 'hex');
    exit when not exists (
      select 1 from public.invitations where code = invite_code
    );
  end loop;

  insert into public.invitations (inviter_id, code)
  values (current_user_id, invite_code);

  return invite_code;
end
$$;

revoke all on function public.create_invitation() from public, anon;
grant execute on function public.create_invitation() to authenticated;

create or replace function public.start_direct_conversation(target_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_user_id uuid := auth.uid();
  direct_conversation_id uuid;
begin
  if current_user_id is null then
    raise exception 'Sign in to start a conversation.';
  end if;
  if target_user_id is null or target_user_id = current_user_id then
    raise exception 'Choose another community member.';
  end if;
  if not exists (
    select 1 from public.profiles
    where id = current_user_id and status = 'active'
  ) or not exists (
    select 1 from public.profiles
    where id = target_user_id and status = 'active'
  ) then
    raise exception 'Both members must have active accounts.';
  end if;

  perform pg_advisory_xact_lock(
    hashtext(least(current_user_id::text, target_user_id::text) || ':' ||
      greatest(current_user_id::text, target_user_id::text))
  );

  select conversation.id into direct_conversation_id
  from public.conversations as conversation
  where conversation.is_group = false
    and exists (
      select 1 from public.conversation_members
      where conversation_id = conversation.id and user_id = current_user_id
    )
    and exists (
      select 1 from public.conversation_members
      where conversation_id = conversation.id and user_id = target_user_id
    )
    and (
      select count(*) from public.conversation_members
      where conversation_id = conversation.id
    ) = 2
  order by conversation.created_at
  limit 1;

  if direct_conversation_id is not null then
    return direct_conversation_id;
  end if;

  insert into public.conversations (is_group, created_by)
  values (false, current_user_id)
  returning id into direct_conversation_id;

  insert into public.conversation_members (conversation_id, user_id)
  values
    (direct_conversation_id, current_user_id),
    (direct_conversation_id, target_user_id);

  return direct_conversation_id;
end
$$;

revoke all on function public.start_direct_conversation(uuid) from public, anon;
grant execute on function public.start_direct_conversation(uuid) to authenticated;

create or replace function public.protect_profile_account_fields()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is not null
    and not public.is_admin()
    and (
      new.status is distinct from old.status
      or new.invitation_limit is distinct from old.invitation_limit
    )
  then
    raise exception 'Only administrators can change account status or invitation limits.';
  end if;
  return new;
end
$$;

create trigger protect_profile_account_fields
before update on public.profiles
for each row execute function public.protect_profile_account_fields();

create policy "Read member presence"
  on public.user_presence for select to authenticated
  using (true);

drop policy "Own presence" on public.user_presence;
create policy "Update own presence"
  on public.user_presence for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Read likes in member conversations"
  on public.message_likes for select to authenticated
  using (
    exists (
      select 1
      from public.messages
      where id = message_likes.message_id
        and public.is_conversation_member(conversation_id)
    )
  );

create policy "Like messages in member conversations"
  on public.message_likes for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.messages
      where id = message_likes.message_id
        and public.is_conversation_member(conversation_id)
    )
  );

create policy "Unlike own messages in member conversations"
  on public.message_likes for delete to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1
      from public.messages
      where id = message_likes.message_id
        and public.is_conversation_member(conversation_id)
    )
  );

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  base_username text;
  invitation_code text;
begin
  base_username := coalesce(
    new.raw_user_meta_data->>'username',
    split_part(new.email, '@', 1)
  );

  insert into public.profiles (id, full_name, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', 'New Member'),
    base_username
  )
  on conflict (username) do update
    set username = excluded.username || '-' || substr(new.id::text, 1, 8);

  insert into public.user_roles (user_id, role)
  values (new.id, 'user')
  on conflict (user_id) do nothing;

  insert into public.user_presence (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  invitation_code := nullif(trim(new.raw_user_meta_data->>'invitation_code'), '');
  if invitation_code is not null then
    update public.invitations
    set invitee_id = new.id, used_at = now()
    where code = invitation_code
      and invitee_id is null
      and used_at is null
      and inviter_id <> new.id;

    if not found then
      raise exception 'This invitation link is invalid or has already been used.';
    end if;
  end if;

  return new;
end
$$;
