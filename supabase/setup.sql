-- Run once in the SQL Editor of a new Supabase project.
begin;
create table public.tracker_members (
  user_id uuid primary key references auth.users(id) on delete cascade
);
create table public.tracker_settings (
  id integer primary key check (id = 1),
  start date
);
insert into public.tracker_settings(id) values (1);
create table public.dose_entries (
  id uuid primary key,
  medicine text not null,
  dose text not null,
  at timestamptz not null check (at <= now() + interval '1 minute'),
  note text not null default '' check (length(note) <= 500),
  constraint valid_dose check (
    (medicine = 'oxycodone' and dose in ('1 tablet (5 mg)', '2 tablets (10 mg)')) or
    (medicine = 'ibuprofen' and dose = '800 mg') or
    (medicine = 'tylenol' and dose = '1 tablet (500 mg)') or
    (medicine = 'gabapentin' and dose = '300 mg') or
    (medicine = 'aspirin' and dose = '1 tablet (325 mg)') or
    (medicine = 'zofran' and dose = '1 tablet (4 mg)') or
    (medicine in ('calcium', 'vitamin-c', 'vitamin-d') and dose = 'Dosage unknown') or
    (medicine = 'miralax' and dose in ('Dosage unknown', '17 g'))
  )
);
create index dose_entries_time on public.dose_entries(at desc, id);
alter table public.tracker_members enable row level security;
alter table public.tracker_settings enable row level security;
alter table public.dose_entries enable row level security;
revoke all on public.tracker_members, public.tracker_settings, public.dose_entries from anon, authenticated;
grant select on public.tracker_members to authenticated;
grant select, update on public.tracker_settings to authenticated;
grant select, insert, delete on public.dose_entries to authenticated;
create policy member_self on public.tracker_members for select to authenticated
  using (user_id = (select auth.uid()));
create policy settings_read on public.tracker_settings for select to authenticated
  using (exists(select 1 from public.tracker_members where user_id = (select auth.uid())));
create policy settings_write on public.tracker_settings for update to authenticated
  using (exists(select 1 from public.tracker_members where user_id = (select auth.uid())))
  with check (exists(select 1 from public.tracker_members where user_id = (select auth.uid())));
create policy entries_read on public.dose_entries for select to authenticated
  using (exists(select 1 from public.tracker_members where user_id = (select auth.uid())));
create policy entries_insert on public.dose_entries for insert to authenticated
  with check (exists(select 1 from public.tracker_members where user_id = (select auth.uid())));
create policy entries_delete on public.dose_entries for delete to authenticated
  using (exists(select 1 from public.tracker_members where user_id = (select auth.uid())));
commit;
