import { notFound, redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isEditable } from "@/lib/workflow";
import { PageHeader } from "@/components/page-header";
import { EditRequestForm } from "@/components/edit-request-form";
import type { FinanceRequest } from "@/lib/types";

export default async function EditRequestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data } = await supabase
    .from("requests")
    .select("*, requester:profiles!requests_requester_id_fkey(full_name), department:departments(name)")
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();

  const request = data as FinanceRequest & {
    requester?: { full_name: string };
    department?: { name: string };
  };

  // Only the requester may revise, and only while the request is theirs to fix.
  if (request.requester_id !== profile.id || !isEditable(request.status)) {
    redirect(`/requests/${id}`);
  }

  const [{ data: categories }, { data: vendors }, { data: attachments }] = await Promise.all([
    supabase.from("categories").select("id, name").eq("is_active", true).order("name"),
    supabase
      .from("vendors")
      .select("id, name, vendor_categories(category_id)")
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("request_attachments")
      .select("id, file_name")
      .eq("request_id", id)
      .order("created_at", { ascending: true }),
  ]);

  const vendorOptions = (vendors ?? []).map((v) => ({
    id: v.id as string,
    name: v.name as string,
    categoryIds: ((v.vendor_categories ?? []) as { category_id: string }[]).map(
      (c) => c.category_id,
    ),
  }));

  // Keep the vendor already on the request selectable even if it has since been
  // deactivated — otherwise saving an unrelated edit would silently drop it.
  if (request.vendor_id && !vendorOptions.some((v) => v.id === request.vendor_id)) {
    const { data: current } = await supabase
      .from("vendors")
      .select("id, name")
      .eq("id", request.vendor_id)
      .maybeSingle();
    if (current) {
      vendorOptions.unshift({
        id: current.id,
        name: `${current.name} (inactive)`,
        categoryIds: [],
      });
    }
  }

  return (
    <div>
      <PageHeader
        title="Edit Request"
        description="Revise the details Finance Staff asked about, then resubmit from the request page."
      />
      <EditRequestForm
        requestId={request.id}
        type={request.type}
        requestNo={request.request_no ?? "—"}
        departmentName={request.department?.name ?? "—"}
        requesterName={request.requester?.full_name ?? "—"}
        defaults={{
          title: request.title,
          description: request.description ?? "",
          justification: request.justification ?? "",
          amount: String(request.amount ?? ""),
          category_id: request.category_id ?? "",
          vendor_id: request.vendor_id ?? "",
          needed_by: request.needed_by ?? "",
          expense_date: request.expense_date ?? "",
        }}
        categories={categories ?? []}
        vendors={vendorOptions}
        attachments={attachments ?? []}
      />
    </div>
  );
}
