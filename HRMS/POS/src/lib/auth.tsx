import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useMemo } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { setActiveCurrency } from "@/lib/format";
import type { Fee } from "@/lib/fees";
import { resetProductCache } from "@/lib/store";

export type AppRole = "admin" | "manager" | "cashier";
export type MembershipStatus = "active" | "inactive";

export type StoreMembership = {
  id: string;
  store_id: string;
  user_id: string;
  role: AppRole;
  status: MembershipStatus;
  display_name?: string | null;
  created_at: string;
};

export type Store = {
  id: string;
  name: string;
  owner_id?: string | null;
  currency?: string | null;
  owner_name?: string | null;
  phone?: string | null;
  address?: string | null;
  fees?: Fee[] | null;
  payment_qr_url?: string | null;
};

export type Permissions = {
  isAdmin: boolean;
  isManager: boolean;
  isCashier: boolean;
  canUsePOS: boolean;
  canManageInventory: boolean;
  canViewReports: boolean;
  canManageStaff: boolean;
  canManageSettings: boolean;
  canViewProfit: boolean;
  canViewAuditLogs: boolean;
  canManageCategories: boolean;
};

const noPermissions: Permissions = {
  isAdmin: false,
  isManager: false,
  isCashier: false,
  canUsePOS: false,
  canManageInventory: false,
  canViewReports: false,
  canManageStaff: false,
  canManageSettings: false,
  canViewProfit: false,
  canViewAuditLogs: false,
  canManageCategories: false,
};

type AuthCtx = {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  membership: StoreMembership | null;
  store: Store | null;
  permissions: Permissions;
  loading: boolean;
  authorizationError: string | null;
  refreshStore: () => Promise<void>;
  refreshAuthorization: () => Promise<void>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

function permissionsFor(role: AppRole | null): Permissions {
  if (!role) return noPermissions;
  const isAdmin = role === "admin";
  const isManager = role === "manager";
  const isCashier = role === "cashier";
  return {
    isAdmin,
    isManager,
    isCashier,
    canUsePOS: true,
    canManageInventory: isAdmin || isManager,
    canViewReports: isAdmin || isManager,
    canManageStaff: isAdmin,
    canManageSettings: isAdmin,
    canViewProfit: isAdmin || isManager,
    canViewAuditLogs: isAdmin || isManager,
    canManageCategories: isAdmin || isManager,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [membership, setMembership] = useState<StoreMembership | null>(null);
  const [store, setStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);
  const [authorizationError, setAuthorizationError] = useState<string | null>(null);

  const clearAuthorization = useCallback(() => {
    resetProductCache();
    setMembership(null);
    setStore(null);
    setAuthorizationError(null);
    setActiveCurrency(null);
  }, []);

  const loadStore = useCallback(async (activeMembership: StoreMembership): Promise<Store> => {
    if (activeMembership.role === "cashier") {
      const { data, error } = await supabase.rpc("get_pos_store", {
        _store_id: activeMembership.store_id,
      });
      if (error || !data) throw new Error("Your assigned store could not be loaded.");
      return data as unknown as Store;
    }

    const { data, error } = await supabase
      .from("stores")
      .select("*")
      .eq("id", activeMembership.store_id)
      .maybeSingle();
    if (error || !data) throw new Error("Your assigned store could not be loaded.");
    return data as unknown as Store;
  }, []);

  const loadAuthorization = useCallback(async (uid: string) => {
    clearAuthorization();
    const { data, error } = await supabase
      .from("store_memberships")
      .select("id, store_id, user_id, role, status, display_name, created_at")
      .eq("user_id", uid)
      .order("created_at", { ascending: true });

    if (error) {
      setAuthorizationError("Store access could not be verified. Please try signing in again.");
      return;
    }

    const memberships = (data ?? []) as StoreMembership[];
    const active = memberships.find((item) =>
      item.status === "active" &&
      (item.role === "admin" || item.role === "manager" || item.role === "cashier")
    );

    if (!active) {
      setAuthorizationError(
        memberships.some((item) => item.status === "inactive")
          ? "Your store access is inactive. Contact your store Admin."
          : "No active store membership is assigned to this account."
      );
      return;
    }

    try {
      const assignedStore = await loadStore(active);
      setMembership(active);
      setStore(assignedStore);
      setActiveCurrency(assignedStore.currency);
    } catch (error) {
      setAuthorizationError(error instanceof Error ? error.message : "Store access could not be verified.");
    }
  }, [clearAuthorization, loadStore]);

  const refreshAuthorization = useCallback(async () => {
    if (!session?.user) {
      clearAuthorization();
      return;
    }
    setLoading(true);
    await loadAuthorization(session.user.id);
    setLoading(false);
  }, [clearAuthorization, loadAuthorization, session]);

  const refreshStore = useCallback(async () => {
    if (!membership) return;
    try {
      const assignedStore = await loadStore(membership);
      setStore(assignedStore);
      setActiveCurrency(assignedStore.currency);
      setAuthorizationError(null);
    } catch (error) {
      setStore(null);
      setAuthorizationError(error instanceof Error ? error.message : "Store access could not be verified.");
    }
  }, [loadStore, membership]);

  useEffect(() => {
    let mounted = true;
    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      setLoading(true);
      if (nextSession?.user) {
        setTimeout(async () => {
          await loadAuthorization(nextSession.user.id);
          if (mounted) setLoading(false);
        }, 0);
      } else {
        clearAuthorization();
        setLoading(false);
      }
    });

    supabase.auth.getSession().then(async ({ data: { session: initialSession } }) => {
      if (!mounted) return;
      setSession(initialSession);
      if (initialSession?.user) await loadAuthorization(initialSession.user.id);
      if (mounted) setLoading(false);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [clearAuthorization, loadAuthorization]);

  const signOut = useCallback(async () => {
    clearAuthorization();
    setSession(null);
    await supabase.auth.signOut();
  }, [clearAuthorization]);

  const role = membership?.status === "active" ? membership.role : null;
  const permissions = useMemo(() => permissionsFor(role), [role]);

  return (
    <Ctx.Provider value={{
      user: session?.user ?? null,
      session,
      role,
      membership,
      store,
      permissions,
      loading,
      authorizationError,
      refreshStore,
      refreshAuthorization,
      signOut,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const context = useContext(Ctx);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
