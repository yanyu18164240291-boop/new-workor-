import {
  api,
  type AnonymousFeedback,
  type D1GuideConfigItem,
  type KnowledgeDoc,
  type PermissionItem,
  type Role,
  type WeeklyFeedbackOption,
  type WeeklyFeedbackQuestion,
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

export function createRoleForPackage(draft: Pick<Role, 'name' | 'department' | 'description'>) {
  return createPosition({
    ...draft,
    departmentId: `dept-${Date.now()}`,
  });
}

export function saveRoleForPackage(id: string, draft: Pick<Role, 'name' | 'department' | 'description'>) {
  return api.updateRole(id, { ...draft, updatedBy: adminActorName });
}

export function createPosition(draft: Pick<Role, 'name' | 'department' | 'description'> & { departmentId?: string }) {
  return api.createPosition({
    ...draft,
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

export function saveD1GuideItem(item: Partial<D1GuideConfigItem> & { actionKey: string }) {
  return api.updateD1GuideConfig([item], adminActorName);
}

type WeeklyFeedbackQuestionSave = Omit<WeeklyFeedbackQuestion, 'options'> & {
  options: Array<Pick<WeeklyFeedbackOption, 'label'> & Partial<WeeklyFeedbackOption>>;
};

export function saveWeeklyFeedbackQuestion(question: WeeklyFeedbackQuestionSave) {
  return api.updateWeeklyFeedbackConfig(
    [
      {
        id: question.id,
        title: question.title,
        description: question.description ?? null,
        required: question.required,
        maxLength: question.maxLength ?? null,
        enabled: question.enabled,
        options: question.options.map((option) => ({
          id: option.id,
          optionKey: option.optionKey,
          label: option.label,
          enabled: option.enabled,
          sortOrder: option.sortOrder,
        })),
      },
    ],
    adminActorName,
  );
}

export function createWeeklyFeedbackQuestion(
  question: Pick<WeeklyFeedbackQuestion, 'title' | 'inputType' | 'required' | 'maxLength' | 'enabled'> & {
    description?: string | null;
    options?: Array<{ label: string; enabled?: boolean; sortOrder?: number }>;
  },
) {
  return api.createWeeklyFeedbackQuestion({
    ...question,
    questionKey: `admin_${Date.now()}`,
    options: question.options ?? [],
    updatedBy: adminActorName,
  });
}

export function saveAnonymousFeedbackConfig(body: Parameters<typeof api.updateAnonymousFeedbackConfig>[0]) {
  return api.updateAnonymousFeedbackConfig({ ...body, updatedBy: adminActorName });
}

export function uploadKnowledgeMetadata(
  body: Pick<KnowledgeDoc, 'title' | 'category' | 'applicableRoleId' | 'applicableRole' | 'applicableStage' | 'ownerName'> & { sourceUrl?: string },
) {
  return api.createKnowledgeDoc({
    ...body,
    sourceUrl: body.sourceUrl ?? 'mock-drive://admin-upload',
    updatedBy: adminActorName,
  });
}

export function listKnowledgeDocsForFeedbackAction() {
  return api.getKnowledgeDocs();
}

export function triggerKnowledgeMockParse(id: string) {
  return api.triggerMockKnowledgeParse(id);
}

export function setKnowledgeDocStatus(id: string, status: 'disabled' | 'enabled' | 'offline') {
  return api.updateKnowledgeDocStatus(id, status);
}

export function processAnonymousFeedback(
  id: string,
  body: Pick<AnonymousFeedback, 'status' | 'ownerName' | 'result' | 'resolutionNote' | 'includedInReview'>,
) {
  return api.updateAnonymousFeedback(id, {
    ...body,
    handlerName: adminActorName,
    updatedBy: adminActorName,
  });
}
