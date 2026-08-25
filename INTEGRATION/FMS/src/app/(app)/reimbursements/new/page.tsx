import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { RequestForm } from "@/components/request-form";

export default async function NewReimbursementPage() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const [{ data: departments }, { data: categories }] = await Promise.all([
    supabase.from("departments").select("id, name").order("name"),
    supabase.from("categories").select("id, name").eq("type", "expense").order("name"),
  ]);

  return (
    <div>
      <Link href="/reimbursements" className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-brand-600 dark:text-slate-400">
        <ArrowLeft className="h-4 w-4" /> Back to Reimbursements
      </Link>
      <PageHeader title="New Reimbursement Request" description="Claim back an out-of-pocket expense. Attach your receipt after submitting." />
      <RequestForm
        type="reimbursement"
        departments={departments ?? []}
        categories={categories ?? []}
        vendors={[]}
        defaultDepartmentId={profile.department_id}
      />
    </div>
  );
}
