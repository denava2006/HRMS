import { supabase } from '@/lib/supabase'
import jsPDF from 'jspdf'
import * as recruitmentService from './recruitmentService'

export async function getHiredApplicants() {
  return supabase
    .from('applicants')
    .select('*, job_posting:job_postings(title, position:positions(title))')
    .in('status', ['hired', 'offer_sent', 'offer_declined', 'offer_accepted', 'contract_prepared', 'contract_signed', 'deployed'])
    .order('updated_at', { ascending: false })
}

export async function prepareJobOffer(applicantId: string, data: { salary: number; start_date: string }) {
  const offer = await supabase.from('job_offers').insert({
    applicant_id: applicantId,
    salary: data.salary,
    start_date: data.start_date,
    status: 'pending',
    sent_at: new Date().toISOString(),
  }).select().single()

  if (!offer.error) {
    await supabase.from('applicants').update({ status: 'offer_sent', updated_at: new Date().toISOString() }).eq('id', applicantId)
  }
  return offer
}

export async function respondToOffer(offerId: string, applicantId: string, accepted: boolean) {
  const status = accepted ? 'accepted' : 'declined'
  const applicantStatus = accepted ? 'offer_accepted' : 'offer_declined'

  const result = await supabase.from('job_offers').update({
    status,
    responded_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', offerId).select().single()

  await supabase.from('applicants').update({ status: applicantStatus, updated_at: new Date().toISOString() }).eq('id', applicantId)

  if (!accepted) {
    await recruitmentService.closeApplication(applicantId)
  }

  return result
}

export async function prepareEmploymentContract(applicantId: string, jobOfferId: string) {
  const { data: applicant } = await supabase.from('applicants').select('full_name, email').eq('id', applicantId).single()
  const { data: offer } = await supabase.from('job_offers').select('salary, start_date').eq('id', jobOfferId).single()

  const doc = new jsPDF()
  doc.setFontSize(18)
  doc.text('Employment Contract', 20, 20)
  doc.setFontSize(12)
  doc.text(`Employee: ${applicant?.full_name ?? 'N/A'}`, 20, 40)
  doc.text(`Email: ${applicant?.email ?? 'N/A'}`, 20, 50)
  doc.text(`Salary: PHP ${offer?.salary?.toLocaleString() ?? 'N/A'}`, 20, 60)
  doc.text(`Start Date: ${offer?.start_date ?? 'N/A'}`, 20, 70)
  doc.text('This contract is prepared by Harmony Suite HRMS.', 20, 90)

  const blob = doc.output('blob')
  const path = `${applicantId}/contract.pdf`
  await supabase.storage.from('contracts').upload(path, blob, { upsert: true, contentType: 'application/pdf' })
  const { data: urlData } = supabase.storage.from('contracts').getPublicUrl(path)

  const contract = await supabase.from('employment_contracts').insert({
    applicant_id: applicantId,
    job_offer_id: jobOfferId,
    contract_url: urlData.publicUrl,
    status: 'prepared',
    prepared_at: new Date().toISOString(),
  }).select().single()

  await supabase.from('applicants').update({ status: 'contract_prepared', updated_at: new Date().toISOString() }).eq('id', applicantId)
  return contract
}

export async function printContract(contractId: string) {
  return supabase.from('employment_contracts').update({ status: 'printed', updated_at: new Date().toISOString() }).eq('id', contractId).select().single()
}

export async function signContract(contractId: string, applicantId: string) {
  const result = await supabase.from('employment_contracts').update({
    status: 'signed',
    signed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', contractId).select().single()

  await supabase.from('applicants').update({ status: 'contract_signed', updated_at: new Date().toISOString() }).eq('id', applicantId)
  return result
}

export async function deployApplicant(applicantId: string) {
  return supabase.from('applicants').update({ status: 'deployed', updated_at: new Date().toISOString() }).eq('id', applicantId).select().single()
}

export async function getJobOffers() {
  return supabase.from('job_offers').select('*, applicant:applicants(full_name, email, status)').order('created_at', { ascending: false })
}

export async function getContracts() {
  return supabase.from('employment_contracts').select('*, applicant:applicants(full_name, email)').order('created_at', { ascending: false })
}
