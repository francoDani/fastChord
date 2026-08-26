-- Fix RLS policies to allow soft-delete for Editors and Admins on playlists and songs

-- 1. Playlists: Allow Editors/Admins to SELECT soft-deleted rows during UPDATE returning evaluation
drop policy if exists playlists_authenticated_read on public.playlists;
drop policy if exists playlists_public_read on public.playlists;

create policy playlists_authenticated_read on public.playlists for select
  using (auth.uid() is not null and (deleted_at is null or public.is_editor_or_admin()));

drop policy if exists playlists_editor_update on public.playlists;

create policy playlists_editor_update on public.playlists for update
  using (public.is_editor_or_admin())
  with check (public.is_editor_or_admin());

-- 2. Playlist Songs: Allow Editors/Admins to SELECT songs from soft-deleted playlists if needed
drop policy if exists playlist_songs_authenticated_read on public.playlist_songs;
drop policy if exists playlist_songs_public_read on public.playlist_songs;

create policy playlist_songs_authenticated_read on public.playlist_songs for select
  using (
    auth.uid() is not null and exists (
      select 1 from public.playlists p
      where p.id = playlist_id and (p.deleted_at is null or public.is_editor_or_admin())
    )
  );

-- 3. Songs: Allow Editors/Admins to SELECT soft-deleted songs during UPDATE returning evaluation
drop policy if exists songs_public_read on public.songs;

create policy songs_public_read on public.songs for select
  using (deleted_at is null or public.is_editor_or_admin());
