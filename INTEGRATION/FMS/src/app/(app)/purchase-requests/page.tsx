import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { RequestsTable } from "@/components/requests-table";

export default function PurchaseRequestsPage() {
  return (
    <div>
      <PageHeader
        title="Purchase Requests"
        description="Requests to buy goods or services, tracked through the approval chain."
        action={
          <Link href="/purchase-requests/new" className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-600/25 transition hover:opacity-95">
            <Plus className="h-4 w-4" /> New Purchase Request
          </Link>
        }
      />
      <RequestsTable type="purchase" />
    </div>
  );
}
