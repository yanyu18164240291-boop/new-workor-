type CozeWorkflowConfig = {
  apiBase: string;
  apiToken: string;
  workflowId: string;
  botId?: string;
  appId?: string;
};

type CozeWorkflowPayload = {
  code?: number;
  msg?: unknown;
  data?: unknown;
};

export type CozeWorkflowInput = {
  question: string;
  newcomerId: string;
  roleId: string;
  localKnowledgeContext: string;
  citations: Array<{
    docId: unknown;
    title: unknown;
    ownerName: unknown;
    sourceUrl: unknown;
  }>;
};

function cozeConfig(): CozeWorkflowConfig | undefined {
  const apiToken = process.env.COZE_API_TOKEN?.trim();
  const workflowId = process.env.COZE_WORKFLOW_ID?.trim();
  if (!apiToken || !workflowId) return undefined;
  return {
    apiBase: process.env.COZE_API_BASE?.trim() || 'https://api.coze.cn',
    apiToken,
    workflowId,
    botId: process.env.COZE_BOT_ID?.trim() || undefined,
    appId: process.env.COZE_APP_ID?.trim() || undefined,
  };
}

function tryParseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function pickText(value: unknown): string | undefined {
  if (typeof value === 'string') return value.trim() || undefined;
  if (!value || typeof value !== 'object') return undefined;
  const record = value as Record<string, unknown>;
  for (const key of ['answer', 'output', 'content', 'text', 'reply']) {
    const candidate = pickText(record[key]);
    if (candidate) return candidate;
  }
  return undefined;
}

function extractCozeAnswer(payload: CozeWorkflowPayload): string {
  const data = typeof payload.data === 'string' ? tryParseJson(payload.data) : payload.data;
  const answer = pickText(data);
  if (!answer) throw new Error('Coze workflow response did not include answer text');
  return answer;
}

export async function runCozeWorkflow(input: CozeWorkflowInput): Promise<{ answer: string } | undefined> {
  const config = cozeConfig();
  if (!config) return undefined;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`${config.apiBase.replace(/\/$/, '')}/v1/workflow/run`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${config.apiToken}`,
        'content-type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        workflow_id: config.workflowId,
        ...(config.botId ? { bot_id: config.botId } : {}),
        ...(config.appId ? { app_id: config.appId } : {}),
        parameters: {
          question: input.question,
          USER_INPUT: input.question,
          newcomerId: input.newcomerId,
          roleId: input.roleId,
          localKnowledgeContext: input.localKnowledgeContext,
          citations: input.citations,
        },
      }),
    });
    const payload = (await response.json()) as CozeWorkflowPayload;
    if (!response.ok || payload.code !== 0) throw new Error(`Coze workflow failed: ${String(payload.msg ?? response.status)}`);
    return { answer: extractCozeAnswer(payload) };
  } catch {
    return undefined;
  } finally {
    clearTimeout(timeout);
  }
}
