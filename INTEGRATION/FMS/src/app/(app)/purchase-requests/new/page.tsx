import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { RequestForm } from "@/components/request-form";

export default async function NewPurchaseRequestPage() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const [{ data: departments }, { data: categories }, { data: vendors }] = await Promise.all([
    supabase.from("departments").select("id, name").order("name"),
    supabase.from("categories").select("id, name").eq("type", "expense").order("name"),
    supabase
      .from("vendors")
      .select("id, name, vendor_categories(category_id)")
      .eq("is_active", true)
      .order("name"),
  ]);

  // Flatten the join rows so the form can filter vendors by category.
  const vendorOptions = (vendors ?? []).map((v) => ({
    id: v.id as string,
    name: v.name as string,
    categoryIds: ((v.vendor_categories ?? []) as { category_id: string }[]).map(
      (c) => c.category_id,
    ),
  }));

  return (
    <div>
      <Link href="/purchase-requests" className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-brand-600 dark:text-slate-400">
        <ArrowLeft className="h-4 w-4" /> Back to Purchase Requests
      </Link>
      <PageHeader title="New Purchase Request" description="Request goods or services. This starts the approval workflow." />
      <RequestForm
        type="purchase"
        departments={departments ?? []}
        categories={categories ?? []}
        vendors={vendorOptions}
        defaultDepartmentId={profile.department_id}
      />
    </div>
  );
}
