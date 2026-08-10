import React, { useMemo, useState } from 'react'
import { FolderPlus, Files, Trash2, X, FileText } from 'lucide-react'
import { useI18n } from '../../i18n/I18nProvider'
import { listProjectPages, createProjectPage, deleteProjectPage } from '../../storage/projectPagesStorage'

// 总览页上的两个按钮：创建项目页面 / 项目页面管理
// 创建/删除后通过回调通知父组件刷新侧边栏；创建成功会把新页面 id 回传，父组件负责跳转。
export function ProjectPageEntryButtons({ onCreated, onChanged }) {
  const { t } = useI18n()
  const [modal, setModal] = useState(null) // 'create' | 'manage' | null
  return <>
    <div className="hero-create-row">
      <button className="primary hero-create-btn" onClick={() => setModal('create')}><FolderPlus size={18}/>{t('projectPages.entryCreate')}</button>
      <p className="hero-create-desc">本产品的核心功能，让你把黑盒的后台变成可视化图形界面，内置强大的wiki记忆索引系统，让你的每个决策，每个代码改动、项目方向，哪怕频繁新建对话窗口，AI也都可以清楚记得，完整追溯。</p>
    </div>
    <div className="hero-manage-row">
      <button className="secondary" onClick={() => setModal('manage')}><Files size={16}/>{t('projectPages.entryManage')}</button>
    </div>
    {modal === 'create' && <CreateProjectPageModal
      onClose={() => setModal(null)}
      onCreated={(page) => { onCreated && onCreated(page); setModal(null) }}
    />}
    {modal === 'manage' && <ManageProjectPagesModal
      onClose={() => setModal(null)}
      onChanged={() => onChanged && onChanged()}
    />}
  </>
}

function ModalShell({ title, onClose, children }) {
  return <div className="modal-backdrop" onMouseDown={onClose}>
    <div className="modal" onMouseDown={e => e.stopPropagation()}>
      <div className="modal-head">
        <h3>{title}</h3>
        <button className="icon-btn" onClick={onClose} aria-label="close"><X size={17}/></button>
      </div>
      <div className="modal-body">{children}</div>
    </div>
  </div>
}

function CreateProjectPageModal({ onClose, onCreated }) {
  const { t } = useI18n()
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [err, setErr] = useState('')
  const submit = () => {
    const finalName = name.trim() || t('projectPages.defaultName')
    const exists = listProjectPages().some(p => p.name === finalName)
    if (exists) { setErr(t('projectPages.nameExists')); return }
    const page = createProjectPage({ name: finalName, description: desc })
    onCreated && onCreated(page)
  }
  return <ModalShell title={t('projectPages.createTitle')} onClose={onClose}>
    <div className="form-row">
      <label>{t('projectPages.fieldName')}</label>
      <input autoFocus value={name} onChange={e => { setName(e.target.value); setErr('') }}
        placeholder={t('projectPages.namePlaceholder')} onKeyDown={e => e.key === 'Enter' && submit()}/>
    </div>
    <div className="form-row">
      <label>{t('projectPages.fieldDesc')}</label>
      <textarea rows={3} value={desc} onChange={e => setDesc(e.target.value)}
        placeholder={t('projectPages.descPlaceholder')}/>
    </div>
    {err && <div className="error-note">{err}</div>}
    <div className="modal-foot">
      <button className="secondary" onClick={onClose}>{t('projectPages.cancel')}</button>
      <button className="primary" onClick={submit}>{t('projectPages.confirmCreate')}</button>
    </div>
  </ModalShell>
}

function ManageProjectPagesModal({ onClose, onChanged }) {
  const { t } = useI18n()
  const [pages, setPages] = useState(() => listProjectPages())
  const [confirmId, setConfirmId] = useState(null)

  const refresh = () => setPages(listProjectPages())
  const remove = (id) => {
    deleteProjectPage(id)
    setConfirmId(null)
    refresh()
    onChanged && onChanged()
  }

  const confirmTarget = useMemo(() => pages.find(p => p.id === confirmId), [pages, confirmId])

  return <ModalShell title={t('projectPages.manageTitle')} onClose={onClose}>
    {pages.length === 0
      ? <div className="empty-state compact">
          <FileText size={20}/>
          <b>{t('projectPages.emptyTitle')}</b>
          <span>{t('projectPages.emptyDesc')}</span>
        </div>
      : <ul className="project-page-list">
          {pages.map(p => (
            <li key={p.id}>
              <div className="pp-info">
                <b>{p.name}</b>
                <small>{p.description || t('projectPages.noDesc')} · {new Date(p.createdAt).toLocaleString()}</small>
              </div>
              <button className="icon-btn danger" onClick={() => setConfirmId(p.id)} title={t('projectPages.delete')}><Trash2 size={16}/></button>
            </li>
          ))}
        </ul>}
    {confirmTarget && <div className="confirm-dialog">
      <div className="confirm-dialog-box">
        <b>{t('projectPages.confirmDeleteTitle')}</b>
        <span>{t('projectPages.confirmDeleteDesc', { name: confirmTarget.name })}</span>
        <div className="modal-foot">
          <button className="secondary" onClick={() => setConfirmId(null)}>{t('projectPages.cancel')}</button>
          <button className="primary danger" onClick={() => remove(confirmTarget.id)}>{t('projectPages.confirmDeleteBtn')}</button>
        </div>
      </div>
    </div>}
  </ModalShell>
}
