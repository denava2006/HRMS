import {
  LayoutDashboard,
  CheckCircle2,
  Bell,
  ShoppingCart,
  ReceiptText,
  Wallet,
  TrendingUp,
  TrendingDown,
  Banknote,
  BarChart3,
  Users,
  Building2,
  Tags,
  ScrollText,
  Store,
  type LucideIcon,
} from "lucide-react";

/** Maps the icon names used in navigation config to their components. */
const ICONS: Record<string, LucideIcon> = {
  LayoutDashboard,
  CheckCircle2,
  Bell,
  ShoppingCart,
  ReceiptText,
  Wallet,
  TrendingUp,
  TrendingDown,
  Banknote,
  BarChart3,
  Users,
  Building2,
  Tags,
  ScrollText,
  Store,
};

export function Icon({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const Cmp = ICONS[name] ?? LayoutDashboard;
  return <Cmp className={className} />;
}
