import { Switch as ShadSwitch } from '../ui/switch'

/**
 * Visibility toggle. Radix's Switch underneath, so it is a real `role="switch"`
 * with keyboard support; the written label stays beside it because the panel
 * never lets colour or position be the only thing carrying meaning.
 */
export default function Switch({ checked, onChange, disabled, busy, label, onLabel, offLabel }) {
  return (
    <span className="inline-flex items-center gap-2">
      <ShadSwitch
        checked={checked}
        onCheckedChange={onChange}
        disabled={disabled || busy}
        aria-label={label}
        className="data-[state=checked]:bg-primary"
      />
      <span
        className={`text-xs font-semibold whitespace-nowrap ${
          checked ? 'text-primary' : 'text-muted-foreground'
        }`}
      >
        {busy ? '...' : checked ? onLabel : offLabel}
      </span>
    </span>
  )
}
