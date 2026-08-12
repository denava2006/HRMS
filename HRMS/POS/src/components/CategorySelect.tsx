import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { createCategory, useCategories, useRefreshCategories } from "@/lib/categories";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Props = {
  storeId: string;
  value?: string | null;
  currentName?: string | null;
  onChange: (id: string, name: string) => void;
  canCreate?: boolean;
  disabled?: boolean;
};

export function CategorySelect({ storeId, value, currentName, onChange, canCreate, disabled }: Props) {
  const { data = [], isLoading, error } = useCategories(storeId, false);
  const refresh = useRefreshCategories(storeId);
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const active = useMemo(() => data.filter((category) => category.is_active), [data]);
  const selected = data.find((category) => category.id === value);

  const submit = async () => {
    const clean = name.trim();
    if (!clean) return toast.error("Category name is required");
    setSaving(true);
    try {
      const category = await createCategory(storeId, { name: clean });
      await refresh();
      onChange(category.id, category.name);
      setName("");
      setCreateOpen(false);
      toast.success("Category created");
    } catch (categoryError) {
      toast.error(categoryError instanceof Error ? categoryError.message : "Category could not be created");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" role="combobox" aria-expanded={open} disabled={disabled || isLoading} className="w-full justify-between font-normal">
            <span className="flex min-w-0 items-center gap-2 truncate">
              {(selected?.color) && <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: selected.color }} />}
              {isLoading ? "Loading categories…" : selected?.name || currentName || "Select category"}
            </span>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronsUpDown className="h-4 w-4 opacity-50" />}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search categories…" />
            <CommandList>
              <CommandEmpty>{error ? "Categories could not be loaded." : "No active category found."}</CommandEmpty>
              <CommandGroup>
                {active.map((category) => (
                  <CommandItem
                    key={category.id}
                    value={category.name}
                    onSelect={() => {
                      onChange(category.id, category.name);
                      setOpen(false);
                    }}
                  >
                    <Check className={cn("mr-2 h-4 w-4", value === category.id ? "opacity-100" : "opacity-0")} />
                    {category.color && <span className="mr-2 h-3 w-3 rounded-full" style={{ backgroundColor: category.color }} />}
                    {category.icon && <span className="mr-2">{category.icon}</span>}
                    {category.name}
                  </CommandItem>
                ))}
              </CommandGroup>
              {canCreate && (
                <CommandGroup>
                  <CommandItem onSelect={() => { setOpen(false); setCreateOpen(true); }}>
                    <Plus className="mr-2 h-4 w-4" /> Add New Category
                  </CommandItem>
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <Dialog open={createOpen} onOpenChange={(next) => !saving && setCreateOpen(next)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Add Category</DialogTitle></DialogHeader>
          <Input
            autoFocus
            maxLength={80}
            placeholder="Category name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && void submit()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={() => void submit()} disabled={saving || !name.trim()}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
