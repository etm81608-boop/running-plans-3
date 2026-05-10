import { useState, useMemo, useRef, useCallback, useEffect } from 'react'
import {
  collection,
  addDoc,
  doc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '../firebase/config'
import { useCollection } from '../hooks/useCollection'
import { useWorkoutTypes } from '../hooks/useWorkoutTypes'
import Toast from '../components/Toast'
import { format, addDays, parseISO } from 'date-fns'

/* ──────────────────────────────────────────────────────────────────────────────
 * WeeklyEntry — spreadsheet-style page for entering an entire week of workouts
 * in one bulk submit.  7 rows (Mon → Sun), one column per workout field.
 *
 * Power features:
 *   • Drag-fill / copy down (per-cell handle + per-column "fill all" button)
 *   • Keyboard navigation: Tab / Shift-Tab, Enter / Shift-Enter
 *   • Paste tab-separated data from Google Sheets / Excel directly into the grid
 *   • Save / load weekly templates (Firestore: weeklyTemplates collection)
 *   • Per-row recipients override (defaults set once at the top)
 *
 * Saves to the same `assignments` Firestore collection as AssignWorkout, so the
 * resulting workouts show up everywhere existing pages already read from
 * (Calendar, Team Grid, Runner pages, etc.).
 * ────────────────────────────────────────────────────────────────────────────*/

// ── Constants ─────────────────────────────────────────────────────────────────

const DRILL_OPTIONS = [
  'Cone / Wicket Drills',
  'Hurdle Drills',
  'Hip Drills',
]

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// Spreadsheet column definitions.  Order here = visible order in the grid AND
// the column order used when pasting tab-separated data from a real spreadsheet.
const COLUMNS = [
  { key: 'workoutType',     label: 'Type',         kind: 'select',   width: 140 },
  { key: 'workoutTitle',    label: 'Title',        kind: 'input',    width: 170 },
  { key: 'warmup',          label: 'Warm-Up',      kind: 'textarea', width: 200 },
  { key: 'drills',          label: 'Drills',       kind: 'drills',   width: 160 },
  { key: 'mainWorkout',     label: 'Main Workout', kind: 'textarea', width: 300 },
  { key: 'cooldown',        label: 'Cool-Down',    kind: 'textarea', width: 180 },
  { key: 'notes',           label: 'Notes',        kind: 'textarea', width: 200 },
]

const blankRow = () => ({
  workoutType:  'easy',
  workoutTitle: '',
  warmup:       '',
  drills:       '',
  mainWorkout:  '',
  cooldown:     '',
  notes:        '',
  recipients:   null, // null = use default; otherwise array of runner ids
})

/** Find the most recent Monday on or before `d`. */
function getMonday(d = new Date()) {
  const day = d.getDay() // 0=Sun, 1=Mon...
  const diff = day === 0 ? -6 : 1 - day
  const m = new Date(d)
  m.setDate(m.getDate() + diff)
  m.setHours(12, 0, 0, 0)
  return m
}

/** Did this row receive any meaningful input? */
function rowHasContent(r) {
  return Boolean(
    r.workoutTitle.trim() ||
    r.warmup.trim() ||
    r.drills ||
    r.mainWorkout.trim() ||
    r.cooldown.trim() ||
    r.notes.trim() ||
    (r.workoutType && r.workoutType !== 'easy')
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function WeeklyEntry() {
  const allWorkoutTypes = useWorkoutTypes()
  const typeOptions     = allWorkoutTypes.filter((t) => t.value !== 'rest')

  const { docs: runners }   = useCollection('runners', 'name')
  const { docs: groups }    = useCollection('groups',  'name')
  const { docs: templates } = useCollection('weeklyTemplates', 'name')

  // Week start (Monday) — date string yyyy-MM-dd
  const [weekStart, setWeekStart] = useState(() => format(getMonday(), 'yyyy-MM-dd'))

  // 7 rows of workout data, one per day Mon → Sun
  const [rows, setRows] = useState(() => Array.from({ length: 7 }, blankRow))

  // Default recipients (used unless a row has its own override)
  const [defaultMode,    setDefaultMode]    = useState('all')         // 'all' | 'group' | 'individual'
  const [defaultGroup,   setDefaultGroup]   = useState('')
  const [defaultRunners, setDefaultRunners] = useState([])

  // Tracks which cell is currently focused for paste / fill operations
  const [active,    setActive]    = useState({ row: 0, col: 0 })
  const cellRefs                    = useRef({})

  // UI state
  const [saving,            setSaving]            = useState(false)
  const [toast,             setToast]             = useState(null)
  const [showSaveTemplate,  setShowSaveTemplate]  = useState(false)
  const [templateName,      setTemplateName]      = useState('')
  const [overrideRow,       setOverrideRow]       = useState(null) // row idx with open recipient override popover

  // ── Derived: weekly dates ───────────────────────────────────────────────────
  const weekDates = useMemo(() => {
    if (!weekStart) return []
    const start = parseISO(weekStart + 'T12:00:00')
    return Array.from({ length: 7 }, (_, i) => addDays(start, i))
  }, [weekStart])

  // ── Derived: default recipient list ────────────────────────────────────────
  const defaultRecipients = useMemo(() => {
    if (defaultMode === 'all')        return runners
    if (defaultMode === 'group')      return runners.filter((r) => r.group === defaultGroup)
    if (defaultMode === 'individual') return runners.filter((r) => defaultRunners.includes(r.id))
    return []
  }, [defaultMode, defaultGroup, defaultRunners, runners])

  // ── Derived: totals ────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    let days = 0, totalDocs = 0
    rows.forEach((r) => {
      if (!rowHasContent(r)) return
      const recipIds = r.recipients ?? defaultRecipients.map((x) => x.id)
      if (recipIds.length === 0) return
      days += 1
      totalDocs += recipIds.length
    })
    return { days, totalDocs }
  }, [rows, defaultRecipients])

  // ── Row update helpers ─────────────────────────────────────────────────────
  const updateCell = useCallback((rowIdx, key, value) => {
    setRows((prev) => prev.map((r, i) => (i === rowIdx ? { ...r, [key]: value } : r)))
  }, [])

  const fillDownFromRow = useCallback((rowIdx, key) => {
    setRows((prev) => {
      const value = prev[rowIdx][key]
      return prev.map((r, i) => (i > rowIdx ? { ...r, [key]: value } : r))
    })
    setToast({ message: 'Filled down to remaining days', type: 'success' })
  }, [])

  const fillEntireColumn = useCallback((key) => {
    setRows((prev) => {
      const value = prev[0][key]
      return prev.map((r) => ({ ...r, [key]: value }))
    })
    setToast({ message: `Copied row 1 to all 7 days`, type: 'success' })
  }, [])

  const clearWeek = useCallback(() => {
    if (!confirm('Clear all 7 days of workouts?')) return
    setRows(Array.from({ length: 7 }, blankRow))
  }, [])

  const toggleDefaultRunner = useCallback((id) => {
    setDefaultRunners((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])
  }, [])

  // ── Keyboard navigation ────────────────────────────────────────────────────
  // Enter / Shift+Enter → move down / up.  Tab / Shift+Tab uses default browser
  // focus order which we control with explicit tabIndex below.
  // Alt+Enter or Cmd/Ctrl+Enter inserts a newline in textareas.
  const focusCell = useCallback((row, col) => {
    const target = cellRefs.current[`${row}-${col}`]
    if (target) {
      target.focus()
      if (target.select) target.select()
      setActive({ row, col })
    }
  }, [])

  const onCellKeyDown = useCallback((e, rowIdx, colIdx, kind) => {
    const isEnter = e.key === 'Enter'
    const isAltOrCmd = e.altKey || e.metaKey || e.ctrlKey
    if (isEnter && kind === 'textarea' && isAltOrCmd) {
      // let the newline through
      return
    }
    if (isEnter) {
      e.preventDefault()
      const nextRow = e.shiftKey
        ? Math.max(0, rowIdx - 1)
        : Math.min(6, rowIdx + 1)
      focusCell(nextRow, colIdx)
      return
    }
    if (e.key === 'ArrowDown' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      focusCell(Math.min(6, rowIdx + 1), colIdx)
    }
    if (e.key === 'ArrowUp' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      focusCell(Math.max(0, rowIdx - 1), colIdx)
    }
  }, [focusCell])

  // ── Paste from spreadsheet (TSV) ───────────────────────────────────────────
  const onGridPaste = useCallback((e) => {
    const text = (e.clipboardData || window.clipboardData)?.getData('text')
    if (!text) return
    // Detect whether this looks like spreadsheet content (has a tab or newline)
    const looksLikeTSV = text.includes('\t') || /\n/.test(text.trim())
    if (!looksLikeTSV) return // let the browser handle a normal single-cell paste

    e.preventDefault()
    const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
    // Drop a trailing empty line that copy-from-Sheets often appends
    while (lines.length && lines[lines.length - 1] === '') lines.pop()

    const startRow = active.row
    const startCol = active.col

    setRows((prev) => {
      const next = prev.map((r) => ({ ...r }))
      lines.forEach((line, i) => {
        const targetRow = startRow + i
        if (targetRow > 6) return
        const cells = line.split('\t')
        cells.forEach((raw, j) => {
          const targetCol = startCol + j
          if (targetCol >= COLUMNS.length) return
          const col = COLUMNS[targetCol]
          let v = raw
          // Translate human-readable type labels back to slugs
          if (col.key === 'workoutType') {
            const match = typeOptions.find(
              (t) => t.value === v ||
                     t.label.toLowerCase() === v.trim().toLowerCase()
            )
            if (match) v = match.value
            else v = next[targetRow].workoutType
          }
          next[targetRow][col.key] = v
        })
      })
      return next
    })
    setToast({ message: `Pasted ${lines.length} row${lines.length !== 1 ? 's' : ''} from clipboard`, type: 'success' })
  }, [active, typeOptions])

  // ── Save / load templates ──────────────────────────────────────────────────
  async function handleSaveTemplate() {
    const name = templateName.trim()
    if (!name) return
    try {
      await addDoc(collection(db, 'weeklyTemplates'), {
        name,
        rows: rows.map((r) => ({ ...r, recipients: null })), // never store recipients in templates
        createdAt: serverTimestamp(),
      })
      setToast({ message: `Saved template "${name}"`, type: 'success' })
      setShowSaveTemplate(false)
      setTemplateName('')
    } catch (err) {
      setToast({ message: 'Save failed: ' + err.message, type: 'error' })
    }
  }

  function loadTemplate(tmpl) {
    if (!tmpl?.rows || tmpl.rows.length !== 7) {
      setToast({ message: 'Template is missing or malformed', type: 'error' })
      return
    }
    setRows(tmpl.rows.map((r) => ({ ...blankRow(), ...r, recipients: null })))
    setToast({ message: `Loaded "${tmpl.name}"`, type: 'success' })
  }

  async function deleteTemplate(tmpl) {
    if (!confirm(`Delete template "${tmpl.name}"?`)) return
    try {
      await deleteDoc(doc(db, 'weeklyTemplates', tmpl.id))
      setToast({ message: 'Template deleted', type: 'success' })
    } catch (err) {
      setToast({ message: 'Delete failed: ' + err.message, type: 'error' })
    }
  }

  // ── Assign the whole week ──────────────────────────────────────────────────
  async function handleAssignWeek() {
    if (stats.totalDocs === 0) return
    setSaving(true)

    let createdDocs = 0
    try {
      for (let i = 0; i < 7; i++) {
        const r = rows[i]
        if (!rowHasContent(r)) continue
        const recipIds = r.recipients ?? defaultRecipients.map((x) => x.id)
        if (recipIds.length === 0) continue
        const recipObjs = runners.filter((x) => recipIds.includes(x.id))
        if (recipObjs.length === 0) continue

        const dateObj  = weekDates[i]
        const dateIso  = format(dateObj, 'yyyy-MM-dd')
        const dateStr  = format(dateObj, 'MMMM d, yyyy')
        const typeObj  = allWorkoutTypes.find((t) => t.value === r.workoutType)
        const autoTitle = r.workoutTitle.trim() ||
                          `${typeObj?.label ?? r.workoutType} — ${dateStr}`

        for (const runner of recipObjs) {
          await addDoc(collection(db, 'assignments'), {
            runnerId:         runner.id,
            runnerName:       runner.name,
            date:             dateIso,
            dateStr,
            workoutTitle:     autoTitle,
            workoutType:      r.workoutType,
            warmup:           r.warmup.trim(),
            drills:           r.drills || '',
            additionalWarmup: '',
            mainWorkout:      r.mainWorkout.trim(),
            cooldown:         r.cooldown.trim(),
            crossTraining:    null,
            notes:            r.notes.trim(),
            createdAt:        serverTimestamp(),
          })
          createdDocs += 1
        }
      }

      setToast({ message: `Assigned ${stats.days} day${stats.days !== 1 ? 's' : ''} to runners (${createdDocs} workouts created)`, type: 'success' })
      // Clear the grid after a successful assign
      setRows(Array.from({ length: 7 }, blankRow))
    } catch (err) {
      setToast({ message: 'Error: ' + err.message, type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-[1400px]">
      {/* ── Header ── */}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Weekly Entry</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Spreadsheet-style entry for an entire week of workouts. Tab between cells, paste from Google Sheets, fill columns down — then assign all 7 days at once.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-500">Week starting (Mon)</label>
          <input
            type="date"
            value={weekStart}
            onChange={(e) => {
              const d = parseISO(e.target.value + 'T12:00:00')
              setWeekStart(format(getMonday(d), 'yyyy-MM-dd'))
            }}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
          />
        </div>
      </div>

      {/* ── Default Recipients ── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="font-semibold text-gray-900">Default Recipients</h2>
            <p className="text-xs text-gray-500">Used for any row that doesn’t have its own override.</p>
          </div>
          <p className="text-xs text-gray-500">
            <span className="font-semibold text-brand-600">{defaultRecipients.length}</span> runner{defaultRecipients.length !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="flex gap-2 mb-3">
          {[
            { key: 'all',        label: 'All Runners' },
            { key: 'group',      label: 'By Group' },
            { key: 'individual', label: 'Individuals' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setDefaultMode(key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                defaultMode === key ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {defaultMode === 'all' && (
          <p className="text-sm text-gray-600">All {runners.length} runner{runners.length !== 1 ? 's' : ''} will receive each day’s workout (unless a row overrides).</p>
        )}
        {defaultMode === 'group' && (
          <select
            value={defaultGroup}
            onChange={(e) => setDefaultGroup(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white"
          >
            <option value="">— choose a group —</option>
            {groups.map((g) => (
              <option key={g.id} value={g.name}>{g.name}</option>
            ))}
          </select>
        )}
        {defaultMode === 'individual' && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 max-h-44 overflow-y-auto pr-1">
            {runners.map((r) => (
              <button
                key={r.id}
                onClick={() => toggleDefaultRunner(r.id)}
                className={`text-left px-3 py-1.5 rounded-lg border text-sm transition-colors ${
                  defaultRunners.includes(r.id)
                    ? 'border-brand-500 bg-brand-50 text-brand-700 font-medium'
                    : 'border-gray-200 text-gray-700 hover:border-brand-200'
                }`}
              >
                {r.name}
                {r.group && <span className="block text-xs text-gray-400">{r.group}</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <button
          onClick={() => setShowSaveTemplate((v) => !v)}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white hover:bg-gray-50 font-medium text-gray-700"
        >
          💾 Save as template
        </button>

        {templates.length > 0 && (
          <div className="relative inline-block">
            <select
              onChange={(e) => {
                const t = templates.find((x) => x.id === e.target.value)
                if (t) loadTemplate(t)
                e.target.value = ''
              }}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white hover:bg-gray-50 font-medium text-gray-700"
              defaultValue=""
            >
              <option value="" disabled>📄 Load template…</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
        )}

        <button
          onClick={clearWeek}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white hover:bg-gray-50 font-medium text-gray-700"
        >
          🧹 Clear week
        </button>

        <span className="ml-2 text-xs text-gray-500">
          ↹ Tab moves right · Enter moves down · Cmd+V to paste from Google Sheets
        </span>
      </div>

      {showSaveTemplate && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-3 flex items-center gap-3">
          <input
            type="text"
            placeholder="Template name (e.g. Base-Building Week 1)"
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            autoFocus
          />
          <button
            onClick={handleSaveTemplate}
            disabled={!templateName.trim()}
            className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-1.5 rounded-lg font-medium text-sm disabled:opacity-40"
          >
            Save
          </button>
          <button
            onClick={() => { setShowSaveTemplate(false); setTemplateName('') }}
            className="text-gray-500 hover:text-gray-700 px-2 text-sm"
          >
            Cancel
          </button>
        </div>
      )}

      {templates.length > 0 && (
        <div className="text-xs text-gray-500 mb-3 flex flex-wrap gap-2 items-center">
          <span className="text-gray-400">Templates:</span>
          {templates.map((t) => (
            <span key={t.id} className="inline-flex items-center gap-1 bg-gray-100 rounded-md px-2 py-0.5">
              <button onClick={() => loadTemplate(t)} className="hover:text-brand-700 font-medium">{t.name}</button>
              <button onClick={() => deleteTemplate(t)} className="text-gray-400 hover:text-red-500 ml-0.5" title="Delete">×</button>
            </span>
          ))}
        </div>
      )}

      {/* ── Spreadsheet Grid ── */}
      <div
        onPaste={onGridPaste}
        className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-x-auto"
      >
        <table className="text-sm" style={{ borderCollapse: 'separate', borderSpacing: 0, minWidth: '100%' }}>
          <thead>
            <tr className="bg-gray-50">
              <th className="sticky left-0 z-10 bg-gray-50 border-b border-r border-gray-200 px-3 py-2 text-left text-xs font-semibold text-gray-600" style={{ width: 130 }}>
                Day
              </th>
              {COLUMNS.map((col, ci) => (
                <th
                  key={col.key}
                  className="border-b border-r border-gray-200 px-3 py-2 text-left text-xs font-semibold text-gray-600 align-bottom"
                  style={{ width: col.width, minWidth: col.width }}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span>{col.label}</span>
                    <button
                      onClick={() => fillEntireColumn(col.key)}
                      title="Copy row 1 to all 7 days"
                      className="text-gray-400 hover:text-brand-600 text-[10px] font-medium px-1 rounded hover:bg-brand-50"
                    >
                      ⤓ all
                    </button>
                  </div>
                </th>
              ))}
              <th className="border-b border-gray-200 px-3 py-2 text-left text-xs font-semibold text-gray-600" style={{ width: 200 }}>
                Recipients
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} className="hover:bg-gray-50/40">
                {/* Day & Date */}
                <td className="sticky left-0 z-[5] bg-white hover:bg-gray-50 border-b border-r border-gray-200 px-3 py-2 align-top" style={{ width: 130 }}>
                  <div className="font-semibold text-gray-900 text-sm leading-tight">{DAY_LABELS[ri]}</div>
                  <div className="text-xs text-gray-500">
                    {weekDates[ri] ? format(weekDates[ri], 'MMM d') : ''}
                  </div>
                </td>

                {/* Editable cells */}
                {COLUMNS.map((col, ci) => (
                  <td
                    key={col.key}
                    className="border-b border-r border-gray-200 p-0 align-top relative group"
                    style={{ width: col.width, minWidth: col.width }}
                  >
                    <Cell
                      col={col}
                      rowIdx={ri}
                      colIdx={ci}
                      value={row[col.key]}
                      typeOptions={typeOptions}
                      cellRefs={cellRefs}
                      onChange={(v) => updateCell(ri, col.key, v)}
                      onFocus={() => setActive({ row: ri, col: ci })}
                      onKeyDown={(e) => onCellKeyDown(e, ri, ci, col.kind)}
                      isActive={active.row === ri && active.col === ci}
                    />
                    {ri < 6 && (
                      <button
                        onClick={() => fillDownFromRow(ri, col.key)}
                        title="Copy this cell down to remaining days"
                        className="absolute bottom-0.5 right-0.5 w-4 h-4 bg-brand-600 text-white text-[10px] rounded opacity-0 group-hover:opacity-90 hover:opacity-100 hover:scale-110 flex items-center justify-center transition-all"
                        style={{ lineHeight: 1 }}
                      >
                        ↓
                      </button>
                    )}
                  </td>
                ))}

                {/* Recipients */}
                <td className="border-b border-gray-200 px-2 py-1 align-top text-xs" style={{ width: 200 }}>
                  <RecipientsCell
                    row={row}
                    rowIdx={ri}
                    runners={runners}
                    groups={groups}
                    defaultCount={defaultRecipients.length}
                    isOpen={overrideRow === ri}
                    onOpen={() => setOverrideRow(overrideRow === ri ? null : ri)}
                    onChange={(v) => updateCell(ri, 'recipients', v)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Summary & Submit ── */}
      <div className="mt-5 flex items-center justify-between gap-4 flex-wrap">
        <div className="text-sm text-gray-600">
          {stats.days > 0 ? (
            <>
              <span className="font-semibold text-gray-900">{stats.days}</span> day{stats.days !== 1 ? 's' : ''} ready ·
              {' '}<span className="font-semibold text-gray-900">{stats.totalDocs}</span> total assignment{stats.totalDocs !== 1 ? 's' : ''} will be created
            </>
          ) : (
            <span className="text-gray-400">Fill in at least one day to assign the week.</span>
          )}
        </div>
        <button
          onClick={handleAssignWeek}
          disabled={stats.totalDocs === 0 || saving}
          className="bg-brand-600 hover:bg-brand-700 text-white px-6 py-2.5 rounded-xl font-semibold text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving…' : `Assign Week → ${stats.totalDocs || 0} Workout${stats.totalDocs !== 1 ? 's' : ''}`}
        </button>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}

// ── Cell renderer ─────────────────────────────────────────────────────────────

function Cell({ col, rowIdx, colIdx, value, typeOptions, cellRefs, onChange, onFocus, onKeyDown, isActive }) {
  const refKey = `${rowIdx}-${colIdx}`
  const setRef = (el) => { cellRefs.current[refKey] = el }

  const baseClasses =
    'w-full px-2 py-1.5 text-sm bg-transparent focus:outline-none focus:bg-brand-50/40 ' +
    (isActive ? 'ring-2 ring-inset ring-brand-500' : '')

  if (col.kind === 'select') {
    return (
      <select
        ref={setRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
        onKeyDown={onKeyDown}
        className={baseClasses + ' bg-white'}
      >
        {typeOptions.map((t) => (
          <option key={t.value} value={t.value}>{t.label}</option>
        ))}
      </select>
    )
  }

  if (col.kind === 'drills') {
    return (
      <select
        ref={setRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
        onKeyDown={onKeyDown}
        className={baseClasses + ' bg-white'}
      >
        <option value="">— none —</option>
        {DRILL_OPTIONS.map((d) => (
          <option key={d} value={d}>{d}</option>
        ))}
        {value && !DRILL_OPTIONS.includes(value) && (
          <option value={value}>{value}</option>
        )}
      </select>
    )
  }

  if (col.kind === 'textarea') {
    return (
      <textarea
        ref={setRef}
        value={value}
        rows={2}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
        onKeyDown={onKeyDown}
        placeholder={col.label}
        className={baseClasses + ' resize-y leading-snug'}
        style={{ minHeight: 38 }}
      />
    )
  }

  return (
    <input
      ref={setRef}
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onFocus={onFocus}
      onKeyDown={onKeyDown}
      placeholder={col.label}
      className={baseClasses}
    />
  )
}

// ── Recipients cell (per-row override) ────────────────────────────────────────

function RecipientsCell({ row, rowIdx, runners, groups, defaultCount, isOpen, onOpen, onChange }) {
  const usingDefault = row.recipients === null
  const count = usingDefault ? defaultCount : row.recipients.length
  const popoverRef = useRef(null)

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return
    function onDocClick(e) {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        onOpen() // toggle closed
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [isOpen, onOpen])

  function toggleRunner(id) {
    const current = row.recipients ?? []
    onChange(current.includes(id) ? current.filter((x) => x !== id) : [...current, id])
  }

  function selectGroup(name) {
    const ids = runners.filter((r) => r.group === name).map((r) => r.id)
    onChange(ids)
  }

  return (
    <div className="relative">
      <button
        onClick={onOpen}
        className={`w-full text-left px-2 py-1.5 rounded-md border text-xs transition-colors ${
          usingDefault
            ? 'border-gray-200 text-gray-500 hover:border-gray-300 bg-gray-50'
            : 'border-brand-300 bg-brand-50 text-brand-800 font-medium'
        }`}
      >
        {usingDefault
          ? <>Default <span className="text-gray-400">({count})</span></>
          : <>Override <span className="text-brand-600">({count})</span></>}
      </button>

      {isOpen && (
        <div
          ref={popoverRef}
          className="absolute right-0 mt-1 z-30 w-72 bg-white border border-gray-200 rounded-xl shadow-lg p-3"
        >
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-gray-700">Recipients for {DAY_LABELS[rowIdx]}</p>
            {!usingDefault && (
              <button
                onClick={() => onChange(null)}
                className="text-[10px] text-gray-500 hover:text-brand-700 font-medium"
              >
                Use default
              </button>
            )}
          </div>

          {groups.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {groups.map((g) => (
                <button
                  key={g.id}
                  onClick={() => selectGroup(g.name)}
                  className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 hover:bg-brand-100 text-gray-700"
                >
                  {g.name}
                </button>
              ))}
              <button
                onClick={() => onChange(runners.map((r) => r.id))}
                className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 hover:bg-brand-100 text-gray-700"
              >
                All
              </button>
              <button
                onClick={() => onChange([])}
                className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 hover:bg-red-100 text-gray-700"
              >
                None
              </button>
            </div>
          )}

          <div className="max-h-56 overflow-y-auto space-y-0.5 pr-1">
            {runners.map((r) => {
              const checked = !usingDefault && row.recipients.includes(r.id)
              return (
                <label
                  key={r.id}
                  className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-gray-50 cursor-pointer text-xs"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleRunner(r.id)}
                    className="w-3 h-3 text-brand-600 rounded"
                  />
                  <span className="text-gray-800">{r.name}</span>
                  {r.group && <span className="text-gray-400 text-[10px] ml-auto">{r.group}</span>}
                </label>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
