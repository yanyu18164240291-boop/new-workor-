PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  department TEXT NOT NULL,
  description TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  updatedBy TEXT NOT NULL DEFAULT 'demo-admin'
);

CREATE TABLE IF NOT EXISTS permission_items (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  permissionType TEXT NOT NULL CHECK (permissionType IN ('required', 'optional')),
  sensitive INTEGER NOT NULL CHECK (sensitive IN (0, 1)),
  ownerType TEXT NOT NULL DEFAULT 'department',
  ownerName TEXT NOT NULL,
  ownerContact TEXT NOT NULL,
  applyEntryName TEXT NOT NULL DEFAULT '',
  applyUrl TEXT NOT NULL,
  reasonTemplate TEXT NOT NULL,
  approverName TEXT NOT NULL,
  commonWaitingReasons TEXT NOT NULL,
  enabled INTEGER NOT NULL CHECK (enabled IN (0, 1)),
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  updatedBy TEXT NOT NULL DEFAULT 'demo-admin'
);

CREATE TABLE IF NOT EXISTS role_permission_items (
  id TEXT PRIMARY KEY,
  roleId TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permissionItemId TEXT NOT NULL REFERENCES permission_items(id) ON DELETE CASCADE,
  sortOrder INTEGER NOT NULL,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  updatedBy TEXT NOT NULL DEFAULT 'demo-admin',
  UNIQUE(roleId, permissionItemId)
);

CREATE TABLE IF NOT EXISTS newcomers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  roleId TEXT NOT NULL REFERENCES roles(id),
  department TEXT NOT NULL,
  stage TEXT NOT NULL,
  managerName TEXT NOT NULL,
  mentorName TEXT NOT NULL,
  status TEXT NOT NULL,
  d1GuideCompleted INTEGER NOT NULL CHECK (d1GuideCompleted IN (0, 1)),
  permissionPackageViewed INTEGER NOT NULL CHECK (permissionPackageViewed IN (0, 1)),
  weeklyFeedbackSubmitted INTEGER NOT NULL CHECK (weeklyFeedbackSubmitted IN (0, 1)),
  managerViewedFeedback INTEGER NOT NULL CHECK (managerViewedFeedback IN (0, 1)),
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS newcomer_task_states (
  id TEXT PRIMARY KEY,
  newcomerId TEXT NOT NULL REFERENCES newcomers(id) ON DELETE CASCADE,
  taskKey TEXT NOT NULL,
  taskName TEXT NOT NULL,
  status TEXT NOT NULL,
  completedAt TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  UNIQUE(newcomerId, taskKey)
);

CREATE TABLE IF NOT EXISTS d1_guide_configs (
  actionKey TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  targetGroupName TEXT,
  applyUrl TEXT,
  sendToEmployeeName TEXT,
  sendToEmployeeContact TEXT,
  documentTitle TEXT,
  documentUrl TEXT,
  routePath TEXT,
  label TEXT NOT NULL,
  ownerName TEXT NOT NULL,
  enabled INTEGER NOT NULL CHECK (enabled IN (0, 1)),
  sortOrder INTEGER NOT NULL,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  updatedBy TEXT NOT NULL DEFAULT 'demo-admin'
);

CREATE TABLE IF NOT EXISTS permission_progress (
  id TEXT PRIMARY KEY,
  newcomerId TEXT NOT NULL REFERENCES newcomers(id) ON DELETE CASCADE,
  permissionItemId TEXT NOT NULL REFERENCES permission_items(id),
  status TEXT NOT NULL,
  submittedAt TEXT,
  completedAt TEXT,
  lastActionAt TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  UNIQUE(newcomerId, permissionItemId)
);

CREATE TABLE IF NOT EXISTS follow_up_tasks (
  id TEXT PRIMARY KEY,
  newcomerId TEXT NOT NULL REFERENCES newcomers(id) ON DELETE CASCADE,
  permissionProgressId TEXT NOT NULL REFERENCES permission_progress(id) ON DELETE CASCADE,
  submittedAt TEXT NOT NULL,
  followUpAt TEXT NOT NULL,
  status TEXT NOT NULL,
  ownerName TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  UNIQUE(permissionProgressId)
);

CREATE TABLE IF NOT EXISTS follow_up_message_cards (
  id TEXT PRIMARY KEY,
  followUpTaskId TEXT NOT NULL REFERENCES follow_up_tasks(id) ON DELETE CASCADE,
  newcomerId TEXT NOT NULL REFERENCES newcomers(id) ON DELETE CASCADE,
  permissionProgressId TEXT NOT NULL REFERENCES permission_progress(id) ON DELETE CASCADE,
  permissionName TEXT NOT NULL,
  deliveryChannel TEXT NOT NULL,
  deliveryStatus TEXT NOT NULL,
  cardTitle TEXT NOT NULL,
  cardBody TEXT NOT NULL,
  actionUrl TEXT NOT NULL,
  scheduledAt TEXT NOT NULL,
  sentAt TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  UNIQUE(followUpTaskId)
);

CREATE TABLE IF NOT EXISTS anonymous_feedbacks (
  id TEXT PRIMARY KEY,
  feedbackNo TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL,
  module TEXT NOT NULL,
  description TEXT NOT NULL,
  expectedAction TEXT NOT NULL,
  isAnonymous INTEGER NOT NULL CHECK (isAnonymous IN (0, 1)),
  contactName TEXT,
  contactInfo TEXT,
  submittedByNewcomerId TEXT REFERENCES newcomers(id),
  submittedAt TEXT NOT NULL,
  ownerName TEXT NOT NULL,
  status TEXT NOT NULL,
  result TEXT NOT NULL,
  handlerName TEXT,
  handledAt TEXT,
  resolutionNote TEXT,
  includedInReview INTEGER NOT NULL CHECK (includedInReview IN (0, 1)),
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  updatedBy TEXT NOT NULL DEFAULT 'demo-admin'
);

CREATE TABLE IF NOT EXISTS anonymous_feedback_modules (
  id TEXT PRIMARY KEY,
  moduleKey TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  enabled INTEGER NOT NULL CHECK (enabled IN (0, 1)),
  sortOrder INTEGER NOT NULL,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  updatedBy TEXT NOT NULL DEFAULT 'demo-admin'
);

CREATE TABLE IF NOT EXISTS anonymous_feedback_problem_types (
  id TEXT PRIMARY KEY,
  moduleId TEXT NOT NULL REFERENCES anonymous_feedback_modules(id) ON DELETE CASCADE,
  typeKey TEXT NOT NULL,
  label TEXT NOT NULL,
  requiresText INTEGER NOT NULL CHECK (requiresText IN (0, 1)),
  enabled INTEGER NOT NULL CHECK (enabled IN (0, 1)),
  sortOrder INTEGER NOT NULL,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  updatedBy TEXT NOT NULL DEFAULT 'demo-admin',
  UNIQUE(moduleId, typeKey)
);

CREATE TABLE IF NOT EXISTS anonymous_feedback_expected_actions (
  id TEXT PRIMARY KEY,
  moduleId TEXT NOT NULL REFERENCES anonymous_feedback_modules(id) ON DELETE CASCADE,
  actionKey TEXT NOT NULL,
  label TEXT NOT NULL,
  requiresText INTEGER NOT NULL CHECK (requiresText IN (0, 1)),
  enabled INTEGER NOT NULL CHECK (enabled IN (0, 1)),
  sortOrder INTEGER NOT NULL,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  updatedBy TEXT NOT NULL DEFAULT 'demo-admin',
  UNIQUE(moduleId, actionKey)
);

CREATE TABLE IF NOT EXISTS anonymous_feedback_details (
  id TEXT PRIMARY KEY,
  anonymousFeedbackId TEXT NOT NULL REFERENCES anonymous_feedbacks(id) ON DELETE CASCADE,
  moduleKey TEXT NOT NULL,
  problemTypeKey TEXT NOT NULL,
  problemTypeOtherText TEXT,
  expectedActionKeys TEXT NOT NULL,
  expectedActionOtherText TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  UNIQUE(anonymousFeedbackId)
);

CREATE TABLE IF NOT EXISTS weekly_feedbacks (
  id TEXT PRIMARY KEY,
  newcomerId TEXT NOT NULL REFERENCES newcomers(id) ON DELETE CASCADE,
  overallFeeling TEXT NOT NULL,
  blockers TEXT NOT NULL,
  supportNeeded TEXT NOT NULL,
  message TEXT NOT NULL,
  visibleToManager INTEGER NOT NULL CHECK (visibleToManager IN (0, 1)),
  lifecycle TEXT NOT NULL,
  submittedAt TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS weekly_feedback_questions (
  id TEXT PRIMARY KEY,
  questionKey TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  inputType TEXT NOT NULL CHECK (inputType IN ('single', 'multi', 'text')),
  required INTEGER NOT NULL CHECK (required IN (0, 1)),
  maxLength INTEGER,
  enabled INTEGER NOT NULL CHECK (enabled IN (0, 1)),
  sortOrder INTEGER NOT NULL,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  updatedBy TEXT NOT NULL DEFAULT 'demo-admin'
);

CREATE TABLE IF NOT EXISTS weekly_feedback_options (
  id TEXT PRIMARY KEY,
  questionId TEXT NOT NULL REFERENCES weekly_feedback_questions(id) ON DELETE CASCADE,
  optionKey TEXT NOT NULL,
  label TEXT NOT NULL,
  enabled INTEGER NOT NULL CHECK (enabled IN (0, 1)),
  sortOrder INTEGER NOT NULL,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  updatedBy TEXT NOT NULL DEFAULT 'demo-admin',
  UNIQUE(questionId, optionKey)
);

CREATE TABLE IF NOT EXISTS weekly_feedback_answers (
  id TEXT PRIMARY KEY,
  weeklyFeedbackId TEXT NOT NULL REFERENCES weekly_feedbacks(id) ON DELETE CASCADE,
  questionId TEXT NOT NULL REFERENCES weekly_feedback_questions(id),
  optionId TEXT REFERENCES weekly_feedback_options(id),
  textValue TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS manager_feedback_actions (
  id TEXT PRIMARY KEY,
  weeklyFeedbackId TEXT NOT NULL REFERENCES weekly_feedbacks(id) ON DELETE CASCADE,
  managerName TEXT NOT NULL,
  managerViewed INTEGER NOT NULL CHECK (managerViewed IN (0, 1)),
  managerViewedAt TEXT,
  managerActionStatus TEXT NOT NULL,
  actionNote TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS knowledge_base_docs (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  applicableRole TEXT NOT NULL,
  applicableStage TEXT NOT NULL,
  sourceUrl TEXT NOT NULL,
  ownerName TEXT NOT NULL,
  status TEXT NOT NULL,
  parseStatus TEXT NOT NULL,
  vectorStatus TEXT NOT NULL,
  hitCount INTEGER NOT NULL,
  updatedAt TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  updatedBy TEXT NOT NULL DEFAULT 'demo-admin'
);
