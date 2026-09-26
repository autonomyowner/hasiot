import { useEffect, useRef } from 'react'
import { toLatinDigits } from '../../partners/lib/phone'

// Moved here from src/partners/pages/LoginPage.jsx so the partner sign-in and
// the traveller's (/login, the checkout) share one code input.
export const CODE_LENGTH = 6

/** Only digits, Arabic-Indic folded to Latin. */
const digitsOf = (value) => toLatinDigits(value).replace(/\D/g, '')

/**
 * Six boxes for the SMS code. Always left-to-right, even in Arabic: a code is
 * read digit by digit in the order it arrived. Typing moves on, Backspace on
 * an empty box goes back, a paste or an SMS autofill of the whole code fills
 * every box at once.
 */
export default function CodeBoxes({ value, onChange, disabled, invalid, verifying, label, digitLabel }) {
  const refs = useRef([])
  const focusAt = (i) => {
    const el = refs.current[Math.max(0, Math.min(CODE_LENGTH - 1, i))]
    el?.focus()
    el?.select()
  }

  // Writes `digits` starting at box `from`, then focuses the next empty box.
  const fill = (from, digits) => {
    const next = [...value]
    let i = from
    for (const d of digits) {
      if (i >= CODE_LENGTH) break
      next[i] = d
      i += 1
    }
    onChange(next)
    focusAt(i >= CODE_LENGTH ? CODE_LENGTH - 1 : i)
  }

  const onInput = (i, raw) => {
    const digits = digitsOf(raw)
    if (!digits) {
      const next = [...value]
      next[i] = ''
      onChange(next)
      return
    }
    // A whole code arriving in one box (iOS/Android autofill) fills from the start.
    if (digits.length >= CODE_LENGTH) return fill(0, digits.slice(0, CODE_LENGTH))
    // The box already held a digit: keep the one just typed.
    const typed = digits.length > 1 && value[i] ? digits.replace(value[i], '') || digits.slice(-1) : digits
    fill(i, typed)
  }

  const onKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !value[i] && i > 0) {
      e.preventDefault()
      const next = [...value]
      next[i - 1] = ''
      onChange(next)
      focusAt(i - 1)
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      focusAt(i - 1)
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      focusAt(i + 1)
    } else if (e.key === 'Home') {
      e.preventDefault()
      focusAt(0)
    } else if (e.key === 'End') {
      e.preventDefault()
      focusAt(CODE_LENGTH - 1)
    }
  }

  const onPaste = (i, e) => {
    const digits = digitsOf(e.clipboardData.getData('text'))
    if (!digits) return
    e.preventDefault()
    fill(digits.length >= CODE_LENGTH ? 0 : i, digits.slice(0, CODE_LENGTH))
  }

  // After a wrong code the boxes are emptied; put the caret back in the first.
  const empty = value.every((d) => !d)
  useEffect(() => {
    if (empty && !disabled) refs.current[0]?.focus()
  }, [empty, disabled])

  return (
    <div
      className={`p-otp${verifying ? ' is-verifying' : ''}`}
      role="group"
      aria-label={label}
      dir="ltr"
    >
      {value.map((d, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el }}
          className="p-otp-box"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          aria-label={digitLabel.replace('{n}', String(i + 1))}
          aria-invalid={invalid ? 'true' : undefined}
          value={d}
          disabled={disabled}
          onChange={(e) => onInput(i, e.target.value)}
          onKeyDown={(e) => onKeyDown(i, e)}
          onPaste={(e) => onPaste(i, e)}
          onFocus={(e) => e.target.select()}
        />
      ))}
    </div>
  )
}
