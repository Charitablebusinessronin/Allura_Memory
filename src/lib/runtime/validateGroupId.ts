export class GroupIdValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GroupIdValidationError';
  }
}

export const validateGroupId = (groupId: string | undefined): string => {
  if (!groupId) {
    throw new GroupIdValidationError('group_id is required and cannot be empty');
  }
  
  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(groupId)) {
    throw new GroupIdValidationError(`Invalid group_id format: ${groupId}`);
  }
  
  return groupId;
};

export const validateTenantScope = (tenantScope: string | undefined): string => {
  if (!tenantScope) {
    throw new GroupIdValidationError('tenant_scope is required');
  }
  return tenantScope;
};

export const propagateRequestContext = (headers: any) => {
  const groupId = validateGroupId(headers['group-id']);
  const tenantScope = validateTenantScope(headers['tenant-scope']);
  
  return {
    groupId,
    tenantScope,
  };
};
