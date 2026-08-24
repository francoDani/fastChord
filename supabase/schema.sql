-- FastChord: initial Supabase schema

create type public.user_role as enum ('readonly', 'editor', 'admin');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  role public.user_role not null default 'readonly',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.songs (
  id uuid primary key default gen_random_uuid(),
  source_file text unique,
  title text not null,
  artist text not null default '',
  category text not null default '',
  body text not null default '',
  youtube text not null default '',
  is_official boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.song_notes (
  song_id uuid not null references public.songs(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null default '',
  updated_at timestamptz not null default now(),
  primary key (song_id, user_id)
);

create table public.playlists (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_by uuid references public.profiles(id) on delete set null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.playlist_songs (
  playlist_id uuid not null references public.playlists(id) on delete cascade,
  song_id uuid not null references public.songs(id) on delete restrict,
  position integer not null check (position >= 0),
  primary key (playlist_id, song_id),
  unique (playlist_id, position)
);

create index songs_title_idx on public.songs (lower(title));
create index songs_active_idx on public.songs (deleted_at) where deleted_at is null;
create index playlists_active_idx on public.playlists (deleted_at) where deleted_at is null;
create index playlist_songs_order_idx on public.playlist_songs (playlist_id, position);

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') $$;

create or replace function public.is_editor_or_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.profiles where id = auth.uid() and role in ('editor', 'admin')) $$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, coalesce(new.email, ''), coalesce(new.raw_user_meta_data ->> 'full_name', new.email));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.songs enable row level security;
alter table public.song_notes enable row level security;
alter table public.playlists enable row level security;
alter table public.playlist_songs enable row level security;

create policy profiles_read_own_or_admin on public.profiles for select
  using (id = auth.uid() or public.is_admin());
create policy profiles_admin_manage on public.profiles for update
  using (public.is_admin()) with check (public.is_admin());

create policy songs_public_read on public.songs for select
  using (deleted_at is null);
create policy songs_editor_insert on public.songs for insert
  with check (public.is_editor_or_admin() and created_by = auth.uid() and
    updated_by = auth.uid() and is_official = true and deleted_at is null);
create policy songs_editor_update on public.songs for update
  using (public.is_editor_or_admin())
  with check (public.is_editor_or_admin() and is_official = true);
create policy songs_admin_delete on public.songs for delete
  using (public.is_admin());

create policy notes_owner_read on public.song_notes for select
  using (user_id = auth.uid());
create policy notes_owner_insert on public.song_notes for insert
  with check (user_id = auth.uid());
create policy notes_owner_update on public.song_notes for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notes_owner_delete on public.song_notes for delete
  using (user_id = auth.uid());

create policy playlists_public_read on public.playlists for select
  using (deleted_at is null);
create policy playlists_editor_insert on public.playlists for insert
  with check (public.is_editor_or_admin() and deleted_at is null);
create policy playlists_editor_update on public.playlists for update
  using (public.is_editor_or_admin()) with check (public.is_editor_or_admin());
create policy playlists_admin_delete on public.playlists for delete
  using (public.is_admin());

create policy playlist_songs_public_read on public.playlist_songs for select
  using (exists (select 1 from public.playlists p where p.id = playlist_id and p.deleted_at is null));
create policy playlist_songs_editor_insert on public.playlist_songs for insert
  with check (public.is_editor_or_admin());
create policy playlist_songs_editor_update on public.playlist_songs for update
  using (public.is_editor_or_admin()) with check (public.is_editor_or_admin());
create policy playlist_songs_editor_delete on public.playlist_songs for delete
  using (public.is_editor_or_admin());