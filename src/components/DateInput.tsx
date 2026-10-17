import { useEffect, useRef, useState } from 'react'
import { CalendarDays } from 'lucide-react'
import { dmyToIso, isoToDmy } from '../lib/dates'

// Chrome's own date box shows dates in the device's format (e.g. 2026/10/17).
// This one always shows day/month/year and still offers the system date picker.
export function DateInput(props: {
  /** YYYY-MM-DD, or "" for no date */
  value: string
  onChange: (iso: string) => void
  disabled?: boolean
  placeholder?: string
}) {
  const [text, setText] = useState(isoToDmy(props.value))
  const picker = useRef<HTMLInputElement>(null)
  const invalid = text !== '' && dmyToIso(text) === null

  // Follow outside changes (e.g. picked from the calendar) without fighting the user's typing.
  useEffect(() => {
    if (dmyToIso(text) !== props.value) setText(isoToDmy(props.value))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.value])

  function type(raw: string) {
    // Add the slashes for you: 17102026 -> 17/10/2026
    const digits = raw.replace(/[^\d/.-]/g, '')
    let next = digits
    if (/^\d+$/.test(digits)) {
      next = digits.slice(0, 2)
      if (digits.length > 2) next += '/' + digits.slice(2, 4)
      if (digits.length > 4) next += '/' + digits.slice(4, 8)
    }
    setText(next)
    if (!next) props.onChange('')
    const iso = dmyToIso(next)
    if (iso) props.onChange(iso)
  }

  return (
    <div className={`date-input${invalid ? ' invalid' : ''}${props.disabled ? ' disabled' : ''}`}>
      <input
        inputMode="numeric"
        placeholder={props.placeholder ?? 'dd/mm/yyyy'}
        value={text}
        disabled={props.disabled}
        maxLength={10}
        onChange={(e) => type(e.target.value)}
      />
      <button
        type="button"
        aria-label="Pick a date"
        disabled={props.disabled}
        onClick={() => picker.current?.showPicker?.()}
      >
        <CalendarDays size={20} />
      </button>
      <input
        ref={picker}
        type="date"
        className="hidden-picker"
        tabIndex={-1}
        aria-hidden
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
      />
    </div>
  )
}
