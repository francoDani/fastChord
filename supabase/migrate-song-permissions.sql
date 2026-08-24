-- Run once in Supabase after the initial schema to secure song creation attribution.
drop policy if exists songs_editor_insert on public.songs;

create policy songs_editor_insert on public.songs for insert
  with check (public.is_editor_or_admin() and created_by = auth.uid() and
    updated_by = auth.uid() and is_official = true and deleted_at is null);