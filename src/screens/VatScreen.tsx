import { useState } from 'react'
import { Check, ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { useStore } from '../data/store'
import type { VatCycle } from '../data/types'
import { fmtDmy, isoDate } from '../lib/dates'
import { ScreenHeader } from '../components/common'
import { useEditor } from '../components/Editor'
import { CHECKS, CYCLE_SHORT, addMonth, checksDone, latestPeriodEnd, longMonth, monthKey, parseMonth, periodLabel } from '../lib/vat'

type Sheet = 'uneven' | 'even'

/** The tab always opens on the current month. */
function thisMonth() {
  const d = new Date()
  return monthKey(d.getFullYear(), d.getMonth())
}

const sheetOf = (key: string): Sheet => ((parseMonth(key).month0 + 1) % 2 === 0 ? 'even' : 'uneven')

/** Like the control sheets: one for uneven months, one for even months. Monthly clients are on both. */
export function VatScreen() {
  const { state, toggleVatCheck } = useStore()
  const editor = useEditor()
  const [month, setMonth] = useState(thisMonth)
  const sheet = sheetOf(month)

  const clients = state.vatClients.filter((c) => c.cycle === sheet || c.cycle === 'monthly')
  const complete = clients.filter((c) => checksDone(state.vatChecks[`${c.id}:${month}`]) === CHECKS.length).length

  // Switching sheet keeps you near the same time: the latest month of that sheet.
  const showSheet = (s: Sheet) => {
    if (s !== sheet) setMonth(latestPeriodEnd(s, thisMonth()))
  }

  return (
    <div className="screen">
      <ScreenHeader
        title="VAT"
        subtitle={
          clients.length
            ? `${longMonth(month)}: ${complete} of ${clients.length} ${clients.length === 1 ? 'client' : 'clients'} done. Tap a box to tick it.`
            : 'Your VAT control sheet. Add the clients you look after.'
        }
        right={
          <button className="chip primary" onClick={() => editor.newVatClient(sheet)}>
            <Plus size={18} /> VAT client
          </button>
        }
      />

      <div className="vat-bar">
        <div className="segmented choice">
          <button className={sheet === 'uneven' ? 'on' : ''} onClick={() => showSheet('uneven')}>
            VAT – Uneven
          </button>
          <button className={sheet === 'even' ? 'on' : ''} onClick={() => showSheet('even')}>
            VAT – Even
          </button>
        </div>
        <div className="pager">
          <button className="round" aria-label="Previous period" onClick={() => setMonth(addMonth(month, -2))}>
            <ChevronLeft />
          </button>
          <b className="vat-month">{longMonth(month)}</b>
          <button className="round" aria-label="Next period" onClick={() => setMonth(addMonth(month, 2))}>
            <ChevronRight />
          </button>
        </div>
      </div>

      <section className="card vat-card">
        <div className="vat-scroll">
          <div className="vat-table">
            <div className="vat-row vat-head-group">
              <span className="vat-span-info" />
              <span className="vat-month-head">{longMonth(month).split(' ')[0].toUpperCase()}</span>
            </div>
            <div className="vat-row vat-head">
              <span>Client</span>
              <span>Responsible</span>
              <span>Period</span>
              <span>Notes</span>
              {CHECKS.map((c) => (
                <span key={c.key} className="vat-check-head">
                  {c.label}?
                </span>
              ))}
            </div>

            {clients.length === 0 && (
              <div className="vat-empty">
                <p className="muted">No {sheet} or monthly VAT clients yet.</p>
                <button className="chip primary" onClick={() => editor.newVatClient(sheet)}>
                  <Plus size={18} /> Add a VAT client
                </button>
              </div>
            )}

            {clients.map((c) => {
              const checks = state.vatChecks[`${c.id}:${month}`]
              const done = checksDone(checks)
              return (
                <div key={c.id} className={`vat-row${done === CHECKS.length ? ' complete' : ''}`}>
                  <button className="vat-client" onClick={() => editor.editVatClient(c)}>
                    <b>{c.client}</b>
                    <small>{periodLabel(c.cycle, month)}</small>
                  </button>
                  <span className="vat-strong">{c.responsible ?? ''}</span>
                  <span>
                    <i className={`vat-cycle ${c.cycle}`}>{CYCLE_SHORT[c.cycle as VatCycle]}</i>
                  </span>
                  <span className="vat-notes">{c.notes ?? ''}</span>
                  {CHECKS.map((x) => {
                    const at = checks?.[x.key]
                    return (
                      <button
                        key={x.key}
                        className={`vat-tick${at ? ' on' : ''}`}
                        aria-label={`${x.label}: ${at ? 'done' : 'not done'}`}
                        title={at ? `${x.label} ${fmtDmy(new Date(at))}` : x.label}
                        onClick={() => toggleVatCheck(c.id, month, x.key)}
                      >
                        {at && <Check size={22} strokeWidth={3} />}
                        {at && <small>{isoDate(new Date(at)) === isoDate(new Date()) ? 'today' : fmtDmy(new Date(at)).slice(0, 5)}</small>}
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
