-- Run once in Supabase if schema.sql was already executed before source_file was added.
alter table public.songs add column if not exists source_file text;
create unique index if not exists songs_source_file_uidx
  on public.songs (source_file)
  where source_file is not null;