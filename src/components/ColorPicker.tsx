import { Check } from 'lucide-react'

export const TEXT_SWATCHES = ['#3a2430', '#222222', '#6e2f4a', '#9c2f5e', '#1d3a8a', '#5b3a8c', '#12625e', '#5a3b2e']
// Bright, clearly different pen colours: dark shades looked black once handwriting became thin typed text.
export const INK_SWATCHES = ['#1d4ed8', '#111111', '#7c3aed', '#be185d', '#db2777', '#dc2626', '#c2410c', '#16a34a', '#0d9488']
/** Old (darker) pen colours and the brighter ones that replace them, for notes written before. */
export const OLD_INK_TO_NEW: Record<string, string> = {
  '#1d3a8a': '#1d4ed8',
  '#9c2f5e': '#be185d',
  '#d6336c': '#db2777',
  '#5b3a8c': '#7c3aed',
  '#12625e': '#0d9488',
  '#b42318': '#dc2626',
  '#5a3b2e': '#c2410c',
}
/** Highlighter colours (drawn see-through over the writing). */
export const HIGHLIGHT_SWATCHES = ['#f472b6', '#facc15', '#4ade80', '#60a5fa', '#fb923c', '#c084fc']

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
