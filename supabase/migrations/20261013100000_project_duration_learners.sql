-- Issue #1: a rough duration instead of exact dates, and an "open to learners"
-- flag. Both are additive: existing rows keep their dates and default to
-- not open to learners, and older app builds that don't send them still work.
alter table public.projects
  add column duration text
    constraint projects_duration_check
    check (duration in ('under_1_month', '1_3_months', '3_6_months', 'flexible')),
  add column open_to_learners boolean not null default false;

comment on column public.projects.duration is
  'Rough length chosen at creation. Null on projects created before 2026-10-13, which use start_date/end_date.';
comment on column public.projects.open_to_learners is
  'The owner welcomes people who want to learn the skills, not only people who have them.';
