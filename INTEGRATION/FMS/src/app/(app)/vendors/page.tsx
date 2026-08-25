import { Mail, Phone } from "lucide-react";
import { requireAccess } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { canManageVendors } from "@/lib/rbac";
import { formatTin } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { TableCard, Th, Td, Tr, EmptyRow } from "@/components/ui/table";
import {
  AddVendorButton,
  EditVendorButton,
  VendorActiveToggle,
} from "@/components/vendor-dialogs";
import type { Vendor } from "@/lib/types";

type VendorRow = Vendor & {
  vendor_categories: { category_id: string; category: { name: string } | null }[];
};

export default async function VendorsPage() {
  const profile = await requireAccess("/vendors");
  const supabase = await createClient();

  const [{ data }, { data: categoryRows }] = await Promise.all([
    supabase
      .from("vendors")
      .select("*, vendor_categories(category_id, category:categories(name))")
      .order("is_active", { ascending: false })
      .order("name"),
    supabase
      .from("categories")
      .select("id, name")
      .eq("type", "expense")
      .eq("is_active", true)
      .order("name"),
  ]);

  const vendors = (data ?? []) as VendorRow[];
  const categories = (categoryRows ?? []) as { id: string; name: string }[];
  const canManage = canManageVendors(profile.role);

  return (
    <div>
      <PageHeader
        title="Vendors"
        description="Suppliers available on purchase requests. Each vendor is tied to the categories it actually supplies, so the request form only offers the ones that fit."
        action={canManage ? <AddVendorButton categories={categories} /> : undefined}
      />

      <TableCard>
        <thead>
          <tr>
            <Th>Vendor</Th>
            <Th>Supplies</Th>
            <Th>Contact</Th>
            <Th>TIN</Th>
            <Th align="center">Status</Th>
            {canManage && <Th align="right">Actions</Th>}
          </tr>
        </thead>
        <tbody>
          {vendors.map((v) => {
            const links = v.vendor_categories ?? [];
            return (
              <Tr key={v.id}>
                <Td>
                  <p className="font-medium text-slate-700 dark:text-slate-200">{v.name}</p>
                  {v.contact_person && (
                    <p className="text-xs text-slate-400">{v.contact_person}</p>
                  )}
                </Td>
                <Td>
                  {links.length === 0 ? (
                    <span className="text-xs text-slate-400">Any category</span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {links.map((l) => (
                        <span
                          key={l.category_id}
                          className="rounded-full bg-brand-500/10 px-2 py-0.5 text-[11px] font-medium text-brand-700 dark:text-brand-300"
                        >
                          {l.category?.name ?? "—"}
                        </span>
                      ))}
                    </div>
                  )}
                </Td>
                <Td className="text-slate-500">
                  {v.email && (
                    <span className="flex items-center gap-1.5 text-xs">
                      <Mail className="h-3 w-3" /> {v.email}
                    </span>
                  )}
                  {v.phone && (
                    <span className="flex items-center gap-1.5 text-xs">
                      <Phone className="h-3 w-3" /> {v.phone}
                    </span>
                  )}
                  {!v.email && !v.phone && "—"}
                </Td>
                <Td className="font-mono text-xs text-slate-500">{formatTin(v.tin)}</Td>
                <Td align="center">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      v.is_active
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"
                        : "bg-slate-500/10 text-slate-500"
                    }`}
                  >
                    {v.is_active ? "Active" : "Inactive"}
                  </span>
                </Td>
                {canManage && (
                  <Td align="right">
                    <div className="flex justify-end gap-2">
                      <EditVendorButton
                        categories={categories}
                        vendor={{
                          id: v.id,
                          name: v.name,
                          contact_person: v.contact_person ?? "",
                          email: v.email ?? "",
                          phone: v.phone ?? "",
                          address: v.address ?? "",
                          tin: v.tin ?? "",
                          categoryIds: links.map((l) => l.category_id),
                        }}
                      />
                      <VendorActiveToggle vendorId={v.id} active={v.is_active} />
                    </div>
                  </Td>
                )}
              </Tr>
            );
          })}
          {vendors.length === 0 && (
            <EmptyRow
              colSpan={canManage ? 6 : 5}
              label="No vendors yet. Add one so it can be selected on purchase requests."
            />
          )}
        </tbody>
      </TableCard>
    </div>
  );
}
