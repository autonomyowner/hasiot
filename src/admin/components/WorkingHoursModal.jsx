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
 * Weekly opening hours for a listing.
 *
 * This is the only place these can be set now — the web business dashboard was
 * removed and the mobile app never had the screen. It matters more than it
 * looks: bookings/queries.ts:getAvailableSlots generates slots from these hours,
 * so a listing without them can never offer a bookable time.
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
    const invalid = schedule.find((d) => !d.isClosed && d.open >= d.close)
    if (invalid) {
      const label = WEEK_DAYS.find((d) => d.key === invalid.day)?.label
      toast.error(`وقت الإغلاق يجب أن يكون بعد وقت الفتح (${label}).`)
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
            المكان بدون أوقات عمل لا يمكن الحجز فيه.
          </p>
        </div>

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
