-- When an applicant declined an offer, respond_to_job_offer closed the
-- application immediately. The row then vanished from Deployment (which lists
-- hired/offered/deployed) and reappeared in Recruitment as "Closed" with no
-- explanation — HR watched a candidate disappear mid-pipeline and had to go
-- looking for them in another module.
--
-- Declining now only marks the offer. The application stays in Deployment as
-- "Offer Declined", where HR can see what happened and close it deliberately.
-- The applicant's decision still stands on the offer either way; this only
-- controls when the application leaves the pipeline.
create or replace function public.respond_to_job_offer(
  p_reference_code text,
  p_email text,
  p_decision text
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
  set status = p_decision::public.offer_status, responded_at = now()
  where id = v_offer_id;

  if p_decision = 'declined' then
    -- Deliberately NOT setting applications.status = 'closed' here: the
    -- application stays in Deployment so HR can acknowledge and close it.
    insert into public.application_history (application_id, event, notes)
    values (v_application_id, 'offer_declined', 'Declined by the applicant via the tracking portal.');
  else
    insert into public.application_history (application_id, event, notes)
    values (v_application_id, 'offer_accepted', 'Accepted by the applicant via the tracking portal.');
  end if;

  return p_decision;
end;
$function$;

revoke execute on function public.respond_to_job_offer(text, text, text) from public;
grant execute on function public.respond_to_job_offer(text, text, text) to anon, authenticated;
