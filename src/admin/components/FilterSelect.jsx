import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select'

/**
 * A Radix Select shaped like the native `<select>` it replaces.
 *
 * Every filter and form dropdown in the panel used a bare `<select>`, which on
 * Windows renders as a grey OS widget that ignores the panel's type, radius and
 * focus ring entirely — and on Android opens a full-screen list with no styling
 * at all. This keeps a value/onChange contract close to the original so call
 * sites stay small, while giving the panel keyboard navigation, a styled popup,
 * and correct RTL placement.
 *
 * Radix has no concept of an empty-string value, so callers that use '' for
 * "no filter" get it mapped to a sentinel on the way in and back to '' on the
 * way out. That keeps the "all cities" option working without every caller
 * having to invent its own placeholder value.
 *
 * A list with no '' option ("choose the new status") passes '' through
 * instead: that is Radix's own "nothing chosen yet", and it shows the
 * placeholder. Mapped to the sentinel, which no item carries, the trigger
 * rendered blank.
 */
const ALL = '__all__'

export default function FilterSelect({
  value,
  onChange,
  options,
  placeholder,
  className = '',
  size = 'default',
  ariaLabel,
  disabled,
}) {
  const hasAllOption = options.some((option) => option.value === '')
  const empty = value === '' || value == null

  return (
    <Select
      dir="rtl"
      value={empty ? (hasAllOption ? ALL : '') : String(value)}
      onValueChange={(next) => onChange(next === ALL ? '' : next)}
      disabled={disabled}
    >
      <SelectTrigger size={size} className={className} aria-label={ariaLabel || placeholder}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent dir="rtl" className="max-h-72">
        {options.map((option) => (
          <SelectItem
            key={option.value === '' ? ALL : option.value}
            value={option.value === '' ? ALL : String(option.value)}
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
