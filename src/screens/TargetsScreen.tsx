import { useState } from 'react'
import { Check, ChevronLeft, ChevronRight, Copy, Plus, X } from 'lucide-react'
import { useStore, todayIso } from '../data/store'
import type { Target, TargetItem } from '../data/types'
import { fmtDmy, isoToDmy } from '../lib/dates'
import { ScreenHeader } from '../components/common'
import { useEditor } from '../components/Editor'
import { addMonth, longMonth, monthKey } from '../lib/vat'

const ITEMS: { key: TargetItem; label: string }[] = [
  { key: 'reviewed', label: 'Reviewed?' },
  { key: 'queriesDone', label: 'Queries done?' },
  { key: 'fileGiven', label: 'File given to Henk' },
  { key: 'draftSent', label: 'Draft sent to client' },
]

/** A row counts as finished when every box is ✓ or n/a. */
const finished = (t: Target) => ITEMS.every((i) => t.checks[i.key]?.s === 'done' || t.checks[i.key]?.s === 'na')
const ticked = (t: Target, item: TargetItem) => t.checks[item]?.s === 'done' || t.checks[item]?.s === 'na'

const thisMonth = () => {
  const d = new Date()
  return monthKey(d.getFullYear(), d.getMonth())
}

/** Like the TARGETS / "TO DO" sheet: the month's clients with review and query dates. Each box cycles ✓ → ✗ → n/a → blank. */
export function TargetsScreen() {
  const { state, cycleTargetMark, copyTargets } = useStore()
  const editor = useEditor()
  const [month, setMonth] = useState(thisMonth)
  const rows = state.targets.filter((t) => t.month === month)
  const done = rows.filter(finished).length
  const prev = addMonth(month, -1)
  const prevCount = state.targets.filter((t) => t.month === prev).length
  const today = todayIso()

  /** A date shows red once it has passed and its box isn't ticked yet. */
  const dateCell = (iso: string | undefined, isDone: boolean) => (
    <span className={`vat-strong target-date${iso && !isDone && iso < today ? ' late' : ''}`}>{iso ? isoToDmy(iso) : ''}</span>
  )

  return (
    <div className="screen">
      <ScreenHeader
        title="Targets"
        subtitle={
          rows.length
            ? `${longMonth(month)}: ${done} of ${rows.length} done. Tap a box: ✓, then ✗, then n/a.`
            : 'Your monthly targets sheet. Add the clients for this month.'
        }
        right={
          <button className="chip primary" onClick={() => editor.newTarget(month)}>
            <Plus size={18} /> Target
          </button>
        }
      />

      <div className="vat-bar">
        <span />
        <div className="pager">
          <button className="round" aria-label="Previous month" onClick={() => setMonth(addMonth(month, -1))}>
            <ChevronLeft />
          </button>
          <b className="vat-month">{longMonth(month)}</b>
          <button className="round" aria-label="Next month" onClick={() => setMonth(addMonth(month, 1))}>
            <ChevronRight />
          </button>
        </div>
      </div>

      <section className="card vat-card">
        <div className="vat-scroll">
          <div className="vat-table">
            <div className="vat-row target-row vat-head">
              <span>Client</span>
              <span>Responsible</span>
              <span>1st review due</span>
              <span className="vat-check-head">{ITEMS[0].label}</span>
              <span>Queries due</span>
              {ITEMS.slice(1).map((i) => (
                <span key={i.key} className="vat-check-head">
                  {i.label}
                </span>
              ))}
            </div>

            {rows.length === 0 && (
              <div className="vat-empty">
                <p className="muted">No targets for {longMonth(month)} yet.</p>
                <div className="row-gap">
                  {prevCount > 0 && (
                    <button className="chip primary" onClick={() => copyTargets(prev, month)}>
                      <Copy size={18} /> Copy {longMonth(prev).split(' ')[0]}'s {prevCount} {prevCount === 1 ? 'client' : 'clients'}
                    </button>
                  )}
                  <button className={`chip${prevCount > 0 ? '' : ' primary'}`} onClick={() => editor.newTarget(month)}>
                    <Plus size={18} /> Add a target
                  </button>
                </div>
              </div>
            )}

            {rows.map((t) => {
              const box = (item: TargetItem, label: string) => {
                const mark = t.checks[item]
                const word = mark?.s === 'done' ? 'done' : mark?.s === 'no' ? 'not done' : mark?.s === 'na' ? 'n/a' : 'blank'
                return (
                  <button
                    key={item}
                    className={`vat-tick mark-${mark?.s ?? 'none'}`}
                    aria-label={`${label} ${word}`}
                    title={mark ? `${word}, ${fmtDmy(new Date(mark.at))}` : 'Tap to tick'}
                    onClick={() => cycleTargetMark(t.id, item)}
                  >
                    {mark?.s === 'done' && <Check size={22} strokeWidth={3} />}
                    {mark?.s === 'no' && <X size={22} strokeWidth={3} />}
                    {mark?.s === 'na' && <span className="na">n/a</span>}
                  </button>
                )
              }
              return (
                <div key={t.id} className={`vat-row target-row${finished(t) ? ' complete' : ''}`}>
                  <button className="vat-client" onClick={() => editor.editTarget(t)}>
                    <b>{t.client}</b>
                  </button>
                  <span className="vat-strong">{t.responsible ?? ''}</span>
                  {dateCell(t.reviewDue, ticked(t, 'reviewed'))}
                  {box('reviewed', ITEMS[0].label)}
                  {dateCell(t.queriesDue, ticked(t, 'queriesDone'))}
                  {ITEMS.slice(1).map((i) => box(i.key, i.label))}
                </div>
              )
            })}
          </div>
        </div>
      </section>
    </div>
  )
}
