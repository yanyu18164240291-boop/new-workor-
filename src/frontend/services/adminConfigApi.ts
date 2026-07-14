import {
  api,
  type KnowledgeDoc,
  type PermissionItem,
  type Role,
} from '../api.ts';
import { currentAdminUser } from '../types/adminConfig.ts';

const adminActorName = currentAdminUser.name;

export function getAdminOverviewData() {
  return api.getAdminConfig();
}

export function saveRolePackagePermission(id: string, draft: Partial<PermissionItem>) {
  return api.updatePermissionItem(id, {
    ...draft,
    expectedUpdatedAt: draft.updatedAt,
    updatedBy: adminActorName,
  } as Parameters<typeof api.updatePermissionItem>[1]);
}

export function createRoleForPackage(draft: Pick<Role, 'name' | 'department' | 'description'> & { enabled?: boolean }) {
  return createPosition({
    ...draft,
    departmentId: `dept-${Date.now()}`,
  });
}

export function saveRoleForPackage(id: string, draft: Pick<Role, 'name' | 'department' | 'description'> & { enabled?: boolean }) {
  return api.updateRole(id, { ...draft, updatedBy: adminActorName });
}

export function createPosition(draft: Pick<Role, 'name' | 'department' | 'description'> & { departmentId?: string; enabled?: boolean }) {
  return api.createPosition({
    name: draft.name,
    department: draft.department,
    description: draft.description,
    departmentId: draft.departmentId?.trim() || `dept-${Date.now()}`,
    updatedBy: adminActorName,
  });
}

export function createPermissionForRole(roleId: string, draft: Omit<PermissionItem, 'id' | 'sensitive'>) {
  return api
    .createPermissionItem({
      ...draft,
      updatedBy: adminActorName,
    } as Parameters<typeof api.createPermissionItem>[0])
    .then(async (created) => {
      await api.createRolePermissionItem({ roleId, permissionItemId: created.id, updatedBy: adminActorName });
      return created;
    });
}

export function bindExistingPermissionForRole(roleId: string, permissionItemId: string) {
  return api.createRolePermissionItem({ roleId, permissionItemId, updatedBy: adminActorName });
}

export function uploadKnowledgeMetadata(
  body: Pick<
    KnowledgeDoc,
    'title' | 'category' | 'applicableRoleId' | 'applicableRole' | 'applicableStage' | 'ownerName'
  > & { sourceUrl?: string; contentText?: string; retrievalKeywords?: string },
) {
  return api.createKnowledgeDoc({
    ...body,
    sourceUrl: body.sourceUrl ?? 'mock-drive://admin-upload',
    updatedBy: adminActorName,
  });
}

export function triggerKnowledgeMockParse(id: string) {
  return api.triggerMockKnowledgeParse(id);
}

export function setKnowledgeDocStatus(id: string, status: 'disabled' | 'enabled' | 'offline') {
  return api.updateKnowledgeDocStatus(id, status);
}
