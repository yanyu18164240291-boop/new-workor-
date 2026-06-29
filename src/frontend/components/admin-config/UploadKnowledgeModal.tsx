import { useState } from 'react';
import { X } from 'lucide-react';

import { FieldError } from './FieldError.tsx';

export type KnowledgeUploadDraft = {
  title: string;
  category: string;
  applicableRole: string;
  applicableStage: string;
  ownerName: string;
  sourceUrl: string;
};

type UploadKnowledgeModalProps = {
  open: boolean;
  saving: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (draft: KnowledgeUploadDraft) => Promise<void>;
};

const initialDraft: KnowledgeUploadDraft = {
  title: '',
  category: '入职知识',
  applicableRole: '协同办公产品实习生',
  applicableStage: 'D1',
  ownerName: '',
  sourceUrl: 'mock-drive://admin-upload',
};

export function UploadKnowledgeModal({ open, saving, error, onClose, onSubmit }: UploadKnowledgeModalProps) {
  const [draft, setDraft] = useState<KnowledgeUploadDraft>(initialDraft);

  if (!open) return null;

  function patchDraft(patch: Partial<KnowledgeUploadDraft>) {
    setDraft((current) => ({ ...current, ...patch }));
  }

  return (
    <div className="admin-modal-backdrop" role="presentation">
      <section className="admin-modal" aria-label="知识库上传窗口">
        <div className="admin-modal-head">
          <h2>知识库上传窗口</h2>
          <button type="button" onClick={onClose} aria-label="关闭上传窗口">
            <X size={18} />
          </button>
        </div>
        <div className="admin-drawer-form">
          <FieldError message={error} />
          <label>
            文件选择 mock
            <input value="mock-file://selected-admin-doc.pdf" readOnly />
          </label>
          <label>
            文档名称 <b>*</b>
            <input value={draft.title} onChange={(event) => patchDraft({ title: event.target.value })} />
          </label>
          <label>
            知识分类 <b>*</b>
            <input value={draft.category} onChange={(event) => patchDraft({ category: event.target.value })} />
          </label>
          <label>
            适用岗位 <b>*</b>
            <input value={draft.applicableRole} onChange={(event) => patchDraft({ applicableRole: event.target.value })} />
          </label>
          <label>
            适用阶段 <b>*</b>
            <input value={draft.applicableStage} onChange={(event) => patchDraft({ applicableStage: event.target.value })} />
          </label>
          <label>
            Owner <b>*</b>
            <input value={draft.ownerName} onChange={(event) => patchDraft({ ownerName: event.target.value })} />
          </label>
          <label>
            来源链接
            <input value={draft.sourceUrl} onChange={(event) => patchDraft({ sourceUrl: event.target.value })} />
          </label>
          <p className="admin-muted-line">点击开始上传时只保存知识库资料元数据，解析和向量化仍为模拟状态。</p>
        </div>
        <div className="admin-modal-footer">
          <button className="admin-secondary-action" type="button" onClick={onClose}>
            取消
          </button>
          <button className="admin-primary-action" type="button" disabled={saving} onClick={() => void onSubmit(draft)}>
            开始上传
          </button>
        </div>
      </section>
    </div>
  );
}
