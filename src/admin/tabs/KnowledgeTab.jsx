import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useMutation, useQueries, useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import KnowledgeForm from './KnowledgeForm'
import { useConfirm } from '../components/ConfirmDialog'
import { useToast } from '../components/toast-context'
import { EmptyState, LoadingState } from '../components/States'
import FilterSelect from '../components/FilterSelect'
import { KNOWLEDGE_CATEGORIES, KNOWLEDGE_CATEGORY_LABELS, cityLabel, formatDate } from '../constants'

// listKnowledgeData returns at most this many, newest first, whatever limit
// it is asked for (MAX_LIST in convex/admin/queries.ts).
const SERVER_CAP = 200

// Module-level on purpose: `api.x.y` is a new object on every access, and
// useQueries below is memoised on the request object it is given.
const LIST_KNOWLEDGE = api.admin.queries.listKnowledgeData

/**
 * The knowledge base behind the AI travel planner.
 *
 * The list query stops at the newest 200 and has no pages, so past that the
 * rest of the base was out of reach. «تحميل المزيد» asks for each category
 * separately — the category index gives each its own newest 200 — and merges
 * them, which reaches up to 200 per category with the backend as it is. Every
 * entry the panel can create has one of these categories.
 */
export default function KnowledgeTab() {
  const [category, setCategory] = useState('')
  const [expanded, setExpanded] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [busyId, setBusyId] = useState(null)

  const entries = useQuery(api.admin.queries.listKnowledgeData, {
    category: category || undefined,
  })
  const createEntry = useMutation(api.admin.mutations.createKnowledgeData)
  const updateEntry = useMutation(api.admin.mutations.updateKnowledgeData)
  const deleteEntry = useMutation(api.admin.mutations.deleteKnowledgeData)

  const byCategory = useQueries(
    useMemo(
      () => (expanded && !category
        ? Object.fromEntries(
            KNOWLEDGE_CATEGORIES.map((c) => [c.value, { query: LIST_KNOWLEDGE, args: { category: c.value } }])
          )
        : {}),
      [expanded, category]
    )
  )

  const toast = useToast()
  const { confirm, confirmDialog } = useConfirm()

  const perCategory = Object.values(byCategory)
  const expanding = expanded && !category
  const stillLoading = expanding && perCategory.some((value) => value === undefined)
  const someFailed = expanding && perCategory.some((value) => value instanceof Error)
  const someCapped = expanding && perCategory.some((value) => Array.isArray(value) && value.length >= SERVER_CAP)

  // The newest 200 first, then whatever the per-category lists add, newest
  // first overall; an entry in both appears once.
  const list = useMemo(() => {
    if (!entries) return entries
    if (!expanding) return entries
    const merged = new Map(entries.map((entry) => [entry._id, entry]))
    for (const value of Object.values(byCategory)) {
      if (Array.isArray(value)) for (const entry of value) merged.set(entry._id, entry)
    }
    return [...merged.values()].sort((a, b) => b._creationTime - a._creationTime)
  }, [entries, expanding, byCategory])

  const capped = entries?.length >= SERVER_CAP
  const canExpand = !category && !expanded && capped

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

  const changeCategory = (value) => {
    setCategory(value)
    setExpanded(false)
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="admin-card-header">
        <div>
          <h2 className="admin-page-title">قاعدة المعرفة السياحية</h2>
          <p className="admin-page-subtitle">
            {list === undefined
              ? 'جاري التحميل...'
              : `${list.length} معلومة${canExpand ? ' — هناك المزيد' : ''}`}
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
        <FilterSelect
          value={category}
          onChange={changeCategory}
          placeholder="كل الفئات"
          options={[
            { value: '', label: 'كل الفئات' },
            ...KNOWLEDGE_CATEGORIES,
          ]}
        />
      </div>

      {list === undefined ? (
        <LoadingState />
      ) : list.length === 0 ? (
        <EmptyState
          title={category ? 'لا توجد معلومات في هذه الفئة' : 'قاعدة المعرفة فارغة'}
          hint="أضف معلومات عن مدن المنطقة الشرقية — الوجهات، المواصلات، العادات، أوقات الزيارة — ليستخدمها مساعد السفر."
          action={
            <button className="admin-btn admin-btn-primary" onClick={() => { setEditing(null); setShowForm(true) }}>
              إضافة أول معلومة
            </button>
          }
        />
      ) : (
        <>
          <div className="admin-list">
            {list.map((entry) => (
              <div key={entry._id} className="admin-list-item">
                <div className="admin-list-item-header">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="admin-list-item-badges">
                      <span className={`admin-badge ${entry.isActive ? 'green' : 'gray'}`}>
                        {entry.isActive ? 'نشط' : 'غير نشط'}
                      </span>
                      <span className="admin-badge blue">
                        {KNOWLEDGE_CATEGORY_LABELS[entry.category] || 'أخرى'}
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

          {canExpand && (
            <div className="admin-load-more">
              <button type="button" className="admin-btn admin-btn-secondary" onClick={() => setExpanded(true)}>
                تحميل المزيد
              </button>
            </div>
          )}
          {stillLoading && <LoadingState />}
          {someFailed && (
            <p className="admin-inline-hint">تعذّر تحميل بعض الفئات؛ أعد المحاولة لاحقًا.</p>
          )}
          {someCapped && (
            <p className="admin-inline-hint">
              بعض الفئات تتجاوز {SERVER_CAP} معلومة، فتُعرض أحدث {SERVER_CAP} من كل فئة.
            </p>
          )}
          {category && capped && (
            <p className="admin-inline-hint">تُعرض أحدث {SERVER_CAP} معلومة في هذه الفئة.</p>
          )}
        </>
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
