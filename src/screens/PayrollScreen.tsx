import { useState } from 'react'
import { Check, ChevronLeft, ChevronRight, Plus, X } from 'lucide-react'
import { useStore } from '../data/store'
import type { PayrollChecks, PayrollItem } from '../data/types'
import { fmtDmy } from '../lib/dates'
import { ScreenHeader } from '../components/common'
import { useEditor } from '../components/Editor'
import { addMonth, longMonth, monthKey } from '../lib/vat'

const ITEMS: { key: PayrollItem; label: string }[] = [
  { key: 'followedUp', label: 'Followed up?' },
  { key: 'completedByClerk', label: 'Completed by clerk?' },
  { key: 'sentToClient', label: 'Payroll sent to client?' },
  { key: 'empSubmitted', label: 'EMP submitted?' },
]

/** A month counts as finished when every box is ✓ or n/a. */
const finished = (c?: PayrollChecks) => ITEMS.every((i) => c?.[i.key]?.s === 'done' || c?.[i.key]?.s === 'na')

const thisMonth = () => {
  const d = new Date()
  return monthKey(d.getFullYear(), d.getMonth())
}

/** Like the Payroll control sheet: every client, every month. Each box cycles ✓ → ✗ → n/a → blank. */
export function PayrollScreen() {
  const { state, cyclePayrollMark } = useStore()
  const editor = useEditor()
  const [month, setMonth] = useState(thisMonth)
  const clients = state.payrollClients
  const done = clients.filter((c) => finished(state.payrollChecks[`${c.id}:${month}`])).length

  return (
    <div className="screen">
      <ScreenHeader
        title="Payroll"
        subtitle={
          clients.length
            ? `${longMonth(month)}: ${done} of ${clients.length} ${clients.length === 1 ? 'client' : 'clients'} done. Tap a box: ✓, then ✗, then n/a.`
            : 'Your payroll control sheet. Add the clients you run payroll for.'
        }
        right={
          <button className="chip primary" onClick={() => editor.newPayrollClient()}>
            <Plus size={18} /> Payroll client
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
            <div className="vat-row payroll-row vat-head-group">
              <span className="vat-span-info" />
              <span className="vat-month-head">{longMonth(month).split(' ')[0].toUpperCase()}</span>
            </div>
            <div className="vat-row payroll-row vat-head">
              <span>Client</span>
              <span>Responsible</span>
              <span>Task / comments / payroll department</span>
              {ITEMS.map((i) => (
                <span key={i.key} className="vat-check-head">
                  {i.label}
                </span>
              ))}
            </div>

            {clients.length === 0 && (
              <div className="vat-empty">
                <p className="muted">No payroll clients yet.</p>
                <button className="chip primary" onClick={() => editor.newPayrollClient()}>
                  <Plus size={18} /> Add a payroll client
                </button>
              </div>
            )}

            {clients.map((c) => {
              const checks = state.payrollChecks[`${c.id}:${month}`]
              return (
                <div key={c.id} className={`vat-row payroll-row${finished(checks) ? ' complete' : ''}`}>
                  <button className="vat-client" onClick={() => editor.editPayrollClient(c)}>
                    <b>{c.client}</b>
                  </button>
                  <span className="vat-strong">{c.responsible ?? ''}</span>
                  <span className="vat-notes">{c.comments ?? ''}</span>
                  {ITEMS.map((i) => {
                    const mark = checks?.[i.key]
                    const word = mark?.s === 'done' ? 'done' : mark?.s === 'no' ? 'not done' : mark?.s === 'na' ? 'n/a' : 'blank'
                    return (
                      <button
                        key={i.key}
                        className={`vat-tick mark-${mark?.s ?? 'none'}`}
                        aria-label={`${i.label} ${word}`}
                        title={mark ? `${word}, ${fmtDmy(new Date(mark.at))}` : 'Tap to tick'}
                        onClick={() => cyclePayrollMark(c.id, month, i.key)}
                      >
                        {mark?.s === 'done' && <Check size={22} strokeWidth={3} />}
                        {mark?.s === 'no' && <X size={22} strokeWidth={3} />}
                        {mark?.s === 'na' && <span className="na">n/a</span>}
                      </button>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      </section>
    </div>
  )
}
