import type { WeeklyFeedbackQuestion } from './api.ts';

export const DEFAULT_WEEKLY_MESSAGE = '这一周整体适应还可以，团队同学都很友好。目前主要还是部分权限没有完全开通。';

export type WeeklySelectionState = Record<string, string[]>;
export type WeeklyTextState = Record<string, string>;

export function createInitialWeeklySelections(questions: WeeklyFeedbackQuestion[]): WeeklySelectionState {
  return Object.fromEntries(
    questions
      .filter((question) => question.inputType === 'single' && question.options[0])
      .map((question) => [question.id, [question.options[0].id]]),
  );
}

export function reconcileWeeklySelections(questions: WeeklyFeedbackQuestion[], current: WeeklySelectionState): WeeklySelectionState {
  const next: WeeklySelectionState = {};
  for (const question of questions) {
    if (question.inputType === 'text') continue;
    const validOptionIds = new Set(question.options.map((option) => option.id));
    const selected = (current[question.id] ?? []).filter((id) => validOptionIds.has(id));
    next[question.id] = selected.length > 0 ? selected : question.inputType === 'single' && question.options[0] ? [question.options[0].id] : [];
  }
  return next;
}

export function reconcileWeeklyTextValues(questions: WeeklyFeedbackQuestion[], current: WeeklyTextState): WeeklyTextState {
  const next: WeeklyTextState = {};
  for (const question of questions) {
    if (question.inputType !== 'text') continue;
    next[question.id] = current[question.id] ?? (question.questionKey === 'message' ? DEFAULT_WEEKLY_MESSAGE : '');
  }
  return next;
}

export function findMissingWeeklyRequiredQuestion(
  questions: WeeklyFeedbackQuestion[],
  selectedByQuestion: WeeklySelectionState,
  textByQuestion: WeeklyTextState,
): WeeklyFeedbackQuestion | undefined {
  return questions.find((question) => {
    if (!question.required) return false;
    if (question.inputType === 'text') return !textByQuestion[question.id]?.trim();
    return (selectedByQuestion[question.id] ?? []).length === 0;
  });
}

export function buildWeeklyFeedbackAnswers(
  questions: WeeklyFeedbackQuestion[],
  selectedByQuestion: WeeklySelectionState,
  textByQuestion: WeeklyTextState,
) {
  return questions.map((question) =>
    question.inputType === 'text'
      ? { questionId: question.id, textValue: textByQuestion[question.id] ?? '' }
      : { questionId: question.id, selectedOptionIds: selectedByQuestion[question.id] ?? [] },
  );
}
