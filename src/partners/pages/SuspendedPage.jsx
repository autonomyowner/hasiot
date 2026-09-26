import { usePartnerLang, pick } from '../lang'
import { usePartnerGate, usePartnerRoute } from '../usePartnerGate'
import { Icon } from '../components/Ui'

const translations = {
  en: {
    title: 'Account suspended',
    body: 'Our team has paused this account, so its places and services are hidden from travellers and the dashboard is closed.',
    reason: 'Reason:',
    help: 'If you think this is a mistake, write to support@hasio.xyz from the number or email on the account.',
  },
  ar: {
    title: 'الحساب موقوف',
    body: 'أوقف فريقنا هذا الحساب مؤقتًا، لذلك أماكنه وخدماته مخفية عن المسافرين ولوحة التحكم مغلقة.',
    reason: 'السبب:',
    help: 'إن كنت ترى أن هذا خطأ، راسلنا على support@hasio.xyz من الرقم أو البريد المسجّل في الحساب.',
  },
}

/**
 * Where a suspended partner lands. Without it they read as a new sign-up
 * (getCurrentUser returns null for a suspended account) and were sent to Join,
 * whose save then failed with "not authenticated" and no explanation.
 */
export default function SuspendedPage() {
  const { lang } = usePartnerLang()
  const t = pick(translations, lang)
  const { guard } = usePartnerGate('suspended')
  const { accountStatus } = usePartnerRoute()

  if (guard) return guard

  return (
    <div style={{ maxWidth: 640 }}>
      <h1 className="p-title">{t.title}</h1>
      <div className="p-card p-stack">
        <div className="p-status p-status-bad" role="status">
          <span className="p-status-icon"><Icon name="alert" size={22} /></span>
          <div>
            <p className="p-muted" style={{ margin: 0 }}>{t.body}</p>
            {accountStatus?.reason && (
              <p style={{ margin: '8px 0 0' }}>
                <strong>{t.reason}</strong> <bdi>{accountStatus.reason}</bdi>
              </p>
            )}
          </div>
        </div>
        <p className="p-small p-muted" style={{ margin: 0 }}>{t.help}</p>
      </div>
    </div>
  )
}
