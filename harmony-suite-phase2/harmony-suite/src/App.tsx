import { Navigate, Route, BrowserRouter as Router, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/contexts/AuthContext'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { PublicLayout } from '@/layouts/PublicLayout'
import { Toaster } from '@/components/ui/sonner'
import LoginPage from '@/pages/LoginPage'
import SetupPasswordPage from '@/pages/auth/SetupPasswordPage'
import DashboardHome from '@/pages/DashboardHome'
import DepartmentsPage from '@/pages/admin/DepartmentsPage'
import PositionsPage from '@/pages/admin/PositionsPage'
import SalaryGradesPage from '@/pages/admin/SalaryGradesPage'
import SettingsPage from '@/pages/admin/SettingsPage'
import HrAccountsPage from '@/pages/admin/HrAccountsPage'
import JobPostingsPage from '@/pages/recruitment/JobPostingsPage'
import RecruitmentPage from '@/pages/recruitment/RecruitmentPage'
import InterviewsPage from '@/pages/interviews/InterviewsPage'
import DeploymentPage from '@/pages/deployment/DeploymentPage'
import ContractPrintPage from '@/pages/deployment/ContractPrintPage'
import EmployeesPage from '@/pages/employees/EmployeesPage'
import CreateEmployeePage from '@/pages/employees/CreateEmployeePage'
import EmployeeDetailsPage from '@/pages/employees/EmployeeDetailsPage'
import AttendancePage from '@/pages/attendance/AttendancePage'
import WorkSchedulesPage from '@/pages/admin/WorkSchedulesPage'
import HolidaysPage from '@/pages/admin/HolidaysPage'
import LeavePage from '@/pages/leave/LeavePage'
import PayrollPage from '@/pages/payroll/PayrollPage'
import PayslipPrintPage from '@/pages/payroll/PayslipPrintPage'
import HomePage from '@/pages/public/HomePage'
import CareersPage from '@/pages/public/CareersPage'
import CareerDetailsPage from '@/pages/public/CareerDetailsPage'
import ApplyPage from '@/pages/public/ApplyPage'
import ApplicationSuccessPage from '@/pages/public/ApplicationSuccessPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <AuthProvider>
          <Routes>
            <Route element={<PublicLayout />}>
              <Route index element={<HomePage />} />
              <Route path="careers" element={<CareersPage />} />
              <Route path="careers/application-success" element={<ApplicationSuccessPage />} />
              <Route path="careers/:jobId" element={<CareerDetailsPage />} />
              <Route path="careers/:jobId/apply" element={<ApplyPage />} />
            </Route>

            <Route path="/login" element={<LoginPage />} />
            <Route path="/auth/setup-password" element={<SetupPasswordPage />} />

            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<DashboardHome />} />

              {/* Internal HR back-office — employee-role logins are blocked from
                  all of it and land on DashboardHome's placeholder instead. */}
              <Route
                path="job-postings"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'hr_staff']}>
                    <JobPostingsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="recruitment"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'hr_staff']}>
                    <RecruitmentPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="interviews"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'hr_staff']}>
                    <InterviewsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="deployment"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'hr_staff']}>
                    <DeploymentPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="deployment/:applicationId/contract"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'hr_staff']}>
                    <ContractPrintPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="employees"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'hr_staff']}>
                    <EmployeesPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="employees/new"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'hr_staff']}>
                    <CreateEmployeePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="employees/:employeeId"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'hr_staff']}>
                    <EmployeeDetailsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="attendance"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'hr_staff']}>
                    <AttendancePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="leave"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'hr_staff']}>
                    <LeavePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="payroll"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'hr_staff']}>
                    <PayrollPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="payroll/:recordId/payslip"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'hr_staff']}>
                    <PayslipPrintPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="admin/accounts"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <HrAccountsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="admin/departments"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <DepartmentsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="admin/positions"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <PositionsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="admin/salary-grades"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <SalaryGradesPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="admin/settings"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <SettingsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="admin/work-schedules"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <WorkSchedulesPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="admin/holidays"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <HolidaysPage />
                  </ProtectedRoute>
                }
              />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <Toaster />
        </AuthProvider>
      </Router>
    </QueryClientProvider>
  )
}
