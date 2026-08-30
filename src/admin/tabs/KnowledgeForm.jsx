import { useState } from 'react'
import Modal from '../components/Modal'
import FilterSelect from '../components/FilterSelect'
import { CITIES, CITY_LABELS, KNOWLEDGE_CATEGORIES } from '../constants'

/**
 * An entry in the knowledge base the AI travel planner reads.
 *
 * The city dropdown writes `metadata.region`. It used to write
 * `metadata.relatedCity`, which is not in the validator, so Convex rejected
 * every save made with a city selected.
 */
export default function KnowledgeForm({ initialData, onSubmit, onClose }) {
  const [form, setForm] = useState({
    category: initialData?.category || 'destinations',
    title: initialData?.title || '',
    title_ar: initialData?.title_ar || '',
    content: initialData?.content || '',
    content_ar: initialData?.content_ar || '',
    keywords: initialData?.keywords?.join('، ') || '',
    source: initialData?.metadata?.source || '',
    region: initialData?.metadata?.region || '',
    isActive: initialData?.isActive !== false,
  })
  const [saving, setSaving] = useState(false)

  const set = (patch) => setForm((prev) => ({ ...prev, ...patch }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (saving) return
    setSaving(true)

    // Both the Arabic and the Latin comma are accepted: the operator types on an
    // Arabic keyboard and would otherwise produce one very long keyword.
    const keywords = form.keywords
      .split(/[,،]/)
      .map((k) => k.trim())
      .filter(Boolean)

    try {
      await onSubmit({
        category: form.category,
        // `title` and `content` are required by the schema, so the Arabic value
        // stands in when only Arabic was filled.
        title: form.title.trim() || form.title_ar.trim(),
        title_ar: form.title_ar.trim() || undefined,
        content: form.content.trim() || form.content_ar.trim(),
        content_ar: form.content_ar.trim() || undefined,
        keywords: keywords.length > 0 ? keywords : undefined,
        metadata: (form.source || form.region)
          ? {
              source: form.source.trim() || undefined,
              region: form.region || undefined,
              lastReviewed: new Date().toISOString().split('T')[0],
            }
          : undefined,
        isActive: form.isActive,
      })
    } catch (error) {
      setSaving(false)
      throw error
    }
  }

  return (
    <Modal
      title={initialData ? 'تعديل معلومة' : 'إضافة معلومة جديدة'}
      onClose={onClose}
      width="720px"
    >
      <form onSubmit={handleSubmit}>
        <div className="admin-modal-body">
          <div className="admin-form" style={{ gap: '1rem' }}>
            <div className="admin-form-row">
              <div className="admin-form-group">
                <label className="admin-form-label">الفئة *</label>
                <FilterSelect
                  value={form.category}
                  onChange={(v) => set({ category: v })}
                  placeholder="الفئة"
                  className="w-full"
                  options={KNOWLEDGE_CATEGORIES}
                />
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">المدينة المتعلقة</label>
                <FilterSelect
                  value={form.region}
                  onChange={(v) => set({ region: v })}
                  placeholder="عام (كل الأحساء)"
                  className="w-full"
                  options={[
                    { value: '', label: 'عام (كل الأحساء)' },
                    ...CITIES.map((c) => ({ value: c, label: CITY_LABELS[c] || c })),
                  ]}
                />
              </div>
            </div>

            <div className="admin-form-row">
              <div className="admin-form-group">
                <label className="admin-form-label">العنوان (بالعربية) *</label>
                <input
                  type="text"
                  value={form.title_ar}
                  onChange={(e) => set({ title_ar: e.target.value })}
                  className="admin-form-input"
                  required
                />
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">العنوان (بالإنجليزية)</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => set({ title: e.target.value })}
                  className="admin-form-input"
                  dir="ltr"
                />
              </div>
            </div>

            <div className="admin-form-group">
              <label className="admin-form-label">المحتوى (بالعربية) *</label>
              <textarea
                value={form.content_ar}
                onChange={(e) => set({ content_ar: e.target.value })}
                className="admin-form-textarea"
                rows={6}
                placeholder="معلومات تفصيلية يستخدمها مساعد السفر: الوجهات، التوقيتات، النصائح، العادات..."
                required
              />
            </div>

            <div className="admin-form-group">
              <label className="admin-form-label">المحتوى (بالإنجليزية)</label>
              <textarea
                value={form.content}
                onChange={(e) => set({ content: e.target.value })}
                className="admin-form-textarea"
                rows={6}
                dir="ltr"
              />
            </div>

            <div className="admin-form-row">
              <div className="admin-form-group">
                <label className="admin-form-label">الكلمات المفتاحية (مفصولة بفواصل)</label>
                <input
                  type="text"
                  value={form.keywords}
                  onChange={(e) => set({ keywords: e.target.value })}
                  className="admin-form-input"
                  placeholder="الهفوف، جبل القارة، تمور، تراث"
                />
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">المصدر</label>
                <input
                  type="text"
                  value={form.source}
                  onChange={(e) => set({ source: e.target.value })}
                  className="admin-form-input"
                  placeholder="هيئة السياحة، موقع رسمي، دليل سياحي"
                />
              </div>
            </div>

            <label className="admin-checkbox-label">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => set({ isActive: e.target.checked })}
              />
              <span>نشط (يُستخدم في إجابات مساعد السفر)</span>
            </label>
          </div>
        </div>

        <div className="admin-modal-footer">
          <button type="button" onClick={onClose} className="admin-btn admin-btn-secondary">
            إلغاء
          </button>
          <button type="submit" className="admin-btn admin-btn-primary" disabled={saving}>
            {saving ? 'جاري الحفظ...' : initialData ? 'حفظ التعديلات' : 'إنشاء'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
