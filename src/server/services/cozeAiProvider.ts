type CozeWorkflowConfig = {
  apiBase: string;
  apiToken: string;
  workflowId?: string;
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
  conversationId?: string;
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
  const botId = process.env.COZE_BOT_ID?.trim();
  if (!apiToken || (!workflowId && !botId)) return undefined;
  return {
    apiBase: process.env.COZE_API_BASE?.trim() || 'https://api.coze.cn',
    apiToken,
    workflowId: workflowId || undefined,
    botId: botId || undefined,
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

async function readCozePayload(
  config: CozeWorkflowConfig,
  path: string,
  init: RequestInit,
  signal: AbortSignal,
): Promise<CozeWorkflowPayload> {
  const response = await fetch(`${config.apiBase.replace(/\/$/, '')}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${config.apiToken}`,
      'content-type': 'application/json',
      ...(init.headers ?? {}),
    },
    signal,
  });
  const payload = (await response.json()) as CozeWorkflowPayload;
  if (!response.ok || payload.code !== 0) {
    throw new Error(`Coze request failed: ${String(payload.msg ?? response.status)}`);
  }
  return payload;
}

function requiredRecord(value: unknown, message: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(message);
  return value as Record<string, unknown>;
}

function chatAnswer(payload: CozeWorkflowPayload): string {
  if (!Array.isArray(payload.data)) throw new Error('Coze chat messages were missing');
  for (let index = payload.data.length - 1; index >= 0; index -= 1) {
    const message = requiredRecord(payload.data[index], 'Coze chat message was invalid');
    if (message.role !== 'assistant' || message.type !== 'answer') continue;
    const rawContent = message.content;
    if (typeof rawContent === 'string') {
      const parsed = tryParseJson(rawContent);
      const answer = parsed === rawContent ? rawContent.trim() : pickText(parsed) ?? rawContent.trim();
      if (answer) return answer;
    }
    const answer = pickText(rawContent);
    if (answer) return answer;
  }
  throw new Error('Coze chat did not include an assistant answer');
}

async function runCozeBotChat(
  config: CozeWorkflowConfig & { botId: string },
  input: CozeWorkflowInput,
  signal: AbortSignal,
): Promise<{ answer: string; conversationId: string }> {
  const chatPath = input.conversationId
    ? `/v3/chat?conversation_id=${encodeURIComponent(input.conversationId)}`
    : '/v3/chat';
  const created = await readCozePayload(
    config,
    chatPath,
    {
      method: 'POST',
      body: JSON.stringify({
        bot_id: config.botId,
        user_id: input.newcomerId,
        stream: false,
        auto_save_history: true,
        additional_messages: [
          {
            role: 'user',
            content: input.question,
            content_type: 'text',
          },
        ],
      }),
    },
    signal,
  );
  const chat = requiredRecord(created.data, 'Coze chat creation data was missing');
  const chatId = String(chat.id ?? '');
  const conversationId = String(chat.conversation_id ?? '');
  let status = String(chat.status ?? '');
  if (!chatId || !conversationId) throw new Error('Coze chat identifiers were missing');

  for (let attempt = 0; status !== 'completed' && attempt < 175; attempt += 1) {
    if (['failed', 'requires_action', 'canceled'].includes(status)) {
      throw new Error(`Coze chat ended with status ${status}`);
    }
    const retrieved = await readCozePayload(
      config,
      `/v3/chat/retrieve?conversation_id=${encodeURIComponent(conversationId)}&chat_id=${encodeURIComponent(chatId)}`,
      { method: 'GET' },
      signal,
    );
    status = String(requiredRecord(retrieved.data, 'Coze chat status was missing').status ?? '');
    if (status !== 'completed') await new Promise((resolve) => setTimeout(resolve, 500));
  }
  if (status !== 'completed') throw new Error('Coze chat timed out');

  const messages = await readCozePayload(
    config,
    `/v3/chat/message/list?conversation_id=${encodeURIComponent(conversationId)}&chat_id=${encodeURIComponent(chatId)}`,
    { method: 'GET' },
    signal,
  );
  return { answer: chatAnswer(messages), conversationId };
}

async function runCozeWorkflow(
  config: CozeWorkflowConfig & { workflowId: string },
  input: CozeWorkflowInput,
  signal: AbortSignal,
): Promise<{ answer: string }> {
  const payload = await readCozePayload(
    config,
    '/v1/workflow/run',
    {
      method: 'POST',
      body: JSON.stringify({
        workflow_id: config.workflowId,
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
    },
    signal,
  );
  return { answer: extractCozeAnswer(payload) };
}

export async function runCozeProvider(input: CozeWorkflowInput): Promise<{ answer: string; conversationId?: string } | undefined> {
  const config = cozeConfig();
  if (!config) return undefined;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.botId ? 90_000 : 8_000);
  try {
    if (config.botId) return await runCozeBotChat(config as CozeWorkflowConfig & { botId: string }, input, controller.signal);
    if (config.workflowId) {
      return await runCozeWorkflow(config as CozeWorkflowConfig & { workflowId: string }, input, controller.signal);
    }
    return undefined;
  } catch {
    return undefined;
  } finally {
    clearTimeout(timeout);
  }
}
