-- FastChord: playlists, fixed liturgical slots and share links.
-- Run after schema.sql and the previous migrations.

alter table public.playlists
  add column if not exists share_token text;

update public.playlists
set share_token = encode(gen_random_bytes(16), 'hex')
where share_token is null;

alter table public.playlists
  alter column share_token set default encode(gen_random_bytes(16), 'hex');

alter table public.playlists
  alter column share_token set not null;

create unique index if not exists playlists_share_token_uidx
  on public.playlists (share_token);

alter table public.playlist_songs
  add column if not exists slot text;

update public.playlist_songs
set slot = 'comunion'
where slot is null;

alter table public.playlist_songs
  alter column slot set not null;

alter table public.playlist_songs
  drop constraint if exists playlist_songs_slot_check;

alter table public.playlist_songs
  add constraint playlist_songs_slot_check check (
    slot in (
      'entrada', 'perdon', 'gloria', 'aleluya', 'ofertorio',
      'santo', 'cordero', 'comunion', 'meditacion', 'salida'
    )
  );

alter table public.playlist_songs
  drop constraint if exists playlist_songs_pkey;

alter table public.playlist_songs
  add constraint playlist_songs_pkey primary key (playlist_id, slot, song_id);

drop index if exists playlist_songs_single_slot_uidx;
create unique index playlist_songs_single_slot_uidx
  on public.playlist_songs (playlist_id, slot)
  where slot <> 'comunion';

drop policy if exists playlists_public_read on public.playlists;
create policy playlists_authenticated_read on public.playlists for select
  using (auth.uid() is not null and deleted_at is null);

drop policy if exists playlist_songs_public_read on public.playlist_songs;
create policy playlist_songs_authenticated_read on public.playlist_songs for select
  using (
    auth.uid() is not null and exists (
      select 1 from public.playlists p
      where p.id = playlist_id and p.deleted_at is null
    )
  );

drop function if exists public.get_shared_playlist(text);

create function public.get_shared_playlist(requested_token text)
returns table (
  playlist_id uuid,
  playlist_name text,
  playlist_description text,
  song_id uuid,
  song_title text,
  song_artist text,
  song_category text,
  song_body text,
  song_youtube text,
  slot text,
  song_position integer
)
language sql stable security definer set search_path = public
as $$
  select
    p.id, p.name, p.description,
    s.id, s.title, s.artist, s.category, s.body, s.youtube,
    ps.slot, ps.position as song_position
  from public.playlists p
  join public.playlist_songs ps on ps.playlist_id = p.id
  join public.songs s on s.id = ps.song_id
  where p.share_token = requested_token
    and p.deleted_at is null
    and s.deleted_at is null
  order by ps.position asc;
$$;

revoke all on function public.get_shared_playlist(text) from public;
grant execute on function public.get_shared_playlist(text) to anon, authenticated;