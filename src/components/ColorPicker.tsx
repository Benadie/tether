import { Check } from 'lucide-react'

export const TEXT_SWATCHES = ['#3a2430', '#222222', '#6e2f4a', '#9c2f5e', '#1d3a8a', '#5b3a8c', '#12625e', '#5a3b2e']
export const INK_SWATCHES = ['#1d3a8a', '#111111', '#9c2f5e', '#d6336c', '#5b3a8c', '#12625e', '#b42318', '#5a3b2e']

/** Swatches for quick picks plus a custom colour wheel. `value` undefined means the default (first swatch). */
export function ColorPicker(props: {
  label: string
  swatches: string[]
  value?: string
  onChange: (color: string | undefined) => void
}) {
  const current = (props.value ?? props.swatches[0]).toLowerCase()
  const custom = !props.swatches.includes(current)

  return (
    <div className="color-picker">
      <span className="color-label">{props.label}</span>
      <div className="swatches">
        {props.swatches.map((c, i) => (
          <button
            key={c}
            className={`swatch${current === c ? ' on' : ''}`}
            style={{ background: c }}
            aria-label={i === 0 ? `Default colour ${c}` : `Colour ${c}`}
            onClick={() => props.onChange(i === 0 ? undefined : c)}
          >
            {current === c && <Check size={18} strokeWidth={3} />}
          </button>
        ))}
        <label className={`swatch custom${custom ? ' on' : ''}`} style={custom ? { background: current } : undefined}>
          <input type="color" value={current} onChange={(e) => props.onChange(e.target.value)} aria-label="Custom colour" />
          {custom ? <Check size={18} strokeWidth={3} /> : '+'}
        </label>
      </div>
    </div>
  )
}
