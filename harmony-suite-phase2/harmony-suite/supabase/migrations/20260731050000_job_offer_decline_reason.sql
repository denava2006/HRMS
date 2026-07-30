-- A declined offer told HR nothing about why.
--
-- The application came back as "Offer Declined" with no explanation, so the
-- one piece of information worth having from a lost candidate — was it the
-- salary, the location, the schedule, or a competing offer — was never
-- captured. HR had to guess, or ask.
--
-- The applicant picks a reason from a fixed list when declining, with optional
-- notes. Accepting asks for nothing.

alter table public.job_offers
  add column if not exists decline_reason text,
  add column if not exists decline_notes text;

comment on column public.job_offers.decline_reason is
  'One of the fixed choices offered to the applicant when declining. Free text lives in decline_notes.';

-- The list is enforced here rather than only in the UI, so the column stays a
-- reportable dimension instead of drifting into free text.
alter table public.job_offers
  drop constraint if exists job_offers_decline_reason_valid,
  add constraint job_offers_decline_reason_valid check (
    decline_reason is null
    or decline_reason in (
      'Accepted another job offer',
      'Salary expectation',
      'Personal reason',
      'Location',
      'Schedule conflict',
      'Other'
    )
  );

-- A decline must say why; an acceptance must not carry a reason it never had.
alter table public.job_offers
  drop constraint if exists job_offers_decline_reason_required,
  add constraint job_offers_decline_reason_required check (
    (status = 'declined' and decline_reason is not null)
    or (status <> 'declined' and decline_reason is null)
  ) not valid;

-- `not valid` above, then validated separately: offers declined before this
-- migration have no reason and can't be given one retroactively. New and
-- updated rows are checked; the existing ones are left as the historical
-- record they are.

create or replace function public.respond_to_job_offer(
  p_reference_code text,
  p_email text,
  p_decision text,
  p_decline_reason text default null,
  p_decline_notes text default null
)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_application_id uuid;
  v_offer_id uuid;
  v_offer_status public.offer_status;
begin
  if p_decision not in ('accepted','declined') then
    raise exception 'INVALID_DECISION';
  end if;

  if p_decision = 'declined' and coalesce(trim(p_decline_reason), '') = '' then
    raise exception 'DECLINE_REASON_REQUIRED';
  end if;

  select a.id into v_application_id
  from public.applications a
  join public.applicants ap on ap.id = a.applicant_id
  where a.reference_code = upper(trim(p_reference_code))
    and lower(ap.email) = lower(trim(p_email));

  if v_application_id is null then
    raise exception 'NOT_FOUND';
  end if;

  select id, status into v_offer_id, v_offer_status
  from public.job_offers
  where application_id = v_application_id
  order by created_at desc limit 1;

  if v_offer_id is null then
    raise exception 'NO_OFFER';
  end if;

  if v_offer_status <> 'pending' then
    raise exception 'ALREADY_RESPONDED';
  end if;

  update public.job_offers
  set status = p_decision::public.offer_status,
      responded_at = now(),
      decline_reason = case when p_decision = 'declined' then trim(p_decline_reason) end,
      decline_notes = case when p_decision = 'declined' then nullif(trim(p_decline_notes), '') end
  where id = v_offer_id;

  if p_decision = 'declined' then
    -- Deliberately NOT setting applications.status = 'closed' here: the
    -- application stays in Deployment so HR can acknowledge and close it.
    insert into public.application_history (application_id, event, notes)
    values (
      v_application_id,
      'offer_declined',
      concat_ws(' — ', trim(p_decline_reason), nullif(trim(p_decline_notes), ''))
    );
  else
    insert into public.application_history (application_id, event, notes)
    values (v_application_id, 'offer_accepted', 'Accepted by the applicant via the tracking portal.');
  end if;

  return p_decision;
end;
$function$;

-- The old three-argument signature would otherwise still resolve and quietly
-- skip the reason.
drop function if exists public.respond_to_job_offer(text, text, text);

revoke execute on function public.respond_to_job_offer(text, text, text, text, text) from public;
grant execute on function public.respond_to_job_offer(text, text, text, text, text) to anon, authenticated;
