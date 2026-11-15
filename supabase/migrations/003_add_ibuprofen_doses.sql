-- Run after 002_add_miralax.sql in Supabase SQL Editor.
-- Preserves existing records (including 800 mg doses) and access policies.
begin;
alter table public.dose_entries drop constraint valid_dose;
alter table public.dose_entries add constraint valid_dose check (
  (medicine = 'oxycodone' and dose in ('1 tablet (5 mg)', '2 tablets (10 mg)')) or
  (medicine = 'ibuprofen' and dose in ('800 mg', '600 mg', '400 mg', '200 mg')) or
  (medicine = 'tylenol' and dose = '1 tablet (500 mg)') or
  (medicine = 'gabapentin' and dose = '300 mg') or
  (medicine = 'aspirin' and dose = '1 tablet (325 mg)') or
  (medicine = 'zofran' and dose = '1 tablet (4 mg)') or
  (medicine in ('calcium', 'vitamin-c', 'vitamin-d') and dose = 'Dosage unknown') or
  (medicine = 'miralax' and dose in ('Dosage unknown', '17 g'))
);
commit;
