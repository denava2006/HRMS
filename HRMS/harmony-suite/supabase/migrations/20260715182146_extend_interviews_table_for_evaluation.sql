-- The interviews table (interview_type, status, scheduled_at, interviewer_id, mode,
-- location, remarks) already exists from the Phase 0 scaffold, along with RLS
-- (interviews_staff_all) and the interview_type/interview_status enums. This adds
-- the evaluation-specific columns needed for the Interview Management module.

alter table public.interviews
  add column meeting_link text,
  add column rating_communication smallint check (rating_communication between 1 and 5),
  add column rating_technical_skills smallint check (rating_technical_skills between 1 and 5),
  add column rating_confidence smallint check (rating_confidence between 1 and 5),
  add column rating_experience smallint check (rating_experience between 1 and 5),
  add column rating_problem_solving smallint check (rating_problem_solving between 1 and 5),
  add column overall_impression text,
  add column interview_notes text,
  add column rating_technical_evaluation smallint check (rating_technical_evaluation between 1 and 5),
  add column rating_culture_fit smallint check (rating_culture_fit between 1 and 5),
  add column rating_leadership smallint check (rating_leadership between 1 and 5),
  add column final_remarks text,
  add column recommended_salary numeric(12,2),
  add column overall_recommendation text,
  add column rejection_reason text;

alter table public.interviews
  add constraint interviews_mode_check check (mode in ('online', 'face_to_face'));

alter table public.interviews
  add constraint interviews_application_stage_unique unique (application_id, interview_type);

alter table public.interviews replica identity full;
alter publication supabase_realtime add table public.interviews;

-- Extend the application_history event vocabulary for interview actions
alter table public.application_history drop constraint application_history_event_check;
alter table public.application_history add constraint application_history_event_check
  check (event = any (array[
    'submitted', 'reviewed', 'qualified', 'rejected', 'rejection_email_queued',
    'initial_interview_scheduled', 'initial_interview_started', 'initial_interview_passed', 'initial_interview_rejected',
    'final_interview_scheduled', 'final_interview_started', 'final_interview_rejected', 'hired',
    'interview_scheduled_email_queued', 'hired_email_queued'
  ]));

