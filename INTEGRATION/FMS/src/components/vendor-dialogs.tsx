"use client";

import { useActionState, useEffect, useState } from "react";
import { Loader2, Pencil, Store } from "lucide-react";
import { createVendor, setVendorActive, updateVendor } from "@/lib/actions";
import {
  sanitizeCompanyName,
  sanitizeDigits,
  sanitizePersonName,
  sanitizePhone,
} from "@/lib/utils";
import { Modal } from "@/components/ui/modal";
import { FormError, SubmitButton, fieldClass, labelClass } from "@/components/ui/form";
import type { FormState } from "@/lib/types";

interface Option {
  id: string;
  name: string;
}

export interface VendorValues {
  id?: string;
  name: string;
  contact_person: string;
  email: string;
  phone: string;
  address: string;
  tin: string;
  categoryIds: string[];
}

const EMPTY: VendorValues = {
  name: "",
  contact_person: "",
  email: "",
  phone: "",
  address: "",
  tin: "",
  categoryIds: [],
};

export function AddVendorButton({ categories }: { categories: Option[] }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-600/25 transition hover:opacity-95"
      >
        <Store className="h-4 w-4" /> Add Vendor
      </button>

      {open && (
        <Modal
          wide
          title="Add Vendor"
          description="Suppliers here appear in the Vendor dropdown on purchase requests."
          onClose={() => setOpen(false)}
        >
          <VendorForm
            categories={categories}
            initial={EMPTY}
            submitLabel="Add Vendor"
            onDone={() => setOpen(false)}
          />
        </Modal>
      )}
    </>
  );
}

export function EditVendorButton({
  vendor,
  categories,
}: {
  vendor: VendorValues;
  categories: Option[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:border-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-300"
      >
        <Pencil className="h-3 w-3" /> Edit
      </button>

      {open && (
        <Modal
          wide
          title="Edit Vendor"
          description="Update the details and the categories this vendor supplies."
          onClose={() => setOpen(false)}
        >
          <VendorForm
            categories={categories}
            initial={vendor}
            submitLabel="Save Changes"
            onDone={() => setOpen(false)}
          />
        </Modal>
      )}
    </>
  );
}

function VendorForm({
  categories,
  initial,
  submitLabel,
  onDone,
}: {
  categories: Option[];
  initial: VendorValues;
  submitLabel: string;
  onDone: () => void;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(
    initial.id ? updateVendor : createVendor,
    {},
  );

  // Controlled so unwanted characters never make it into the field at all.
  // Existing values are normalised on open, since older rows were stored with
  // spaces and dashes.
  const [name, setName] = useState(initial.name);
  const [contact, setContact] = useState(sanitizePersonName(initial.contact_person));
  const [tin, setTin] = useState(sanitizeDigits(initial.tin));
  const [phone, setPhone] = useState(sanitizePhone(initial.phone));

  useEffect(() => {
    if (state.ok) onDone();
  }, [state.ok, onDone]);

  return (
    <form action={formAction} className="space-y-5">
      <FormError message={state.error} />
      {initial.id && <input type="hidden" name="vendor_id" value={initial.id} />}

      <div>
        <label className={labelClass} htmlFor="name">Vendor Name *</label>
        <input
          id="name"
          name="name"
          required
          value={name}
          onChange={(e) => setName(sanitizeCompanyName(e.target.value))}
          placeholder="e.g. Burger's Burger"
          className={fieldClass}
        />
        <p className="mt-1.5 text-xs text-slate-400">Letters and numbers — no symbols.</p>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="contact_person">Contact Person</label>
          <input
            id="contact_person"
            name="contact_person"
            value={contact}
            onChange={(e) => setContact(sanitizePersonName(e.target.value))}
            placeholder="e.g. Ana Reyes"
            className={fieldClass}
          />
          <p className="mt-1.5 text-xs text-slate-400">Letters only.</p>
        </div>
        <div>
          <label className={labelClass} htmlFor="tin">TIN</label>
          <input
            id="tin"
            name="tin"
            inputMode="numeric"
            value={tin}
            onChange={(e) => setTin(sanitizeDigits(e.target.value))}
            placeholder="e.g. 123456789000"
            className={fieldClass}
          />
          <p className="mt-1.5 text-xs text-slate-400">Digits only, 9–12.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            defaultValue={initial.email}
            placeholder="sales@vendor.ph"
            className={fieldClass}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="phone">Contact Number</label>
          <input
            id="phone"
            name="phone"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(sanitizePhone(e.target.value))}
            placeholder="e.g. +639170000000"
            className={fieldClass}
          />
          <p className="mt-1.5 text-xs text-slate-400">Digits only.</p>
        </div>
      </div>

      <div>
        <label className={labelClass} htmlFor="address">Address</label>
        <textarea
          id="address"
          name="address"
          rows={2}
          defaultValue={initial.address}
          placeholder="Street, city"
          className={fieldClass}
        />
      </div>

      {/* What this vendor supplies — drives the Vendor dropdown filter. */}
      <fieldset>
        <legend className={labelClass}>Supplies these categories</legend>
        <div className="grid max-h-48 grid-cols-1 gap-1 overflow-y-auto rounded-xl border border-slate-200 p-3 sm:grid-cols-2 dark:border-slate-700">
          {categories.map((c) => (
            <label
              key={c.id}
              className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <input
                type="checkbox"
                name="category_ids"
                value={c.id}
                defaultChecked={initial.categoryIds.includes(c.id)}
                className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500/40"
              />
              {c.name}
            </label>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-slate-400">
          Leave all unticked to keep this vendor available for every category.
        </p>
      </fieldset>

      <div className="flex items-center justify-between gap-4 border-t border-slate-200/70 pt-4 dark:border-slate-700/70">
        <p className="text-xs text-slate-400">Only the name is required.</p>
        <SubmitButton label={submitLabel} icon={Store} />
      </div>
    </form>
  );
}

/** Retire or restore a vendor without deleting its history. */
export function VendorActiveToggle({
  vendorId,
  active,
}: {
  vendorId: string;
  active: boolean;
}) {
  const [, formAction, pending] = useActionState<FormState, FormData>(setVendorActive, {});

  return (
    <form action={formAction}>
      <input type="hidden" name="vendor_id" value={vendorId} />
      <input type="hidden" name="active" value={String(!active)} />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-60 dark:border-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-300"
      >
        {pending && <Loader2 className="h-3 w-3 animate-spin" />}
        {active ? "Deactivate" : "Reactivate"}
      </button>
    </form>
  );
}
