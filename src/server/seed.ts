import type { SQLInputValue } from 'node:sqlite';

import type { Database } from './db.ts';

const seedTime = '2026-06-24T01:00:00.000Z';
const realFeishuDepartmentChatUrl = 'https://applink.feishu.cn/client/chat/open?openChatId=oc_e558991e19bf2e476fbd51f4691f3bb4';
const realEmployeeGuideUrl = 'https://haidilao.feishu.cn/docx/YB37dnzemobXxMxGiuycsFHvnlv';
const realChatgptApprovalUrl = 'https://applink.feishu.cn/T97PFtN6Wdeo';
const collaborationOrgPath = '海底捞国际控股有限公司-集团总部-中台业务-技术管理中心-信息技术部-运维与网安组-安全与合规组';

const tables = [
  'manager_feedback_actions',
  'weekly_feedback_answers',
  'weekly_feedback_options',
  'weekly_feedback_questions',
  'weekly_feedbacks',
  'anonymous_feedback_details',
  'anonymous_feedback_expected_actions',
  'anonymous_feedback_problem_types',
  'anonymous_feedback_modules',
  'anonymous_feedbacks',
  'follow_up_message_cards',
  'follow_up_tasks',
  'permission_progress',
  'newcomer_task_states',
  'd1_guide_configs',
  'newcomers',
  'role_permission_items',
  'permission_items',
  'roles',
  'knowledge_base_docs',
];

function insert(db: Database, table: string, row: Record<string, unknown>): void {
  const keys = Object.keys(row);
  const placeholders = keys.map(() => '?').join(', ');
  db.prepare(`INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`).run(...keys.map((key) => row[key] as SQLInputValue));
}

function insertIfMissing(db: Database, table: string, keyColumn: string, row: Record<string, unknown>): void {
  const existing = db.prepare(`SELECT ${keyColumn} FROM ${table} WHERE ${keyColumn} = ?`).get(row[keyColumn] as SQLInputValue);
  if (existing) return;
  insert(db, table, row);
}

function seedDemoWeeklyWorkSummaryAnswer(db: Database): void {
  const row = db
    .prepare("SELECT id, COALESCE(workSummary, '') AS workSummary FROM weekly_feedbacks WHERE id = ?")
    .get('weekly-yanyu') as { id: string; workSummary: string } | undefined;
  if (!row) return;

  const summary = row.workSummary.trim() || '111';
  if (!row.workSummary.trim()) {
    db.prepare('UPDATE weekly_feedbacks SET workSummary = ?, updatedAt = ? WHERE id = ?').run(summary, seedTime, row.id);
  }

  const existing = db
    .prepare('SELECT id FROM weekly_feedback_answers WHERE weeklyFeedbackId = ? AND questionId = ? LIMIT 1')
    .get(row.id, 'wfq-work-summary');
  if (existing) return;

  insert(db, 'weekly_feedback_answers', {
    id: 'wfa-yanyu-work-summary',
    weeklyFeedbackId: row.id,
    questionId: 'wfq-work-summary',
    optionId: null,
    textValue: summary,
    createdAt: seedTime,
    updatedAt: seedTime,
  });
}

export function seedManagerFeedbackActions(db: Database): void {
  const rows = db
    .prepare(
      `SELECT wf.id AS weeklyFeedbackId, wf.submittedAt, n.managerName
       FROM weekly_feedbacks wf
       JOIN newcomers n ON n.id = wf.newcomerId
       LEFT JOIN manager_feedback_actions mfa ON mfa.weeklyFeedbackId = wf.id
       WHERE wf.visibleToManager = 1 AND mfa.id IS NULL
       ORDER BY wf.submittedAt`,
    )
    .all() as Array<{ weeklyFeedbackId: string; submittedAt: string; managerName: string }>;

  for (const row of rows) {
    insert(db, 'manager_feedback_actions', {
      id: `manager-action-${row.weeklyFeedbackId}`,
      weeklyFeedbackId: row.weeklyFeedbackId,
      managerName: row.managerName,
      managerViewed: 0,
      managerViewedAt: null,
      managerActionStatus: 'unread',
      actionNote: '',
      createdAt: row.submittedAt,
      updatedAt: row.submittedAt,
    });
  }
}

function addHours(iso: string, hours: number): string {
  return new Date(new Date(iso).getTime() + hours * 60 * 60 * 1000).toISOString();
}

function demoJoinCompletedAt(dayOffset: number): string {
  const day = new Date();
  day.setHours(2, 0, 0, 0);
  day.setDate(day.getDate() - dayOffset);
  return day.toISOString();
}

function demoFeishuJoinCompletedAt(newcomerId: string, fallback: string): string {
  if (newcomerId === 'newcomer-yanyu') return demoJoinCompletedAt(6);
  if (newcomerId === 'newcomer-cuilingfei') return demoJoinCompletedAt(0);
  return fallback;
}

const d1GuideDefaults = [
  {
    actionKey: 'join_group',
    taskType: 'join_group',
    organizationPath: collaborationOrgPath,
    departmentId: 'dept-collaboration-office',
    departmentName: '协同办公部门',
    roleId: 'role-product-intern',
    roleName: '协同办公产品实习生',
    title: '加入飞书部门群',
    description: '进入新人群，导师会在群内同步安排。',
    targetGroupName: '协同办公部门新人群',
    applyUrl: realFeishuDepartmentChatUrl,
    sendToEmployeeName: '刘长省',
    sendToEmployeeContact: 'liuchangsheng@haina.example',
    documentTitle: null,
    documentUrl: null,
    resourceLinks: JSON.stringify([
      {
        name: '协同办公部门新人群',
        url: realFeishuDepartmentChatUrl,
        chatId: 'oc_e558991e19bf2e476fbd51f4691f3bb4',
        qrCodeUrl: '',
      },
    ]),
    routePath: null,
    label: '加入飞书部门群',
    ownerName: '协同办公部门',
    enabled: 1,
    sortOrder: 1,
    createdAt: seedTime,
    updatedAt: seedTime,
  },
  {
    actionKey: 'employee_guide',
    taskType: 'employee_guide',
    organizationPath: collaborationOrgPath,
    departmentId: 'dept-collaboration-office',
    departmentName: '协同办公部门',
    roleId: 'role-product-intern',
    roleName: '协同办公产品实习生',
    title: '查看员工指南册',
    description: '办公规范、门禁、餐饮、常见问题。',
    targetGroupName: null,
    applyUrl: null,
    sendToEmployeeName: null,
    sendToEmployeeContact: null,
    documentTitle: '协同办公部门员工指南册',
    documentUrl: realEmployeeGuideUrl,
    resourceLinks: JSON.stringify([]),
    routePath: null,
    label: '查看员工指南册',
    ownerName: '协同办公内容 Owner',
    enabled: 1,
    sortOrder: 2,
    createdAt: seedTime,
    updatedAt: seedTime,
  },
  {
    actionKey: 'permission_package',
    taskType: 'permission_package',
    organizationPath: collaborationOrgPath,
    departmentId: 'dept-collaboration-office',
    departmentName: '协同办公部门',
    roleId: 'role-product-intern',
    roleName: '协同办公产品实习生',
    title: '开通岗位权限包',
    description: '查看并申请岗位必开权限与可选权限。',
    targetGroupName: null,
    applyUrl: null,
    sendToEmployeeName: null,
    sendToEmployeeContact: null,
    documentTitle: null,
    documentUrl: null,
    resourceLinks: JSON.stringify([]),
    routePath: '/permissions',
    label: '开通岗位权限包',
    ownerName: '协同办公权限 Owner',
    enabled: 1,
    sortOrder: 3,
    createdAt: seedTime,
    updatedAt: seedTime,
  },
] as const;

function isCorruptedSeedText(value: unknown): boolean {
  if (typeof value !== 'string') return true;
  const trimmed = value.trim();
  return trimmed === '' || /^\?+$/.test(trimmed) || trimmed.toLowerCase() === 'smoke check';
}

function needsD1FieldRepair(actionKey: string, key: string, existing: Record<string, unknown>): boolean {
  if (actionKey === 'permission_package' && ['title', 'label'].includes(key)) {
    const value = typeof existing[key] === 'string' ? existing[key].trim() : '';
    if (value === '打开岗位权限包' || value === '申请岗位权限') return true;
  }
  if (['title', 'description', 'label', 'ownerName'].includes(key)) return isCorruptedSeedText(existing[key]);
  if (['taskType', 'organizationPath', 'departmentId', 'departmentName', 'roleId', 'roleName'].includes(key)) return isCorruptedSeedText(existing[key]);
  if (key === 'sortOrder') return Number(existing.sortOrder) !== Number(d1GuideDefaults.find((item) => item.actionKey === actionKey)?.sortOrder);
  if (actionKey === 'join_group') {
    if (key === 'resourceLinks') {
      const value = typeof existing.resourceLinks === 'string' ? existing.resourceLinks.trim() : '';
      return value === '' || value === '[]' || value.startsWith('mock-feishu://');
    }
    if (key === 'applyUrl') {
      const value = typeof existing.applyUrl === 'string' ? existing.applyUrl.trim() : '';
      return isCorruptedSeedText(value) || value.startsWith('mock-feishu://');
    }
    return ['targetGroupName', 'sendToEmployeeName', 'sendToEmployeeContact'].includes(key) && isCorruptedSeedText(existing[key]);
  }
  if (actionKey === 'employee_guide') {
    if (key === 'resourceLinks') return false;
    if (key === 'documentUrl') {
      const value = typeof existing.documentUrl === 'string' ? existing.documentUrl.trim() : '';
      return isCorruptedSeedText(value) || value.startsWith('mock-feishu://');
    }
    return ['documentTitle'].includes(key) && isCorruptedSeedText(existing[key]);
  }
  if (actionKey === 'permission_package' && key === 'routePath') return existing.routePath !== '/permissions';
  return false;
}

export function seedRealFeishuFlowConfig(db: Database): void {
  db.prepare(
    `UPDATE permission_items
     SET applyUrl = '', updatedAt = ?, updatedBy = ?
     WHERE id <> ? AND applyUrl LIKE 'mock-feishu://%'`,
  ).run(seedTime, 'demo-admin', 'perm-chatgpt');
  db.prepare(
    `UPDATE permission_items
     SET applyUrl = ?, updatedAt = ?, updatedBy = ?
     WHERE id = ?
       AND (applyUrl IS NULL OR applyUrl = '' OR applyUrl LIKE 'mock-feishu://%' OR applyUrl = 'approval.haina-ai.com/v1/tools/chatgpt-access')`,
  ).run(realChatgptApprovalUrl, seedTime, 'demo-admin', 'perm-chatgpt');
}

export function seedD1GuideConfig(db: Database): void {
  for (const item of d1GuideDefaults) {
    const existing = db.prepare('SELECT * FROM d1_guide_configs WHERE actionKey = ?').get(item.actionKey) as Record<string, unknown> | undefined;
    if (!existing) {
      insert(db, 'd1_guide_configs', item);
      continue;
    }

    const patch: Record<string, unknown> = {};
    for (const key of Object.keys(item)) {
      if (['actionKey', 'createdAt', 'enabled'].includes(key)) continue;
      if (needsD1FieldRepair(item.actionKey, key, existing)) {
        patch[key] = item[key as keyof typeof item];
      }
    }
    if (Object.keys(patch).length === 0) continue;
    patch.updatedAt = seedTime;
    patch.updatedBy = 'demo-admin';
    const keys = Object.keys(patch);
    db.prepare(`UPDATE d1_guide_configs SET ${keys.map((key) => `${key} = ?`).join(', ')} WHERE actionKey = ?`).run(
      ...keys.map((key) => patch[key] as SQLInputValue),
      item.actionKey,
    );
  }
}

export function seedJoinFeishuOrgTasks(db: Database): void {
  const newcomers = db.prepare('SELECT id, createdAt FROM newcomers ORDER BY createdAt').all() as Array<{ id: string; createdAt?: string }>;
  for (const newcomer of newcomers) {
    const existing = db
      .prepare('SELECT id FROM newcomer_task_states WHERE newcomerId = ? AND taskKey = ?')
      .get(newcomer.id, 'join_feishu_org') as { id: string } | undefined;
    const completedAt = demoFeishuJoinCompletedAt(newcomer.id, newcomer.createdAt ?? seedTime);
    if (existing) {
      if (!['newcomer-yanyu', 'newcomer-cuilingfei'].includes(newcomer.id)) continue;
      db.prepare("UPDATE newcomer_task_states SET status = 'completed', completedAt = ?, updatedAt = ? WHERE id = ?").run(completedAt, seedTime, existing.id);
      continue;
    }
    insert(db, 'newcomer_task_states', {
      id: `task-join-feishu-org-${newcomer.id}`,
      newcomerId: newcomer.id,
      taskKey: 'join_feishu_org',
      taskName: '加入飞书组织群',
      status: 'completed',
      completedAt,
      createdAt: seedTime,
      updatedAt: seedTime,
    });
  }
}

export function seedSubmittedPermissionFollowUps(db: Database): void {
  const pendingRows = db.prepare("SELECT id, lastActionAt, createdAt FROM permission_progress WHERE status = 'pending'").all() as Array<{
    id: string;
    lastActionAt?: string | null;
    createdAt?: string | null;
  }>;
  for (const row of pendingRows) {
    const submittedAt = row.lastActionAt ?? row.createdAt ?? seedTime;
    db.prepare('UPDATE permission_progress SET status = ?, submittedAt = COALESCE(submittedAt, ?), updatedAt = ? WHERE id = ?').run(
      'submitted',
      submittedAt,
      seedTime,
      row.id,
    );
  }

  const submittedRows = db
    .prepare(
      `SELECT pp.id, pp.newcomerId, pp.submittedAt, pp.lastActionAt, pp.createdAt, pi.ownerName
       FROM permission_progress pp
       JOIN permission_items pi ON pi.id = pp.permissionItemId
       WHERE pp.status = 'submitted'
       ORDER BY pp.createdAt`,
    )
    .all() as Array<{
    id: string;
    newcomerId: string;
    submittedAt?: string | null;
    lastActionAt?: string | null;
    createdAt?: string | null;
    ownerName: string;
  }>;

  for (const row of submittedRows) {
    const existing = db.prepare('SELECT id FROM follow_up_tasks WHERE permissionProgressId = ?').get(row.id);
    if (existing) continue;
    const submittedAt = row.submittedAt ?? row.lastActionAt ?? row.createdAt ?? seedTime;
    insert(db, 'follow_up_tasks', {
      id: `follow-up-${row.id}`,
      newcomerId: row.newcomerId,
      permissionProgressId: row.id,
      submittedAt,
      followUpAt: addHours(submittedAt, 4),
      status: 'pending',
      ownerName: row.ownerName,
      createdAt: seedTime,
      updatedAt: seedTime,
    });
  }
}

export function seedWeeklyFeedbackConfig(db: Database): void {
  const questions = [
    {
      id: 'wfq-overall',
      questionKey: 'overall_feeling',
      title: '首周整体感受',
      description: '选择最接近你当前状态的一项。',
      inputType: 'single',
      required: 1,
      maxLength: null,
      sortOrder: 1,
      options: [
        ['overall-adapting', 'adapting', '适应中'],
        ['overall-smooth', 'smooth', '整体顺利'],
        ['overall-pressure', 'pressure', '有些压力'],
      ],
    },
    {
      id: 'wfq-blockers',
      questionKey: 'blockers',
      title: '目前主要卡点（可多选）',
      description: '帮助管理者判断哪里需要支持。',
      inputType: 'multi',
      required: 0,
      maxLength: null,
      sortOrder: 2,
      options: [
        ['blocker-permission', 'permission', '剩余权限开通'],
        ['blocker-background', 'background', '业务背景理解'],
        ['blocker-tools', 'tools', '工具使用'],
        ['blocker-rhythm', 'rhythm', '任务节奏'],
        ['blocker-none', 'none', '暂无明显卡点'],
      ],
    },
    {
      id: 'wfq-support',
      questionKey: 'support_needed',
      title: '希望管理者提供的支持（可多选）',
      description: '选择你希望管理者优先提供的支持。',
      inputType: 'multi',
      required: 0,
      maxLength: null,
      sortOrder: 3,
      options: [
        ['support-permission', 'permission', '帮助跟进权限'],
        ['support-business', 'business', '补充业务介绍'],
        ['support-task', 'task', '安排轻量任务'],
        ['support-priority', 'priority', '明确优先级'],
        ['support-none', 'none', '暂时不需要'],
      ],
    },
    {
      id: 'wfq-message',
      questionKey: 'message',
      title: '新人想说的话',
      description: '必填，最多 500 字。',
      inputType: 'text',
      required: 1,
      maxLength: 500,
      sortOrder: 4,
      options: [],
    },
    {
      id: 'wfq-work-summary',
      questionKey: 'work_summary',
      title: '首周工作摘要',
      description: '记录本周完成的主要事项，供管理者查看和跟进。',
      inputType: 'text',
      required: 1,
      maxLength: 500,
      sortOrder: 5,
      options: [],
    },
  ];

  for (const question of questions) {
    insertIfMissing(db, 'weekly_feedback_questions', 'id', {
      id: question.id,
      questionKey: question.questionKey,
      title: question.title,
      description: question.description,
      inputType: question.inputType,
      required: question.required,
      maxLength: question.maxLength,
      enabled: 1,
      sortOrder: question.sortOrder,
      createdAt: seedTime,
      updatedAt: seedTime,
    });
    question.options.forEach((option, index) => {
      insertIfMissing(db, 'weekly_feedback_options', 'id', {
        id: option[0],
        questionId: question.id,
        optionKey: option[1],
        label: option[2],
        enabled: 1,
        sortOrder: index + 1,
        createdAt: seedTime,
        updatedAt: seedTime,
      });
    });
  }

  const enabled = db.prepare('SELECT COUNT(*) AS total FROM weekly_feedback_questions WHERE enabled = 1').get() as { total: number };
  if (enabled.total === 0) {
    db.prepare("UPDATE weekly_feedback_questions SET enabled = 1, updatedAt = ? WHERE id IN ('wfq-overall', 'wfq-blockers', 'wfq-support', 'wfq-message', 'wfq-work-summary')").run(seedTime);
    db.prepare("UPDATE weekly_feedback_options SET enabled = 1, updatedAt = ? WHERE questionId IN ('wfq-overall', 'wfq-blockers', 'wfq-support')").run(seedTime);
  }

  db.prepare(
    `UPDATE weekly_feedback_questions
     SET required = 1,
         description = CASE
           WHEN id = 'wfq-message' AND description = '选填，最多 500 字。' THEN '必填，最多 500 字。'
           ELSE description
         END,
         updatedAt = ?
     WHERE id IN ('wfq-overall', 'wfq-message', 'wfq-work-summary')
       AND (required <> 1 OR (id = 'wfq-message' AND description = '选填，最多 500 字。'))`,
  ).run(seedTime);
  db.prepare(
    "UPDATE weekly_feedback_questions SET required = 0, updatedAt = ? WHERE id IN ('wfq-blockers', 'wfq-support') AND required <> 0",
  ).run(seedTime);
  db.prepare(
    "UPDATE weekly_feedback_questions SET enabled = 0, updatedAt = ?, updatedBy = 'demo-admin' WHERE id <> 'wfq-work-summary' AND questionKey <> 'work_summary' AND title = '首周工作摘要' AND enabled = 1",
  ).run(seedTime);

  seedDemoWeeklyWorkSummaryAnswer(db);
}

export function seedKnowledgeDocStatusGuard(db: Database): void {
  db.prepare(
    `UPDATE knowledge_base_docs
     SET status = 'disabled', updatedAt = ?, updatedBy = 'demo-admin'
     WHERE status = 'enabled'
       AND (COALESCE(parseStatus, '') <> 'parsed' OR COALESCE(vectorStatus, '') <> 'ready')`,
  ).run(new Date().toISOString());
}

export function seedAnonymousFeedbackConfig(db: Database): void {
  const existing = db.prepare('SELECT COUNT(*) AS total FROM anonymous_feedback_modules').get() as { total: number };
  if (existing.total > 0) return;

  const modules = [
    {
      id: 'afm-knowledge',
      moduleKey: 'knowledge',
      label: '知识问答',
      problemTypes: [
        ['not_found', '没查到答案', 0],
        ['inaccurate', '答案不准确', 0],
        ['too_generic', '答案太泛，不能执行', 0],
        ['missing_source_owner', '来源/Owner缺失', 0],
        ['other', '其他', 1],
      ],
      expectedActions: [
        ['add_answer', '补充答案', 0],
        ['fix_answer', '修正答案', 0],
        ['add_source_owner', '补充来源/Owner', 0],
        ['transfer_content_owner', '转内容Owner核对', 0],
        ['review_only', '仅记录复盘', 0],
      ],
    },
    {
      id: 'afm-d1-guide',
      moduleKey: 'd1_guide',
      label: 'D1引导',
      problemTypes: [
        ['today_unclear', '今日事项不清楚', 0],
        ['order_unreasonable', '顺序不合理', 0],
        ['missing_content', '内容缺失', 0],
        ['process_mismatch', '和实际流程不一致', 0],
        ['other', '其他', 1],
      ],
      expectedActions: [
        ['add_d1_task', '补充D1事项', 0],
        ['adjust_order', '调整事项顺序', 0],
        ['fix_copy', '修正文案说明', 0],
        ['transfer_content_owner', '转内容Owner核对', 0],
        ['review_only', '仅记录复盘', 0],
      ],
    },
    {
      id: 'afm-permission',
      moduleKey: 'permission',
      label: '权限申请',
      problemTypes: [
        ['entry_missing', '不知道从哪里申请', 0],
        ['form_unclear', '不知道怎么填写', 0],
        ['owner_unclear', '审批人/Owner不清楚', 0],
        ['no_response_after_submit', '提交后没人处理', 0],
        ['other', '其他', 1],
      ],
      expectedActions: [
        ['add_entry', '补充申请入口', 0],
        ['fix_template', '修正申请模板', 0],
        ['add_owner', '补充审批人/Owner', 0],
        ['transfer_permission_owner', '转权限Owner核对', 0],
        ['review_only', '仅记录复盘', 0],
      ],
    },
    {
      id: 'afm-follow-up',
      moduleKey: 'follow_up',
      label: '4小时回访',
      problemTypes: [
        ['no_reminder', '没收到提醒', 0],
        ['bad_timing', '提醒时间不合理', 0],
        ['options_insufficient', '回访选项不够用', 0],
        ['suggestion_invalid', '未完成处理建议无效', 0],
        ['other', '其他', 1],
      ],
      expectedActions: [
        ['resend_reminder', '补充提醒触达', 0],
        ['adjust_timing', '调整提醒时间', 0],
        ['add_followup_options', '补充回访选项', 0],
        ['transfer_process_owner', '转流程Owner核对', 0],
        ['review_only', '仅记录复盘', 0],
      ],
    },
  ];

  modules.forEach((module, moduleIndex) => {
    insert(db, 'anonymous_feedback_modules', {
      id: module.id,
      moduleKey: module.moduleKey,
      label: module.label,
      enabled: 1,
      sortOrder: moduleIndex + 1,
      createdAt: seedTime,
      updatedAt: seedTime,
    });
    module.problemTypes.forEach((item, index) => {
      insert(db, 'anonymous_feedback_problem_types', {
        id: `afpt-${module.moduleKey}-${item[0]}`,
        moduleId: module.id,
        typeKey: item[0],
        label: item[1],
        requiresText: item[2],
        enabled: 1,
        sortOrder: index + 1,
        createdAt: seedTime,
        updatedAt: seedTime,
      });
    });
    module.expectedActions.forEach((item, index) => {
      insert(db, 'anonymous_feedback_expected_actions', {
        id: `afea-${module.moduleKey}-${item[0]}`,
        moduleId: module.id,
        actionKey: item[0],
        label: item[1],
        requiresText: item[2],
        enabled: 1,
        sortOrder: index + 1,
        createdAt: seedTime,
        updatedAt: seedTime,
      });
    });
  });
}

export function seedDatabase(db: Database): void {
  db.exec('PRAGMA foreign_keys = OFF;');
  for (const table of tables) {
    db.exec(`DELETE FROM ${table};`);
  }
  db.exec('PRAGMA foreign_keys = ON;');

  insert(db, 'roles', {
    id: 'role-product-intern',
    name: '协同办公产品实习生',
    department: '协同办公部门',
    description: '面向协同办公产品方向实习生的 D1 权限与知识包。',
    createdAt: seedTime,
    updatedAt: seedTime,
  });

  const permissions = [
    {
      id: 'perm-oa',
      name: 'OA 系统',
      category: '办公基础',
      permissionType: 'required',
      sensitive: 0,
      ownerType: 'personal',
      ownerName: '刘长省',
      ownerContact: 'IT 支持群',
      applyEntryName: 'OA 系统权限申请表',
      applyUrl: '',
      reasonTemplate: '新人入职 D1 需要 OA 系统用于查看制度与提交基础流程。',
      approverName: '刘长省（协同办公组）',
      commonWaitingReasons: JSON.stringify(['审批人在会议中', '账号同步存在 10-20 分钟延迟']),
      enabled: 1,
      createdAt: seedTime,
      updatedAt: seedTime,
    },
    {
      id: 'perm-mail',
      name: 'Mail 海底捞邮箱',
      category: '办公基础',
      permissionType: 'required',
      sensitive: 0,
      ownerType: 'group',
      ownerName: 'IT 支持群',
      ownerContact: 'it-help@haina.example',
      applyEntryName: '邮箱账号申请表',
      applyUrl: '',
      reasonTemplate: '新人入职需要邮箱接收会议、文档和系统通知。',
      approverName: 'IT 服务台',
      commonWaitingReasons: JSON.stringify(['邮箱账号创建排队中', '需要确认手机号绑定']),
      enabled: 1,
      createdAt: seedTime,
      updatedAt: seedTime,
    },
    {
      id: 'perm-bpm',
      name: 'BPM 系统',
      category: '流程工具',
      permissionType: 'optional',
      sensitive: 0,
      ownerType: 'personal',
      ownerName: 'BPM Owner',
      ownerContact: 'bpm-owner@haina.example',
      applyEntryName: 'BPM 系统申请入口',
      applyUrl: '',
      reasonTemplate: '产品实习生需要查看流程样例并跟进试点需求。',
      approverName: '流程平台 Owner',
      commonWaitingReasons: JSON.stringify(['Owner 需确认项目参与范围']),
      enabled: 1,
      createdAt: seedTime,
      updatedAt: seedTime,
    },
    {
      id: 'perm-chatgpt',
      name: 'ChatGPT 账号',
      category: 'AI 工具',
      permissionType: 'optional',
      sensitive: 0,
      ownerType: 'personal',
      ownerName: '刘长省',
      ownerContact: 'IT 支持群',
      applyEntryName: 'ChatGPT 账号申请表',
      applyUrl: realChatgptApprovalUrl,
      reasonTemplate: '本人为协同办公组新入职产品实习生，需申请 ChatGPT 账号用于 PRD 编写、资料整理、测试用例生成，提升办公效率。',
      approverName: '刘长省（协同办公组）',
      commonWaitingReasons: JSON.stringify(['需确认业务用途', '许可证名额每周统一处理']),
      enabled: 1,
      createdAt: seedTime,
      updatedAt: seedTime,
    },
    {
      id: 'perm-qoderwork',
      name: 'QoderWork 账号',
      category: '研发协作',
      permissionType: 'optional',
      sensitive: 0,
      ownerType: 'personal',
      ownerName: 'QoderWork 对接人',
      ownerContact: 'qoderwork-owner@haina.example',
      applyEntryName: 'QoderWork 空间权限申请',
      applyUrl: '',
      reasonTemplate: '用于查看 H5 原型任务、需求文档和技术方案。',
      approverName: '研发协作平台 Owner',
      commonWaitingReasons: JSON.stringify(['项目空间管理员需拉入成员']),
      enabled: 1,
      createdAt: seedTime,
      updatedAt: seedTime,
    },
  ];

  for (const permission of permissions) {
    insert(db, 'permission_items', permission);
  }

  permissions.forEach((permission, index) => {
    insert(db, 'role_permission_items', {
      id: `rpi-${permission.id}`,
      roleId: 'role-product-intern',
      permissionItemId: permission.id,
      sortOrder: index + 1,
      createdAt: seedTime,
      updatedAt: seedTime,
    });
  });

  const newcomers = [
    {
      id: 'newcomer-yanyu',
      name: '燕余',
      roleId: 'role-product-intern',
      department: '协同办公部门',
      stage: 'D7',
      managerName: '刘长省',
      mentorName: '刘长省',
      status: 'onboarding',
      d1GuideCompleted: 0,
      permissionPackageViewed: 1,
      weeklyFeedbackSubmitted: 1,
      managerViewedFeedback: 1,
      createdAt: seedTime,
      updatedAt: seedTime,
    },
    {
      id: 'newcomer-cuilingfei',
      name: '崔令飞',
      roleId: 'role-product-intern',
      department: '协同办公部门',
      stage: 'W1',
      managerName: '刘长省',
      mentorName: '刘长省',
      status: 'onboarding',
      d1GuideCompleted: 1,
      permissionPackageViewed: 1,
      weeklyFeedbackSubmitted: 0,
      managerViewedFeedback: 0,
      createdAt: seedTime,
      updatedAt: seedTime,
    },
  ];

  for (const newcomer of newcomers) {
    insert(db, 'newcomers', newcomer);
    insert(db, 'newcomer_task_states', {
      id: `task-d1-${newcomer.id}`,
      newcomerId: newcomer.id,
      taskKey: 'd1_guide',
      taskName: 'D1 到达引导包',
      status: newcomer.d1GuideCompleted ? 'completed' : 'pending',
      completedAt: newcomer.d1GuideCompleted ? '2026-06-24T03:30:00.000Z' : null,
      createdAt: seedTime,
      updatedAt: seedTime,
    });
  }

  seedJoinFeishuOrgTasks(db);
  seedSubmittedPermissionFollowUps(db);
  seedD1GuideConfig(db);
  seedWeeklyFeedbackConfig(db);
  seedAnonymousFeedbackConfig(db);

  insert(db, 'permission_progress', {
    id: 'progress-yanyu-oa',
    newcomerId: 'newcomer-yanyu',
    permissionItemId: 'perm-oa',
    status: 'submitted',
    submittedAt: '2026-06-24T02:00:00.000Z',
    completedAt: null,
    lastActionAt: '2026-06-24T02:00:00.000Z',
    createdAt: seedTime,
    updatedAt: seedTime,
  });

  insert(db, 'follow_up_tasks', {
    id: 'follow-up-yanyu-oa',
    newcomerId: 'newcomer-yanyu',
    permissionProgressId: 'progress-yanyu-oa',
    submittedAt: '2026-06-24T02:00:00.000Z',
    followUpAt: '2026-06-24T06:00:00.000Z',
    status: 'pending',
    ownerName: '王敏',
    createdAt: seedTime,
    updatedAt: seedTime,
  });

  insert(db, 'anonymous_feedbacks', {
    id: 'anon-001',
    feedbackNo: 'AF-20260624-001',
    type: '流程建议',
    module: 'D1 到达引导',
    description: '权限申请卡片里可以提前说明审批等待原因。',
    expectedAction: '补充常见等待说明',
    isAnonymous: 1,
    contactName: null,
    contactInfo: null,
    submittedByNewcomerId: 'newcomer-yanyu',
    submittedAt: '2026-06-24T04:00:00.000Z',
    ownerName: '产品运营',
    status: 'open',
    result: '待纳入复盘',
    includedInReview: 1,
    createdAt: seedTime,
    updatedAt: seedTime,
  });

  insert(db, 'weekly_feedbacks', {
    id: 'weekly-yanyu',
    newcomerId: 'newcomer-yanyu',
    overallFeeling: '整体清晰，权限等待有一点不确定',
    blockers: 'OA 已提交，邮箱还在等待开通',
    supportNeeded: '希望 mentor 帮忙确认邮箱进度',
    message: '第一周对业务和工具链有基本理解，感谢团队支持。',
    workSummary: '完成 D1 到达引导，查看岗位权限包，并提交首周反馈。',
    visibleToManager: 1,
    lifecycle: 'submitted',
    submittedAt: '2026-06-24T05:00:00.000Z',
    createdAt: seedTime,
    updatedAt: seedTime,
  });

  insert(db, 'manager_feedback_actions', {
    id: 'manager-action-yanyu',
    weeklyFeedbackId: 'weekly-yanyu',
    managerName: '刘长省',
    managerViewed: 1,
    managerViewedAt: '2026-06-24T05:30:00.000Z',
    managerActionStatus: 'pending_follow_up',
    actionNote: '已看到反馈，待确认邮箱权限',
    createdAt: seedTime,
    updatedAt: seedTime,
  });

  const docs = [
    ['kb-001', 'D1 到达引导清单', '入职流程', '协同办公产品实习生', 'D1', 'mock-drive://d1-guide', 'HRBP', 'enabled', 'parsed', 'ready'],
    ['kb-002', '协同办公产品常用系统说明', '系统权限', '协同办公产品实习生', 'D1-D3', 'mock-drive://systems', '产品运营', 'enabled', 'parsed', 'ready'],
    ['kb-003', '首周反馈填写说明', '反馈机制', '协同办公产品实习生', 'W1', 'mock-drive://weekly-feedback', '组织发展', 'enabled', 'parsed', 'ready'],
  ];

  docs.forEach((doc, index) => {
    insert(db, 'knowledge_base_docs', {
      id: doc[0],
      title: doc[1],
      category: doc[2],
      applicableRoleId: 'role-product-intern',
      applicableRole: doc[3],
      applicableStage: doc[4],
      sourceUrl: doc[5],
      fileSize: 0,
      fileHash: `mock-md5-${doc[0]}`,
      filePath: `mock-file://${doc[0]}.pdf`,
      ownerName: doc[6],
      status: doc[7],
      parseStatus: doc[8],
      vectorStatus: doc[9],
      hitCount: 8 - index * 2,
      updatedAt: seedTime,
      createdAt: seedTime,
    });
  });
}
