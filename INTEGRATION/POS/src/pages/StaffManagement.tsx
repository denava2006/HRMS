import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import {
  changeStaffRole, createStaff, listStaff, resetStaffPassword, setStaffStatus, type StaffMember,
} from "@/lib/adminApi";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, Search, ShieldCheck, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { PasswordInput } from "@/components/PasswordInput";

type StaffForm = {
  email: string;
  displayName: string;
  role: "manager" | "cashier";
  password: string;
};

const emptyForm: StaffForm = { email: "", displayName: "", role: "cashier", password: "" };

export default function StaffManagement() {
  const { store } = useAuth();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<StaffForm>(emptyForm);
  const [busy, setBusy] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<StaffMember | null>(null);
  const [pendingRole, setPendingRole] = useState<{ member: StaffMember; role: "manager" | "cashier" } | null>(null);
  const [passwordTarget, setPasswordTarget] = useState<StaffMember | null>(null);
  const [newPassword, setNewPassword] = useState("");

  // A failing staff service must not be hammered. Only one request is ever in
  // flight, and the page never retries on its own — the operator decides.
  const loadingRef = useRef(false);
  const load = useCallback(async () => {
    if (!store || loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      setStaff(await listStaff(store.id));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Staff could not be loaded.");
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [store]);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => staff.filter((member) => {
    const term = search.trim().toLowerCase();
    if (term && !`${member.email ?? ""} ${member.display_name ?? ""}`.toLowerCase().includes(term)) return false;
    if (roleFilter !== "all" && member.role !== roleFilter) return false;
    if (statusFilter !== "all" && member.status !== statusFilter) return false;
    return true;
  }), [roleFilter, search, staff, statusFilter]);

  const submitCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!store || busy) return;
    setBusy(true);
    try {
      await createStaff({
        storeId: store.id,
        email: form.email,
        password: form.password,
        displayName: form.displayName,
        role: form.role,
      });
      toast.success(`${form.role === "manager" ? "Manager" : "Cashier"} account created`);
      setForm(emptyForm);
      setCreateOpen(false);
      await load();
    } catch (createError) {
      toast.error(createError instanceof Error ? createError.message : "Staff account could not be created.");
    } finally {
      setBusy(false);
    }
  };

  const updateRole = async (member: StaffMember, role: "manager" | "cashier") => {
    if (!store || busy || member.role === role) return;
    setBusy(true);
    try {
      await changeStaffRole(store.id, member.id, role);
      toast.success("Staff role updated");
      setPendingRole(null);
      await load();
    } catch (roleError) {
      toast.error(roleError instanceof Error ? roleError.message : "Role could not be updated.");
    } finally {
      setBusy(false);
    }
  };

  const confirmStatus = async () => {
    if (!store || !pendingStatus || busy) return;
    const next = pendingStatus.status === "active" ? "inactive" : "active";
    setBusy(true);
    try {
      await setStaffStatus(store.id, pendingStatus.id, next);
      toast.success(next === "active" ? "Staff account activated" : "Staff account deactivated");
      setPendingStatus(null);
      await load();
    } catch (statusError) {
      toast.error(statusError instanceof Error ? statusError.message : "Status could not be updated.");
    } finally {
      setBusy(false);
    }
  };

  const submitPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!store || !passwordTarget || busy) return;
    setBusy(true);
    try {
      const result = await resetStaffPassword(store.id, passwordTarget.id, newPassword);
      if (result?.warning) {
        toast.warning("Temporary password updated", { description: result.warning });
      } else {
        toast.success("Temporary password updated securely");
      }
      setPasswordTarget(null);
      // Clear immediately so the value does not linger in component state.
      setNewPassword("");
    } catch (passwordError) {
      toast.error(passwordError instanceof Error ? passwordError.message : "Password could not be reset.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Staff Management</h1>
          <p className="text-sm text-muted-foreground">Create and manage Managers and Cashiers for {store?.name}.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="bg-gradient-primary shadow-pop">
          <UserPlus className="w-4 h-4 mr-2" /> Create Staff
        </Button>
      </header>

      <Card className="p-3 md:p-4 grid gap-3 md:grid-cols-[1fr_180px_180px]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search email or name…" value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            <SelectItem value="manager">Manager</SelectItem>
            <SelectItem value="cashier">Cashier</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </Card>

      {loading ? (
        <Card className="p-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></Card>
      ) : error ? (
        <Card className="p-8 text-center">
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" size="sm" className="mt-4" disabled={loading} onClick={() => void load()}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Try again"}
          </Button>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <Users className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
          <p className="font-semibold">No staff found</p>
          <p className="text-sm text-muted-foreground mt-1">Create a Manager or Cashier, or change the filters.</p>
        </Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {filtered.map((member) => (
            <Card key={member.id} className="p-4 shadow-card">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{member.display_name || member.email || "Staff member"}</div>
                  <div className="text-xs text-muted-foreground truncate">{member.email}</div>
                </div>
                <Badge variant={member.status === "active" ? "default" : "secondary"}>{member.status}</Badge>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                <div>Created<br /><span className="text-foreground">{new Date(member.created_at).toLocaleDateString()}</span></div>
                <div>Last sign-in<br /><span className="text-foreground">{member.last_sign_in_at ? new Date(member.last_sign_in_at).toLocaleString() : "Never"}</span></div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Select value={member.role} disabled={busy} onValueChange={(role) => setPendingRole({ member, role: role as "manager" | "cashier" })}>
                  <SelectTrigger className="w-32 h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="cashier">Cashier</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" disabled={busy} onClick={() => setPendingStatus(member)}>
                  {member.status === "active" ? "Deactivate" : "Activate"}
                </Button>
                <Button variant="ghost" size="sm" disabled={busy} onClick={() => setPasswordTarget(member)}>Reset password</Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          if (busy) return;
          setCreateOpen(open);
          // Never leave a typed temporary password in component state.
          if (!open) setForm(emptyForm);
        }}
      >
        <DialogContent className="max-w-md">
          <form onSubmit={submitCreate}>
            <DialogHeader>
              <DialogTitle>Create Staff Account</DialogTitle>
              <DialogDescription>The account will be assigned only to {store?.name}.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-4">
              <Field label="Display name (optional)"><Input value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} /></Field>
              <Field label="Email"><Input type="email" autoComplete="off" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></Field>
              <Field label="Role">
                <Select value={form.role} onValueChange={(role) => setForm({ ...form, role: role as StaffForm["role"] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="manager">Manager</SelectItem><SelectItem value="cashier">Cashier</SelectItem></SelectContent>
                </Select>
              </Field>
              <Field label="Temporary password">
                <PasswordInput autoComplete="new-password" required minLength={8} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
                <p className="text-xs text-muted-foreground mt-1">8+ characters with uppercase, lowercase, number, and symbol. Hidden by default — use the eye icon to check it.</p>
              </Field>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" disabled={busy} onClick={() => { setCreateOpen(false); setForm(emptyForm); }}>Cancel</Button>
              <Button type="submit" disabled={busy}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create Staff"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!pendingStatus} onOpenChange={(open) => !busy && !open && setPendingStatus(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{pendingStatus?.status === "active" ? "Deactivate staff access?" : "Activate staff access?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingStatus?.status === "active"
                ? "This person will immediately lose access because every request checks active membership."
                : "This person will regain access to this store using their current role."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={(event) => { event.preventDefault(); void confirmStatus(); }}>
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!pendingRole} onOpenChange={(open) => !busy && !open && setPendingRole(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change this staff role?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingRole?.member.display_name || pendingRole?.member.email} will receive {pendingRole?.role === "manager" ? "Manager operational access" : "Cashier-only POS access"} for this store.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(event) => {
                event.preventDefault();
                if (pendingRole) void updateRole(pendingRole.member, pendingRole.role);
              }}
            >
              Change Role
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={!!passwordTarget}
        onOpenChange={(open) => {
          if (busy || open) return;
          setPasswordTarget(null);
          setNewPassword("");
        }}
      >
        <DialogContent className="max-w-md">
          <form onSubmit={submitPassword}>
            <DialogHeader>
              <DialogTitle>Reset Temporary Password</DialogTitle>
              <DialogDescription>The password is sent securely and is never stored in application tables or audit logs.</DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Field label="New temporary password">
                <PasswordInput autoComplete="new-password" required minLength={8} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
                <p className="text-xs text-muted-foreground mt-1">8+ characters with uppercase, lowercase, number, and symbol. Hidden by default — use the eye icon to check it.</p>
              </Field>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" disabled={busy} onClick={() => { setPasswordTarget(null); setNewPassword(""); }}>Cancel</Button>
              <Button type="submit" disabled={busy}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Reset Password"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><Label className="mb-1.5 block">{label}</Label>{children}</div>;
}
