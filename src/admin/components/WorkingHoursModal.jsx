import { useState } from 'react'
import { useMutation } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import Modal from './Modal'
import { useToast } from './toast-context'
import { WEEK_DAYS } from '../constants'

const DEFAULT_OPEN = '09:00'
const DEFAULT_CLOSE = '22:00'

function buildSchedule(workingHours) {
  return WEEK_DAYS.map(({ key }) => {
    const existing = workingHours?.find((h) => h.day === key)
    return existing
      ? {
          day: key,
          open: existing.open || DEFAULT_OPEN,
          close: existing.close || DEFAULT_CLOSE,
          isClosed: existing.isClosed ?? false,
        }
      // A listing with no saved hours starts open every day rather than closed:
      // the operator is here to open it, and Friday is the one they will change.
      : { day: key, open: DEFAULT_OPEN, close: DEFAULT_CLOSE, isClosed: false }
  })
}

/**
 * A day that closes after midnight: 18:00 → 02:00. "HH:MM" strings compare in
 * clock order, so a close earlier than the open can only mean the next day.
 */
const isOvernight = (day) => !day.isClosed && day.close < day.open

/**
 * Weekly opening hours for a listing.
 *
 * This is the only place these can be set now — the web business dashboard was
 * removed and the mobile app never had the screen. It matters more than it
 * looks: bookings/queries.ts:getAvailableSlots generates slots from these hours,
 * so a listing without them can never offer a bookable time.
 *
 * A close earlier than the open is accepted and means after midnight — the
 * cafés and restaurants that stay open late could not be entered at all while
 * the form insisted the close came later on the same day.
 */
export default function WorkingHoursModal({ listing, onClose }) {
  const saveWorkingHours = useMutation(api.listings.mutations.saveWorkingHours)
  const toast = useToast()
  const [schedule, setSchedule] = useState(() => buildSchedule(listing.workingHours))
  const [saving, setSaving] = useState(false)

  const updateDay = (index, patch) => {
    setSchedule((prev) => prev.map((day, i) => (i === index ? { ...day, ...patch } : day)))
  }

  const copyFirstOpenDayToAll = () => {
    const template = schedule.find((d) => !d.isClosed) || schedule[0]
    setSchedule((prev) => prev.map((day) => ({
      ...day,
      open: template.open,
      close: template.close,
    })))
    toast.info('تم نسخ التوقيت إلى كل الأيام المفتوحة')
  }

  const handleSave = async () => {
    // Equal times are the one ambiguous case: open all day, or not at all.
    const invalid = schedule.find((d) => !d.isClosed && (!d.open || !d.close || d.open === d.close))
    if (invalid) {
      const label = WEEK_DAYS.find((d) => d.key === invalid.day)?.label
      toast.error(`حدّد وقتين مختلفين للفتح والإغلاق (${label}).`)
      return
    }

    setSaving(true)
    try {
      await saveWorkingHours({ listingId: listing._id, workingHours: schedule })
      toast.success('تم حفظ أوقات العمل')
      onClose()
    } catch (error) {
      toast.error(error)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title="أوقات العمل"
      subtitle={listing.name_ar || listing.name_en}
      onClose={onClose}
      width="560px"
      footer={
        <>
          <button type="button" className="admin-btn admin-btn-secondary" onClick={onClose}>
            إلغاء
          </button>
          <button
            type="button"
            className="admin-btn admin-btn-primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'جاري الحفظ...' : 'حفظ'}
          </button>
        </>
      }
    >
      <div className="admin-modal-body">
        <div className="admin-info-box">
          <p>
            مواعيد الحجز في التطبيق تُبنى من هذه الأوقات بفواصل نصف ساعة.
            المكان بدون أوقات عمل لا يمكن الحجز فيه. إذا كان وقت الإغلاق قبل وقت
            الفتح فهو بعد منتصف الليل (مثال: 18:00 — 02:00).
          </p>
        </div>

        {/* getAvailableSlots walks from open to close on one day, so it finds
            no slot at all in a day that ends after midnight. The hours are
            still right to save; the operator should know what they cost. */}
        {schedule.some(isOvernight) && (
          <p className="admin-form-warning">
            تنبيه: التطبيق لا يعرض مواعيد حجز بالفترات في الأيام التي يمتد دوامها بعد منتصف الليل.
          </p>
        )}

        <div className="admin-hours-toolbar">
          <button
            type="button"
            className="admin-btn admin-btn-secondary admin-btn-small"
            onClick={copyFirstOpenDayToAll}
          >
            نسخ التوقيت لكل الأيام
          </button>
        </div>

        <div className="admin-hours-list">
          {schedule.map((day, index) => {
            const label = WEEK_DAYS.find((d) => d.key === day.day)?.label
            return (
              <div key={day.day} className={`admin-hours-row ${day.isClosed ? 'closed' : ''}`}>
                <label className="admin-checkbox-label admin-hours-day">
                  <input
                    type="checkbox"
                    checked={!day.isClosed}
                    onChange={(e) => updateDay(index, { isClosed: !e.target.checked })}
                  />
                  <span>{label}</span>
                </label>

                {day.isClosed ? (
                  <span className="admin-hours-closed">مغلق</span>
                ) : (
                  <div className="admin-hours-times">
                    <input
                      type="time"
                      className="admin-form-input"
                      value={day.open}
                      onChange={(e) => updateDay(index, { open: e.target.value })}
                      aria-label={`وقت فتح ${label}`}
                    />
                    <span className="admin-hours-dash">—</span>
                    <input
                      type="time"
                      className="admin-form-input"
                      value={day.close}
                      onChange={(e) => updateDay(index, { close: e.target.value })}
                      aria-label={`وقت إغلاق ${label}`}
                    />
                    {isOvernight(day) && (
                      <span className="admin-hours-overnight">(بعد منتصف الليل)</span>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </Modal>
  )
}
