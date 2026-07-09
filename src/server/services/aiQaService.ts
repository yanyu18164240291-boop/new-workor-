import { badRequest } from '../errors.ts';
import { incrementKnowledgeDocHitCounts, listRagReadyKnowledgeDocs } from '../repositories/knowledgeRepository.ts';
import type { RouteMatch } from '../routeKit.ts';
import { readBody, requiredString } from '../routeKit.ts';
import { runCozeWorkflow } from './cozeAiProvider.ts';

type RagCandidate = {
  doc: Record<string, unknown>;
  score: number;
  excerpt: string;
};

function normalizeText(value: unknown): string {
  return String(value ?? '').toLowerCase();
}

function queryTokens(question: string): string[] {
  const matches = question.toLowerCase().match(/[a-z0-9]+|[\u4e00-\u9fa5]{2,}/g) ?? [];
  return [...new Set(matches.filter((token) => token.length >= 2))];
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[。！？.!?])\s*|\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function bestExcerpt(content: string, tokens: string[]): string {
  const sentences = splitSentences(content);
  const matched = sentences.find((sentence) => {
    const normalized = normalizeText(sentence);
    return tokens.some((token) => normalized.includes(token));
  });
  return matched ?? sentences[0] ?? content.slice(0, 160);
}

function scoreDoc(doc: Record<string, unknown>, tokens: string[]): RagCandidate {
  const title = normalizeText(doc.title);
  const category = normalizeText(doc.category);
  const keywords = normalizeText(doc.retrievalKeywords);
  const content = normalizeText(doc.contentText);
  let score = 0;
  for (const token of tokens) {
    if (title.includes(token)) score += 8;
    if (keywords.includes(token)) score += 6;
    if (content.includes(token)) score += 3;
    if (category.includes(token)) score += 1;
  }
  return {
    doc,
    score,
    excerpt: bestExcerpt(String(doc.contentText ?? ''), tokens),
  };
}

function buildAnswer(matches: RagCandidate[]): string {
  const lines = matches.map((match) => match.excerpt).filter(Boolean);
  return `根据新人入职知识库：${lines.join(' ')}`;
}

function buildLocalKnowledgeContext(matches: RagCandidate[]): string {
  return matches.map((match) => `${String(match.doc.title ?? '')}: ${match.excerpt}`).join('\n');
}

function buildCitations(matches: RagCandidate[]) {
  return matches.map((candidate) => ({
    docId: candidate.doc.id,
    title: candidate.doc.title,
    ownerName: candidate.doc.ownerName,
    sourceUrl: candidate.doc.sourceUrl,
  }));
}

export const answerNewcomerAiChat: RouteMatch['handler'] = async ({ db, request }, match) => {
  const newcomerId = decodeURIComponent(match[1]);
  const body = await readBody(request);
  const question = requiredString(body, 'question');
  if (question.length > 200) throw badRequest('question is too long');

  const newcomer = db.prepare('SELECT id, roleId FROM newcomers WHERE id = ?').get(newcomerId) as
    | { id: string; roleId: string }
    | undefined;
  if (!newcomer) return { status: 404, error: 'Newcomer not found' };

  const tokens = queryTokens(question);
  const candidates = listRagReadyKnowledgeDocs(db, newcomer.roleId)
    .map((doc) => scoreDoc(doc, tokens))
    .filter((candidate) => candidate.score > 0 && candidate.excerpt.trim())
    .sort((left, right) => right.score - left.score)
    .slice(0, 2);

  const citations = buildCitations(candidates);
  const coze = await runCozeWorkflow({
    question,
    newcomerId,
    roleId: newcomer.roleId,
    localKnowledgeContext: buildLocalKnowledgeContext(candidates),
    citations,
  });

  if (coze) {
    if (candidates.length > 0) incrementKnowledgeDocHitCounts(db, candidates.map((candidate) => String(candidate.doc.id)));
    return {
      data: {
        mode: 'coze',
        answer: coze.answer,
        citations,
      },
    };
  }

  if (candidates.length === 0) {
    return {
      data: {
        mode: 'no_match',
        answer: '暂时没有找到可引用的知识库资料，请联系新人入职支持同学补充知识库。',
        citations: [],
      },
    };
  }

  incrementKnowledgeDocHitCounts(db, candidates.map((candidate) => String(candidate.doc.id)));

  return {
    data: {
      mode: 'local_rag',
      answer: buildAnswer(candidates),
      citations,
    },
  };
};
