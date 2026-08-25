import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  LayoutDashboard, ShoppingCart, Package, Receipt, LogOut,
  BarChart3, Users, ClipboardList, Tags, QrCode, Percent,
  Store as StoreIcon, Download,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth, type AppRole } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";

type NavItem = {
  to: string;
  label: string;
  /** Shown in the mobile bar, where a long label wraps badly. */
  shortLabel?: string;
  icon: typeof LayoutDashboard;
  roles: AppRole[];
};

const navItems: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, roles: ["admin", "manager"] },
  { to: "/pos", label: "POS", icon: ShoppingCart, roles: ["admin", "manager", "cashier"] },
  { to: "/inventory", label: "Inventory", icon: Package, roles: ["admin", "manager"] },
  { to: "/categories", label: "Categories", icon: Tags, roles: ["admin", "manager"] },
  { to: "/transactions", label: "Transactions", icon: Receipt, roles: ["admin", "manager"] },
  { to: "/my-transactions", label: "My Transactions", icon: Receipt, roles: ["cashier"] },
  { to: "/reports", label: "Reports", icon: BarChart3, roles: ["admin", "manager"] },
  { to: "/staff", label: "Staff", icon: Users, roles: ["admin"] },
  { to: "/fees", label: "Additional Fees", shortLabel: "Fees", icon: Percent, roles: ["admin"] },
  { to: "/payment-qr", label: "Payment QR / QRPh", shortLabel: "Payment QR", icon: QrCode, roles: ["admin"] },
  { to: "/branch", label: "Branch Details", shortLabel: "Branch", icon: StoreIcon, roles: ["admin"] },
  { to: "/export", label: "Export Data", shortLabel: "Export", icon: Download, roles: ["admin"] },
  { to: "/audit-logs", label: "Audit Logs", icon: ClipboardList, roles: ["admin", "manager"] },
];

export default function AppLayout() {
  const location = useLocation();
  const { store, role, membership, signOut } = useAuth();
  const visibleItems = navItems.filter((item) => role && item.roles.includes(role));
  const roleLabel = role ? role[0].toUpperCase() + role.slice(1) : "";

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background">
      <aside className="hidden md:flex w-64 flex-col bg-card border-r border-border p-5 sticky top-0 h-screen">
        <div className="flex items-center gap-2.5 mb-8 px-1 py-1">
          <Logo height={44} className="font-bold" />
        </div>
        <div className="px-2 pb-4 mb-2 border-b border-border">
          <div className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">Store</div>
          <div className="font-bold truncate mt-0.5">{store?.name || "SariSwift"}</div>
          <div className="mt-1 text-xs text-primary font-semibold">{roleLabel}</div>
        </div>
        <nav className="flex flex-col gap-1 flex-1 mt-2 overflow-y-auto" aria-label="Main navigation">
          {visibleItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium text-sm transition-base",
                  isActive
                    ? "bg-gradient-primary text-primary-foreground shadow-pop"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )
              }
            >
              <Icon className="w-5 h-5" />
              {label}
            </NavLink>
          ))}
        </nav>
        <Button variant="ghost" size="sm" onClick={signOut} className="justify-start mt-2 text-muted-foreground hover:text-foreground">
          <LogOut className="w-4 h-4 mr-2" /> Sign out
        </Button>
        <div className="text-xs text-muted-foreground/60 mt-2 px-2 truncate">
          {membership?.display_name || roleLabel}
        </div>
      </aside>

      <header className="md:hidden bg-card border-b border-border px-4 py-4 flex items-center gap-3 sticky top-0 z-30 shadow-sm min-h-[64px]">
        <Logo height={36} />
        <div className="flex-1 min-w-0 text-right">
          <div className="truncate text-sm font-semibold text-muted-foreground">{store?.name}</div>
          <div className="text-[10px] uppercase tracking-wide text-primary font-bold">{roleLabel}</div>
        </div>
        {/* The sidebar is desktop-only, so this is the sole way to sign out on a phone. */}
        <Button
          variant="ghost"
          size="icon"
          onClick={signOut}
          aria-label="Sign out"
          title="Sign out"
          className="shrink-0 text-muted-foreground hover:text-foreground"
        >
          <LogOut className="w-5 h-5" />
        </Button>
      </header>

      <main className="flex-1 pb-24 md:pb-6 overflow-x-hidden">
        <div key={location.pathname} className="animate-fade-in">
          <Outlet />
        </div>
      </main>

      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-card border-t border-border shadow-elevated z-40 overflow-x-auto" aria-label="Mobile navigation">
        <div className="flex min-w-max">
          {visibleItems.map(({ to, label, shortLabel, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                cn(
                  "flex min-w-[78px] flex-1 flex-col items-center justify-center py-2.5 px-2 gap-0.5 text-[10px] font-medium transition-base",
                  isActive ? "text-primary" : "text-muted-foreground"
                )
              }
            >
              <Icon className="w-5 h-5" />
              {shortLabel ?? label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
