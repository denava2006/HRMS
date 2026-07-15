import { Outlet, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Sidebar } from '@/components/layout/Sidebar'
import { Navbar } from '@/components/layout/Navbar'

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/dashboard/job-postings': 'Job Postings',
  '/dashboard/recruitment': 'Recruitment',
  '/dashboard/interviews': 'Interview Management',
  '/dashboard/deployment': 'Deployment',
  '/dashboard/admin/accounts': 'HR Accounts',
  '/dashboard/admin/departments': 'Departments',
  '/dashboard/admin/positions': 'Positions',
  '/dashboard/admin/salary-grades': 'Salary Grades',
  '/dashboard/admin/settings': 'System Settings',
}

export function DashboardLayout() {
  const location = useLocation()
  const title = PAGE_TITLES[location.pathname] ?? 'Harmony Suite'

  return (
    <div className="flex h-dvh overflow-hidden bg-background print:h-auto print:overflow-visible">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden print:overflow-visible">
        <Navbar title={title} />
        <main className="flex-1 overflow-y-auto p-6 print:overflow-visible print:p-0">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="mx-auto max-w-6xl"
          >
            <Outlet />
          </motion.div>
        </main>
      </div>
    </div>
  )
}
