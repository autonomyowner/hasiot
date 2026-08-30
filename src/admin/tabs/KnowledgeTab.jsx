import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import KnowledgeForm from './KnowledgeForm'
import { useConfirm } from '../components/ConfirmDialog'
import { useToast } from '../components/toast-context'
import { EmptyState, LoadingState } from '../components/States'
import { KNOWLEDGE_CATEGORIES, KNOWLEDGE_CATEGORY_LABELS, cityLabel, formatDate } from '../constants'

/** The knowledge base behind the AI travel planner. */
export default function KnowledgeTab() {
  const [category, setCategory] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [busyId, setBusyId] = useState(null)

  const entries = useQuery(api.admin.queries.listKnowledgeData, {
    category: category || undefined,
  })
  const createEntry = useMutation(api.admin.mutations.createKnowledgeData)
  const updateEntry = useMutation(api.admin.mutations.updateKnowledgeData)
  const deleteEntry = useMutation(api.admin.mutations.deleteKnowledgeData)

  const toast = useToast()
  const { confirm, confirmDialog } = useConfirm()

  const handleSubmit = async (data) => {
    try {
      if (editing) {
        await updateEntry({ id: editing._id, ...data })
        toast.success('تم حفظ التعديلات')
      } else {
        await createEntry(data)
        toast.success('تمت إضافة المعلومة')
      }
      setShowForm(false)
      setEditing(null)
    } catch (error) {
      toast.error(error)
      throw error
    }
  }

  const handleDelete = async (entry) => {
    const ok = await confirm({
      title: 'حذف هذه المعلومة؟',
      message: `"${entry.title_ar || entry.title}" لن يستخدمها مساعد السفر بعد الآن.`,
      confirmLabel: 'حذف',
      destructive: true,
    })
    if (!ok) return

    setBusyId(entry._id)
    try {
      await deleteEntry({ id: entry._id })
      toast.success('تم الحذف')
    } catch (error) {
      toast.error(error)
    } finally {
      setBusyId(null)
    }
  }

  const toggleActive = async (entry) => {
    setBusyId(entry._id)
    try {
      await updateEntry({ id: entry._id, isActive: !entry.isActive })
      toast.success(entry.isActive ? 'تم التعطيل' : 'تم التفعيل')
    } catch (error) {
      toast.error(error)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="admin-card-header">
        <div>
          <h2 className="admin-page-title" style={{ margin: 0 }}>قاعدة المعرفة السياحية</h2>
          <p className="admin-page-subtitle">
            {entries === undefined ? 'جاري التحميل...' : `${entries.length} معلومة`}
          </p>
        </div>
        <button
          onClick={() => { setEditing(null); setShowForm(true) }}
          className="admin-btn admin-btn-primary"
        >
          إضافة معلومة
        </button>
      </div>

      <div className="admin-info-box">
        <p>
          هذه المعلومات يقرأها مساعد السفر بالذكاء الاصطناعي عند إعداد خطط الرحلات.
          كلما كانت أدق وأحدث، كانت اقتراحات المساعد أقرب للواقع. المعلومة غير النشطة
          لا تُستخدم في الإجابات.
        </p>
      </div>

      <div className="admin-filters">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="admin-form-select"
        >
          <option value="">كل الفئات</option>
          {KNOWLEDGE_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </div>

      {entries === undefined ? (
        <LoadingState />
      ) : entries.length === 0 ? (
        <EmptyState
          title={category ? 'لا توجد معلومات في هذه الفئة' : 'قاعدة المعرفة فارغة'}
          hint="أضف معلومات عن الأحساء — الوجهات، المواصلات، العادات، أوقات الزيارة — ليستخدمها مساعد السفر."
          action={
            <button className="admin-btn admin-btn-primary" onClick={() => { setEditing(null); setShowForm(true) }}>
              إضافة أول معلومة
            </button>
          }
        />
      ) : (
        <div className="admin-list">
          {entries.map((entry) => (
            <div key={entry._id} className="admin-list-item">
              <div className="admin-list-item-header">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="admin-list-item-badges">
                    <span className={`admin-badge ${entry.isActive ? 'green' : 'gray'}`}>
                      {entry.isActive ? 'نشط' : 'غير نشط'}
                    </span>
                    <span className="admin-badge blue">
                      {KNOWLEDGE_CATEGORY_LABELS[entry.category] || entry.category}
                    </span>
                    {entry.metadata?.region && (
                      <span className="admin-badge gray">{cityLabel(entry.metadata.region)}</span>
                    )}
                  </div>
                  <h3 className="admin-list-item-title">{entry.title_ar || entry.title}</h3>
                  {entry.title && entry.title !== entry.title_ar && (
                    <p className="admin-list-item-subtitle" dir="ltr">{entry.title}</p>
                  )}
                  <p className="admin-list-item-content">{entry.content_ar || entry.content}</p>
                  {entry.keywords?.length > 0 && (
                    <div className="admin-list-item-keywords">
                      {entry.keywords.map((kw) => (
                        <span key={kw} className="admin-keyword">{kw}</span>
                      ))}
                    </div>
                  )}
                  <p className="admin-table-sub">آخر تحديث: {formatDate(entry.updatedAt)}</p>
                </div>
                <div className="admin-actions admin-list-item-actions">
                  <button
                    onClick={() => { setEditing(entry); setShowForm(true) }}
                    className="admin-action-btn edit"
                  >
                    تعديل
                  </button>
                  <button
                    onClick={() => toggleActive(entry)}
                    className="admin-action-btn"
                    disabled={busyId === entry._id}
                  >
                    {entry.isActive ? 'تعطيل' : 'تفعيل'}
                  </button>
                  <button
                    onClick={() => handleDelete(entry)}
                    className="admin-action-btn delete"
                    disabled={busyId === entry._id}
                  >
                    حذف
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {showForm && (
          <KnowledgeForm
            key={editing?._id || 'new'}
            initialData={editing}
            onSubmit={handleSubmit}
            onClose={() => { setShowForm(false); setEditing(null) }}
          />
        )}
      </AnimatePresence>

      {confirmDialog}
    </motion.div>
  )
}
