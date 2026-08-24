alter table public.songs add column if not exists source_file text;

drop index if exists public.songs_source_file_uidx;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'songs_source_file_key'
      and conrelid = 'public.songs'::regclass
  ) then
    alter table public.songs
      add constraint songs_source_file_key unique (source_file);
  end if;
end
$$;