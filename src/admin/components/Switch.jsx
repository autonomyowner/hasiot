/**
 * An on/off switch.
 *
 * A real `role="switch"` button rather than a styled checkbox, so screen readers
 * announce the state and the whole control is one tab stop. The label is always
 * rendered beside it: the panel never lets colour or position be the only thing
 * carrying meaning.
 */
export default function Switch({ checked, onChange, disabled, busy, label, onLabel, offLabel }) {
  return (
    <span className="ar-switch-wrap">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled || busy}
        onClick={() => onChange(!checked)}
        className={`ar-switch ${checked ? 'on' : 'off'} ${busy ? 'busy' : ''}`}
      >
        <span className="ar-switch-thumb" />
      </button>
      <span className={`ar-switch-label ${checked ? 'on' : 'off'}`}>
        {busy ? '...' : checked ? onLabel : offLabel}
      </span>
    </span>
  )
}
