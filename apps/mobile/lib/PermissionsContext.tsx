import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { supabase } from './supabase';
import {
  EnterpriseRole,
  PermissionAction,
  PermissionModule,
  getCurrentMembership,
  getPermissionsForCurrentUser,
  hasPermission,
} from './permissions';

type Permission = {
  code: string;
  module: PermissionModule;
  action: PermissionAction;
  description: string;
};

type PermissionsContextValue = {
  role: EnterpriseRole | null;
  organizationId: string | null;
  permissions: Permission[];
  loading: boolean;
  can: (module: PermissionModule, action: PermissionAction) => boolean;
  refresh: () => Promise<void>;
};

const PermissionsContext = createContext<PermissionsContextValue | undefined>(
  undefined,
);

export function PermissionsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [role, setRole] = useState<EnterpriseRole | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);

    try {
      const { data: membership } = await getCurrentMembership();

      if (!membership) {
        setRole(null);
        setOrganizationId(null);
        setPermissions([]);
        return;
      }

      setRole(membership.role as EnterpriseRole);
      setOrganizationId(membership.organization_id);

      const result = await getPermissionsForCurrentUser();

      setPermissions(
        (result.permissions ?? [])
          .map((item: any) => item.permissions)
          .filter(Boolean) as Permission[],
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void refresh();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [refresh]);

  const can = useCallback(
    (module: PermissionModule, action: PermissionAction) => {
      return permissions.some(
        permission =>
          permission.module === module && permission.action === action,
      );
    },
    [permissions],
  );

  const value = useMemo(
    () => ({
      role,
      organizationId,
      permissions,
      loading,
      can,
      refresh,
    }),
    [role, organizationId, permissions, loading, can, refresh],
  );

  return (
    <PermissionsContext.Provider value={value}>
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions() {
  const context = useContext(PermissionsContext);

  if (!context) {
    throw new Error(
      'usePermissions doit être utilisé dans PermissionsProvider',
    );
  }

  return context;
}

export function useCan(
  module: PermissionModule,
  action: PermissionAction,
) {
  const { can } = usePermissions();
  return can(module, action);
}

export async function checkPermission(
  module: PermissionModule,
  action: PermissionAction,
) {
  return hasPermission(module, action);
}
