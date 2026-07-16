import { useNavigate } from 'react-router-dom'
import { Users, Building2, Briefcase } from 'lucide-react'
import { DashboardSectionCard, MiniStat } from '@/components/dashboard/DashboardPrimitives'
import { useOrganizationOverview, useRecruitmentOverview } from '@/hooks/useDashboard'
import { useEmployeeStats, usePendingEmployees } from '@/hooks/useEmployees'

export function OrganizationOverviewSection() {
  const { data, isLoading } = useOrganizationOverview()
  return (
    <DashboardSectionCard title="Organization Overview" icon={Building2}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MiniStat label="Total Employees" value={data?.total ?? 0} isLoading={isLoading} />
        <MiniStat label="Active Employees" value={data?.active ?? 0} isLoading={isLoading} />
        <MiniStat label="Departments" value={data?.departments ?? 0} isLoading={isLoading} />
        <MiniStat label="Positions" value={data?.positions ?? 0} isLoading={isLoading} />
      </div>
    </DashboardSectionCard>
  )
}

export function RecruitmentOverviewSection() {
  const navigate = useNavigate()
  const { data, isLoading } = useRecruitmentOverview()
  return (
    <DashboardSectionCard title="Recruitment Overview" icon={Briefcase} onClick={() => navigate('/dashboard/recruitment')}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <MiniStat label="New Applications" value={data?.newApplications ?? 0} isLoading={isLoading} />
        <MiniStat label="Under Review" value={data?.underReview ?? 0} isLoading={isLoading} />
        <MiniStat label="Qualified" value={data?.qualified ?? 0} isLoading={isLoading} />
        <MiniStat label="Interviews Scheduled" value={data?.interviewsScheduled ?? 0} isLoading={isLoading} />
        <MiniStat label="Pending Deployment" value={data?.pendingDeployment ?? 0} isLoading={isLoading} />
      </div>
    </DashboardSectionCard>
  )
}

export function EmployeeOverviewSection() {
  const navigate = useNavigate()
  const { data, isLoading } = useEmployeeStats()
  const { data: pending, isLoading: pendingLoading } = usePendingEmployees()
  return (
    <DashboardSectionCard title="Employee Overview" icon={Users} onClick={() => navigate('/dashboard/employees')}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <MiniStat label="Total Employees" value={data?.total ?? 0} isLoading={isLoading} />
        <MiniStat label="Pending Creation" value={pending?.length ?? 0} isLoading={pendingLoading} />
        <MiniStat label="Active" value={data?.active ?? 0} isLoading={isLoading} />
        <MiniStat label="Probationary" value={data?.probationary ?? 0} isLoading={isLoading} />
        <MiniStat label="Regular" value={data?.regular ?? 0} isLoading={isLoading} />
        <MiniStat label="Inactive" value={data?.inactive ?? 0} isLoading={isLoading} />
      </div>
    </DashboardSectionCard>
  )
}
