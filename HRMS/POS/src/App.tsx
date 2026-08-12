import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth";
import ProtectedRoute, { RoleRoute } from "@/components/ProtectedRoute";
import AppLayout from "./components/AppLayout";
import Dashboard from "./pages/Dashboard";
import POS from "./pages/POS";
import Inventory from "./pages/Inventory";
import Transactions from "./pages/Transactions";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import BranchDetails from "./pages/BranchDetails";
import Fees from "./pages/Fees";
import ExportData from "./pages/ExportData";
import PaymentQR from "./pages/PaymentQR";
import Reports from "./pages/Reports";
import Categories from "./pages/Categories";

import StaffManagement from "./pages/StaffManagement";
import AuditLogs from "./pages/AuditLogs";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster richColors position="top-center" />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route path="/" element={<RoleRoute allowed={["admin", "manager"]}><Dashboard /></RoleRoute>} />
              <Route path="/pos" element={<RoleRoute allowed={["admin", "manager", "cashier"]}><POS /></RoleRoute>} />
              <Route path="/inventory" element={<RoleRoute allowed={["admin", "manager"]}><Inventory /></RoleRoute>} />
              <Route path="/categories" element={<RoleRoute allowed={["admin", "manager"]}><Categories /></RoleRoute>} />
              <Route path="/transactions" element={<RoleRoute allowed={["admin", "manager"]}><Transactions /></RoleRoute>} />
              <Route path="/my-transactions" element={<RoleRoute allowed={["cashier"]}><Transactions /></RoleRoute>} />
              <Route path="/reports" element={<RoleRoute allowed={["admin", "manager"]}><Reports /></RoleRoute>} />
              <Route path="/staff" element={<RoleRoute allowed={["admin"]}><StaffManagement /></RoleRoute>} />
              <Route path="/payment-qr" element={<RoleRoute allowed={["admin"]}><PaymentQR /></RoleRoute>} />
              <Route path="/fees" element={<RoleRoute allowed={["admin"]}><Fees /></RoleRoute>} />
              <Route path="/audit-logs" element={<RoleRoute allowed={["admin", "manager"]}><AuditLogs /></RoleRoute>} />
              <Route path="/branch" element={<RoleRoute allowed={["admin"]}><BranchDetails /></RoleRoute>} />
              <Route path="/export" element={<RoleRoute allowed={["admin"]}><ExportData /></RoleRoute>} />
              {/* Settings was dissolved into these admin modules. Its old paths
                  stay as redirects so existing bookmarks keep working. */}
              <Route path="/settings" element={<Navigate to="/branch" replace />} />
              <Route path="/settings/shop" element={<Navigate to="/branch" replace />} />
              <Route path="/settings/export" element={<Navigate to="/export" replace />} />
              <Route path="/settings/fees" element={<Navigate to="/fees" replace />} />
              <Route path="/settings/payment-qr" element={<Navigate to="/payment-qr" replace />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
