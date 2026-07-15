import { Navigate, Route, BrowserRouter as Router, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/contexts/AuthContext'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { PublicLayout } from '@/layouts/PublicLayout'
import { Toaster } from '@/components/ui/sonner'
import LoginPage from '@/pages/LoginPage'
import DashboardHome from '@/pages/DashboardHome'
import DepartmentsPage from '@/pages/admin/DepartmentsPage'
import PositionsPage from '@/pages/admin/PositionsPage'
import SalaryGradesPage from '@/pages/admin/SalaryGradesPage'
import SettingsPage from '@/pages/admin/SettingsPage'
import HrAccountsPage from '@/pages/admin/HrAccountsPage'
import JobPostingsPage from '@/pages/recruitment/JobPostingsPage'
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

            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<DashboardHome />} />

              <Route path="recruitment/job-postings" element={<JobPostingsPage />} />

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
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <Toaster />
        </AuthProvider>
      </Router>
    </QueryClientProvider>
  )
}
