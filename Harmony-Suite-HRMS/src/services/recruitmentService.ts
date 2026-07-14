import { supabase } from '@/lib/supabase'
import type { ApplicantStatus } from '@/types'

export async function getJobPostings() {
  return supabase
    .from('job_postings')
    .select('*, department:departments(*), position:positions(*)')
    .order('created_at', { ascending: false })
}

export async function getActiveJobPostings() {
  return supabase
    .from('job_postings')
    .select('*, department:departments(*), position:positions(*)')
    .eq('is_active', true)
    .order('published_at', { ascending: false })
}

export async function getJobPosting(id: string) {
  return supabase
    .from('job_postings')
    .select('*, department:departments(*), position:positions(*)')
    .eq('id', id)
    .single()
}

export async function publishJobVacancy(posting: {
  title: string
  department_id: string
  position_id: string
  description: string
  requirements?: string
  created_by?: string
}) {
  const { data: { user } } = await supabase.auth.getUser()
  return supabase
    .from('job_postings')
    .insert({
      ...posting,
      is_active: true,
      published_at: new Date().toISOString(),
      created_by: user?.id ?? posting.created_by,
    })
    .select()
    .single()
}

export async function updateJobPosting(id: string, updates: Record<string, unknown>) {
  return supabase
    .from('job_postings')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
}

export async function getApplications() {
  return supabase
    .from('applicants')
    .select('*, job_posting:job_postings(title, department:departments(name))')
    .order('created_at', { ascending: false })
}

export async function getApplicationsByStatus(status: ApplicantStatus | ApplicantStatus[]) {
  const statuses = Array.isArray(status) ? status : [status]
  return supabase
    .from('applicants')
    .select('*, job_posting:job_postings(title)')
    .in('status', statuses)
    .order('created_at', { ascending: false })
}

export async function submitApplication(data: {
  job_posting_id: string
  full_name: string
  email: string
  phone?: string
  address?: string
  resume_url?: string
}) {
  return supabase
    .from('applicants')
    .insert({ ...data, status: 'submitted' })
    .select()
    .single()
}

export async function uploadResume(file: File, applicantId: string) {
  const ext = file.name.split('.').pop()
  const path = `${applicantId}/resume.${ext}`
  const { error } = await supabase.storage.from('resumes').upload(path, file, { upsert: true })
  if (error) return { error, url: null }
  const { data } = supabase.storage.from('resumes').getPublicUrl(path)
  return { error: null, url: data.publicUrl }
}

export async function receiveApplications() {
  return getApplicationsByStatus(['submitted'])
}

export async function reviewApplication(applicantId: string) {
  return supabase
    .from('applicants')
    .update({ status: 'under_review', updated_at: new Date().toISOString() })
    .eq('id', applicantId)
    .select()
    .single()
}

export async function markApplicantQualified(applicantId: string) {
  return supabase
    .from('applicants')
    .update({ status: 'qualified', updated_at: new Date().toISOString() })
    .eq('id', applicantId)
    .select()
    .single()
}

export async function notifyApplicantRejected(applicantId: string) {
  return supabase
    .from('applicants')
    .update({ status: 'rejected', updated_at: new Date().toISOString() })
    .eq('id', applicantId)
    .select()
    .single()
}

export async function closeApplication(applicantId: string) {
  return supabase
    .from('applicants')
    .update({ status: 'closed', updated_at: new Date().toISOString() })
    .eq('id', applicantId)
    .select()
    .single()
}
