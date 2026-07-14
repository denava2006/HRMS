import { supabase } from '@/lib/supabase'
import * as recruitmentService from './recruitmentService'

export async function getInterviews() {
  return supabase
    .from('interviews')
    .select('*, applicant:applicants(full_name, email, status, job_posting:job_postings(title))')
    .order('created_at', { ascending: false })
}

export async function getInterviewsByApplicant(applicantId: string) {
  return supabase
    .from('interviews')
    .select('*')
    .eq('applicant_id', applicantId)
    .order('created_at')
}

export async function conductInitialInterview(applicantId: string, data: {
  conducted_at: string
  result: 'passed' | 'failed'
  notes?: string
  interviewer_id?: string
}) {
  const { data: { user } } = await supabase.auth.getUser()
  const interview = await supabase.from('interviews').insert({
    applicant_id: applicantId,
    interview_type: 'initial',
    conducted_at: data.conducted_at,
    result: data.result,
    notes: data.notes,
    interviewer_id: user?.id ?? data.interviewer_id,
  }).select().single()

  if (data.result === 'passed') {
    await supabase.from('applicants').update({ status: 'initial_interview', updated_at: new Date().toISOString() }).eq('id', applicantId)
  } else {
    await supabase.from('applicants').update({ status: 'initial_failed', updated_at: new Date().toISOString() }).eq('id', applicantId)
    await recruitmentService.notifyApplicantRejected(applicantId)
  }

  return interview
}

export async function scheduleFinalInterview(applicantId: string, scheduledAt: string) {
  await supabase.from('applicants').update({ status: 'final_interview_scheduled', updated_at: new Date().toISOString() }).eq('id', applicantId)
  const { data: { user } } = await supabase.auth.getUser()
  return supabase.from('interviews').insert({
    applicant_id: applicantId,
    interview_type: 'final',
    scheduled_at: scheduledAt,
    result: 'pending',
    interviewer_id: user?.id,
  }).select().single()
}

export async function conductFinalInterview(applicantId: string, interviewId: string, data: {
  conducted_at: string
  notes?: string
}) {
  await supabase.from('interviews').update({
    conducted_at: data.conducted_at,
    notes: data.notes,
    result: 'pending',
    updated_at: new Date().toISOString(),
  }).eq('id', interviewId)

  return supabase.from('applicants').update({ status: 'final_interview', updated_at: new Date().toISOString() }).eq('id', applicantId).select().single()
}

export async function makeHiringDecision(applicantId: string, decision: 'hire' | 'reject') {
  if (decision === 'reject') {
    await recruitmentService.notifyApplicantRejected(applicantId)
    return { data: null, error: null, hired: false }
  }
  const result = await supabase.from('applicants').update({ status: 'hired', updated_at: new Date().toISOString() }).eq('id', applicantId).select().single()
  return { ...result, hired: true }
}

export async function rejectApplicant(applicantId: string) {
  return recruitmentService.notifyApplicantRejected(applicantId)
}
