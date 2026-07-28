-- These 5 columns were added for a manual "review form" (education, work
-- experience, skills, certifications, overall assessment) that duplicated
-- what's already on the applicant's resume — nothing in the public
-- application form collects this as structured data, so HR was being asked
-- to hand-transcribe it for no real benefit. Removed per product decision;
-- confirmed unused (added and dropped within the same milestone, no other
-- module depends on them). `notes` (Recruitment Notes) is left in place —
-- it predates this migration as part of the original Phase 0 schema and
-- isn't this migration's to remove.
alter table public.applications
  drop column education,
  drop column work_experience,
  drop column skills,
  drop column certifications,
  drop column overall_assessment;

