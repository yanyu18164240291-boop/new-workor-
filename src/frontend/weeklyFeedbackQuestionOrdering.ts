type OrderedQuestion = {
  id: string;
};

type QuestionOrderMoveResult = {
  changed: boolean;
  orderedIds: string[];
  persistedSortOrders: Array<{ id: string; sortOrder: number }>;
};

export function moveWeeklyQuestionByStep<T extends OrderedQuestion>(
  questions: T[],
  visibleQuestionIds: string[],
  questionId: string,
  direction: -1 | 1,
): QuestionOrderMoveResult {
  const visibleIndex = visibleQuestionIds.indexOf(questionId);
  const targetId = visibleQuestionIds[visibleIndex + direction];
  if (visibleIndex < 0 || !targetId) {
    const orderedIds = questions.map((question) => question.id);
    return {
      changed: false,
      orderedIds,
      persistedSortOrders: orderedIds.map((id, index) => ({ id, sortOrder: index + 1 })),
    };
  }

  const fromIndex = questions.findIndex((question) => question.id === questionId);
  const toIndex = questions.findIndex((question) => question.id === targetId);
  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
    const orderedIds = questions.map((question) => question.id);
    return {
      changed: false,
      orderedIds,
      persistedSortOrders: orderedIds.map((id, index) => ({ id, sortOrder: index + 1 })),
    };
  }

  const reordered = [...questions];
  const [moved] = reordered.splice(fromIndex, 1);
  reordered.splice(toIndex, 0, moved);
  const orderedIds = reordered.map((question) => question.id);
  return {
    changed: true,
    orderedIds,
    persistedSortOrders: orderedIds.map((id, index) => ({ id, sortOrder: index + 1 })),
  };
}
