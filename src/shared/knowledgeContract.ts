export const KNOWLEDGE_CATEGORIES = ['入职知识', '入职流程', '系统权限', '反馈机制'] as const;

export type KnowledgeCategory = (typeof KNOWLEDGE_CATEGORIES)[number];

export const KNOWLEDGE_DOC_STATUSES = ['disabled', 'enabled', 'offline'] as const;
export const KNOWLEDGE_PARSE_STATUSES = ['pending', 'parsing', 'parsed'] as const;
export const KNOWLEDGE_VECTOR_STATUSES = ['pending', 'vectorizing', 'ready'] as const;

export type KnowledgeDocStatus = (typeof KNOWLEDGE_DOC_STATUSES)[number];
export type KnowledgeParseStatus = (typeof KNOWLEDGE_PARSE_STATUSES)[number];
export type KnowledgeVectorStatus = (typeof KNOWLEDGE_VECTOR_STATUSES)[number];

export function isKnowledgeCategory(value: unknown): value is KnowledgeCategory {
  return typeof value === 'string' && (KNOWLEDGE_CATEGORIES as readonly string[]).includes(value);
}

export function canEnableKnowledgeDoc(parseStatus: string, vectorStatus: string): boolean {
  return parseStatus === 'parsed' && vectorStatus === 'ready';
}
