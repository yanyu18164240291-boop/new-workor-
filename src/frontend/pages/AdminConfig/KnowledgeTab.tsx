import { useMemo, useState } from 'react';
import { Upload } from 'lucide-react';

import { DataTable, type DataTableColumn } from '../../components/admin-config/DataTable.tsx';
import { StatusTag } from '../../components/admin-config/StatusTag.tsx';
import { UploadKnowledgeModal, type KnowledgeUploadDraft } from '../../components/admin-config/UploadKnowledgeModal.tsx';
import { formatApiErrorMessage, type KnowledgeDoc } from '../../api.ts';
import type { DashboardData } from '../../dashboardData.ts';
import { uploadKnowledgeMetadata } from '../../services/adminConfigApi.ts';
import type { AdminConfigFilters } from '../../types/adminConfig.ts';

type KnowledgeTabProps = {
  data: DashboardData;
  filters: AdminConfigFilters;
  toast: (message: string) => void;
  reload: () => Promise<void>;
};

function validateDraft(draft: KnowledgeUploadDraft): string {
  const requiredFields: Array<[string, string]> = [
    ['文档名称', draft.title],
    ['知识分类', draft.category],
    ['适用岗位', draft.applicableRole],
    ['适用阶段', draft.applicableStage],
    ['Owner', draft.ownerName],
  ];
  const missing = requiredFields.find(([, value]) => !value.trim());
  if (missing) return `${missing[0]}不能为空`;
  if (draft.sourceUrl && !draft.sourceUrl.startsWith('mock-drive://')) return '来源链接必须保持 mock-drive:// 模拟地址';
  return '';
}

function statusTone(status: string): 'success' | 'warning' | 'neutral' {
  if (status.includes('parsed') || status.includes('vectorized') || status === 'enabled') return 'success';
  if (status.includes('pending') || status.includes('simulated')) return 'warning';
  return 'neutral';
}

export function KnowledgeTab({ data, filters, toast, reload }: KnowledgeTabProps) {
  const docs = data.knowledgeDocs ?? [];
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fieldError, setFieldError] = useState('');

  const filteredDocs = useMemo(() => {
    const keyword = filters.keyword.trim().toLowerCase();
    return docs.filter((doc) => {
      const matchesKeyword =
        !keyword ||
        [doc.title, doc.category, doc.applicableRole, doc.applicableStage, doc.ownerName, doc.sourceUrl ?? '']
          .join(' ')
          .toLowerCase()
          .includes(keyword);
      const matchesStatus =
        filters.status === '全部状态' ||
        (filters.status === '启用' && doc.status === 'enabled') ||
        (filters.status === '停用' && doc.status !== 'enabled') ||
        !['启用', '停用'].includes(filters.status);
      return matchesKeyword && matchesStatus;
    });
  }, [docs, filters.keyword, filters.status]);

  async function submitUpload(draft: KnowledgeUploadDraft) {
    const validation = validateDraft(draft);
    if (validation) {
      setFieldError(validation);
      return;
    }
    setSaving(true);
    setFieldError('');
    try {
      await uploadKnowledgeMetadata({
        title: draft.title.trim(),
        category: draft.category.trim(),
        applicableRole: draft.applicableRole.trim(),
        applicableStage: draft.applicableStage.trim(),
        ownerName: draft.ownerName.trim(),
        sourceUrl: draft.sourceUrl.trim() || 'mock-drive://admin-upload',
      });
      toast('已保存知识库资料元数据，解析和向量化仍为模拟状态');
      setModalOpen(false);
      await reload();
    } catch (error) {
      setFieldError(formatApiErrorMessage(error, '保存失败，请检查字段'));
    } finally {
      setSaving(false);
    }
  }

  const columns: Array<DataTableColumn<KnowledgeDoc>> = [
    { key: 'title', title: '文档名称', render: (doc) => <strong>{doc.title}</strong> },
    { key: 'category', title: '知识分类', render: (doc) => doc.category },
    { key: 'role', title: '适用岗位', render: (doc) => doc.applicableRole },
    { key: 'stage', title: '适用阶段', render: (doc) => doc.applicableStage },
    { key: 'owner', title: 'Owner', render: (doc) => doc.ownerName },
    { key: 'status', title: '状态', render: (doc) => <StatusTag tone={statusTone(doc.status)}>{doc.status}</StatusTag> },
    { key: 'parseStatus', title: '解析状态', render: (doc) => <StatusTag tone={statusTone(doc.parseStatus)}>{doc.parseStatus}</StatusTag> },
    { key: 'vectorStatus', title: '向量化状态', render: (doc) => <StatusTag tone={statusTone(doc.vectorStatus)}>{doc.vectorStatus}</StatusTag> },
    { key: 'hitCount', title: '命中次数', render: (doc) => doc.hitCount },
    { key: 'updatedBy', title: 'updatedBy', render: (doc) => doc.updatedBy ?? 'demo-admin' },
    { key: 'updatedAt', title: 'updatedAt', render: (doc) => doc.updatedAt ?? '-' },
    {
      key: 'ops',
      title: '操作',
      render: () => <span className="admin-muted-line">元数据展示</span>,
    },
  ];

  return (
    <div className="admin-workbench-panel">
      <div className="admin-page-title">
        <span>Page 08</span>
        <h1>知识库管理</h1>
        <p>管理协同办公部门知识库资料元数据；文档解析、向量化、RAG 仍为模拟状态。</p>
      </div>

      <div className="admin-metric-grid admin-metric-grid-three">
        <div className="admin-card">
          <h2>知识库资料数</h2>
          <strong className="admin-large-number">{docs.length}</strong>
          <p>复盘页读取该元数据统计</p>
        </div>
        <div className="admin-card">
          <h2>模拟解析中</h2>
          <strong className="admin-large-number">{docs.filter((doc) => doc.parseStatus.includes('simulated')).length}</strong>
          <p>不接真实解析服务</p>
        </div>
        <div className="admin-card">
          <h2>模拟向量化</h2>
          <strong className="admin-large-number">{docs.filter((doc) => doc.vectorStatus.includes('simulated')).length}</strong>
          <p>不接真实向量库</p>
        </div>
      </div>

      <section className="admin-card">
        <div className="admin-section-heading">
          <div>
            <h2>知识库资料列表</h2>
            <p className="admin-muted-line">仅维护元数据，保存后刷新仍保留。</p>
          </div>
          <button className="admin-primary-action" type="button" onClick={() => setModalOpen(true)}>
            <Upload size={16} />
            上传知识库资料
          </button>
        </div>
        <DataTable columns={columns} rows={filteredDocs} getRowKey={(doc) => doc.id} emptyText="暂无知识库资料" />
      </section>

      <UploadKnowledgeModal open={modalOpen} saving={saving} error={fieldError} onClose={() => setModalOpen(false)} onSubmit={submitUpload} />
    </div>
  );
}
