-- Migration script for Playlist Types (Misa vs Custom) and Ofertorio+ slot

-- 1. Add type column to public.playlists if not exists
alter table public.playlists
  add column if not exists type text not null default 'misa';

-- 2. Drop existing slot check constraint on playlist_songs and add updated constraint or drop it
alter table public.playlist_songs
  drop constraint if exists playlist_songs_slot_check;

-- 3. Update get_shared_playlist RPC function to include playlist_type
drop function if exists public.get_shared_playlist(text);

create function public.get_shared_playlist(requested_token text)
returns table (
  playlist_id uuid,
  playlist_name text,
  playlist_description text,
  playlist_type text,
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
    p.id, p.name, p.description, p.type as playlist_type,
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
