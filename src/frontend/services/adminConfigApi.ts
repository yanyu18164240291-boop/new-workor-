import {
  api,
  type AnonymousFeedback,
  type D1GuideConfigItem,
  type KnowledgeDoc,
  type PermissionItem,
  type WeeklyFeedbackQuestion,
} from '../api.ts';
import { currentAdminUser } from '../types/adminConfig.ts';

const adminActorName: typeof currentAdminUser.name = 'demo-admin';

export function getAdminOverviewData() {
  return api.getAdminConfig();
}

export function saveRolePackagePermission(id: string, draft: Partial<PermissionItem>) {
  return api.updatePermissionItem(id, { ...draft, updatedBy: adminActorName } as Partial<PermissionItem>);
}

export function createPermissionForRole(roleId: string, draft: Omit<PermissionItem, 'id' | 'sensitive'>) {
  return api
    .createPermissionItem({
      ...draft,
      updatedBy: adminActorName,
    } as Parameters<typeof api.createPermissionItem>[0])
    .then(async (created) => {
      await api.createRolePermissionItem({ roleId, permissionItemId: created.id });
      return created;
    });
}

export function saveD1GuideItem(item: Partial<D1GuideConfigItem> & { actionKey: string }) {
  return api.updateD1GuideConfig([{ ...item, updatedBy: adminActorName }]);
}

export function saveWeeklyFeedbackQuestion(question: WeeklyFeedbackQuestion) {
  return api.updateWeeklyFeedbackConfig([
    {
      id: question.id,
      title: question.title,
      description: question.description ?? null,
      required: question.required,
      maxLength: question.maxLength ?? null,
      enabled: question.enabled,
      options: question.options.map((option) => ({ id: option.id, label: option.label, enabled: option.enabled })),
    },
  ]);
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
  });
}

export function saveAnonymousFeedbackConfig(body: Parameters<typeof api.updateAnonymousFeedbackConfig>[0]) {
  return api.updateAnonymousFeedbackConfig(body);
}

export function uploadKnowledgeMetadata(
  body: Pick<KnowledgeDoc, 'title' | 'category' | 'applicableRole' | 'applicableStage' | 'ownerName'> & { sourceUrl?: string },
) {
  return api.createKnowledgeDoc({
    ...body,
    sourceUrl: body.sourceUrl ?? 'mock-drive://admin-upload',
  });
}

export function processAnonymousFeedback(
  id: string,
  body: Pick<AnonymousFeedback, 'status' | 'ownerName' | 'result' | 'resolutionNote' | 'includedInReview'>,
) {
  return api.updateAnonymousFeedback(id, {
    ...body,
    handlerName: adminActorName,
  });
}
