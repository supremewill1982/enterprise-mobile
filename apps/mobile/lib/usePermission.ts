import { PermissionAction, PermissionModule } from './permissions';
import { usePermissions } from './PermissionsContext';

export function usePermission(
  module: PermissionModule,
  action: PermissionAction,
) {
  const { can, loading } = usePermissions();

  return {
    allowed: can(module, action),
    loading,
  };
}
