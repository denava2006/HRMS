/** Standard contract text generated for every employment contract, so HR
 * doesn't retype (or forget) the boilerplate. Only Additional Notes is left
 * open for anything case-specific. */

export interface ContractTemplateContext {
  companyName: string
  employeeName: string
  positionTitle: string
  departmentName: string
  employmentType: string
  salary: string
  startDate: string
  workingDays: string
  workingHours: string
}

export function generateCompanyPolicies(ctx: ContractTemplateContext): string {
  return [
    `1. CODE OF CONDUCT`,
    `The Employee shall observe the highest standards of professionalism, integrity, and courtesy in all dealings with colleagues, clients, and the public, and shall comply with all policies issued by ${ctx.companyName} from time to time.`,
    ``,
    `2. WORKING HOURS AND ATTENDANCE`,
    `The Employee's regular schedule is ${ctx.workingDays}, ${ctx.workingHours}. The Employee shall record attendance accurately through the Company's timekeeping system. Habitual tardiness, undertime, or absence without approved leave is subject to disciplinary action.`,
    ``,
    `3. LEAVE AND TIME OFF`,
    `The Employee is entitled to statutory leave benefits in accordance with Philippine labor law and Company policy. All leave must be filed and approved through the Company's official leave process prior to availment, except in cases of emergency, which must be reported at the earliest possible opportunity.`,
    ``,
    `4. COMPENSATION AND DEDUCTIONS`,
    `Salary shall be paid according to the Company's regular payroll cycle, net of statutory contributions and any deductions lawfully applicable, including those arising from tardiness, undertime, or unpaid absence as computed by the Company's payroll system.`,
    ``,
    `5. CONFIDENTIALITY AND DATA PRIVACY`,
    `The Employee shall hold in strict confidence all proprietary, personnel, and business information obtained in the course of employment, both during and after the term of this Contract, and shall process personal data only in accordance with the Data Privacy Act of 2012 and Company policy.`,
    ``,
    `6. COMPANY PROPERTY`,
    `All equipment, records, documents, and materials issued to or produced by the Employee in the course of employment remain the exclusive property of ${ctx.companyName} and shall be returned in good condition upon separation.`,
    ``,
    `7. HEALTH AND SAFETY`,
    `The Employee shall comply with all occupational safety and health standards and shall immediately report any workplace hazard, incident, or injury to management.`,
  ].join('\n')
}

export function generateTermsAndConditions(ctx: ContractTemplateContext): string {
  return [
    `1. APPOINTMENT`,
    `${ctx.companyName} (the "Company") hereby employs ${ctx.employeeName} (the "Employee") in the position of ${ctx.positionTitle} under the ${ctx.departmentName} Department, on a ${ctx.employmentType} basis, effective ${ctx.startDate}.`,
    ``,
    `2. DUTIES AND RESPONSIBILITIES`,
    `The Employee shall faithfully perform the duties attached to the position, together with such other reasonable duties as may be assigned by the Company consistent with the Employee's role, skills, and experience.`,
    ``,
    `3. COMPENSATION`,
    `The Company shall pay the Employee a basic salary of ${ctx.salary}, subject to lawful deductions and to review in accordance with Company policy. Payment shall be made through the Company's regular payroll cycle.`,
    ``,
    `4. PLACE OF WORK`,
    `The Employee's principal place of work shall be as assigned by the Company. The Company reserves the right to reassign the Employee to another branch, location, or department where the exigencies of the service so require.`,
    ``,
    `5. TERM`,
    `Employment shall commence on ${ctx.startDate} and shall continue until terminated by either party in accordance with this Contract and applicable law.`,
    ``,
    `6. TERMINATION`,
    `Either party may terminate this Contract by giving at least thirty (30) days' prior written notice. The Company may terminate employment without notice for any just or authorized cause under the Labor Code of the Philippines, subject to due process.`,
    ``,
    `7. NON-DISCLOSURE AND NON-SOLICITATION`,
    `The Employee shall not, during employment or for twelve (12) months following separation, disclose Company confidential information or solicit its employees or clients for a competing interest.`,
    ``,
    `8. AMENDMENTS`,
    `No amendment to this Contract shall be valid unless made in writing and signed by both parties.`,
    ``,
    `9. GOVERNING LAW`,
    `This Contract shall be governed by and construed in accordance with the laws of the Republic of the Philippines. Any dispute arising from it shall be resolved through the appropriate grievance machinery and, where necessary, the competent authorities having jurisdiction.`,
    ``,
    `10. ENTIRE AGREEMENT`,
    `This Contract, together with the Company Policies annexed hereto, constitutes the entire agreement between the parties and supersedes all prior negotiations, representations, or agreements relating to the Employee's engagement.`,
  ].join('\n')
}
