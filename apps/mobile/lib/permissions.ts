import { supabase } from './supabase';

export type PermissionAction =
  | 'view'
  | 'create'
  | 'edit'
  | 'delete'
  | 'approve'
  | 'export'
  | 'execute';

export type PermissionModule =
  | 'direction'
  | 'finance'
  | 'hr'
  | 'communication'
  | 'commercial'
  | 'tasks'
  | 'ai'
  | 'profile';

export type EnterpriseRole =
  | 'OWNER'
  | 'ADMIN'
  | 'FINANCE'
  | 'HR'
  | 'MANAGER'
  | 'EMPLOYEE'
  | 'COMMERCIAL';

export async function getCurrentMembership() {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { data: null, error: userError ?? new Error('Utilisateur non connecté') };
  }

  return supabase
    .schema('enterprise')
    .from('organization_members')
    .select('id, organization_id, user_id, role')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();
}

export async function getCurrentRole(): Promise<EnterpriseRole | null> {
  const { data, error } = await getCurrentMembership();

  if (error || !data) {
    return null;
  }

  return data.role as EnterpriseRole;
}

export async function hasPermission(
  module: PermissionModule,
  action: PermissionAction,
): Promise<boolean> {
  const { data: membership, error: membershipError } =
    await getCurrentMembership();

  if (membershipError || !membership) {
    return false;
  }

  const { data, error } = await supabase.schema('enterprise').rpc('has_permission', {
    p_organization_id: membership.organization_id,
    p_module: module,
    p_action: action,
  });

  if (error) {
    return false;
  }

  return Boolean(data);
}

export async function getPermissionsForCurrentUser() {
  const { data: membership, error: membershipError } =
    await getCurrentMembership();

  if (membershipError || !membership) {
    return {
      role: null,
      permissions: [],
    };
  }

  const { data, error } = await supabase
    .schema('enterprise')
    .from('role_permissions')
    .select(`
      permission_id,
      permissions (
        code,
        module,
        action,
        description
      )
    `)
    .eq('role', membership.role);

  if (error) {
    return {
      role: membership.role as EnterpriseRole,
      permissions: [],
    };
  }

  return {
    role: membership.role as EnterpriseRole,
    permissions: data ?? [],
  };
}
