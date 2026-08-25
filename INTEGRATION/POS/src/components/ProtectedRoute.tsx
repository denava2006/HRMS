import { Navigate, useLocation } from "react-router-dom";
import { useAuth, type AppRole } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { ShieldX } from "lucide-react";

export function roleHome(role: AppRole | null): string {
  return role === "cashier" ? "/pos" : "/";
}

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, membership, store, loading, authorizationError, signOut } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Verifying store access…</div>;
  }
  if (!session) return <Navigate to="/auth" replace state={{ from: location.pathname }} />;
  if (!membership || membership.status !== "active" || !store || authorizationError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-soft p-4">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-7 text-center shadow-elevated">
          <ShieldX className="mx-auto mb-4 h-12 w-12 text-destructive" />
          <h1 className="text-xl font-bold">Store access unavailable</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {authorizationError || "No active store membership is assigned to this account."}
          </p>
          <Button className="mt-5 w-full" variant="outline" onClick={signOut}>Sign out</Button>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}

export function RoleRoute({
  allowed,
  children,
}: {
  allowed: AppRole[];
  children: React.ReactNode;
}) {
  const { role, loading } = useAuth();
  if (loading) return null;
  if (!role || !allowed.includes(role)) return <Navigate to={roleHome(role)} replace />;
  return <>{children}</>;
}
