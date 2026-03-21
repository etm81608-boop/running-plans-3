import { useMemo, useState } from 'react'
import { useCollection } from '../hooks/useCollection'
import { format, parseISO } from 'date-fns'

const RPE_LABELS = {
  1:'Very Easy', 2:'Easy', 3:'Moderate', 4:'Somewhat Hard',
  5:'Hard', 6:'Hard+', 7:'Very Hard', 8:'Very Hard+',
  9:'Max Effort', 10:'All Out',
}

function rpeColor(rpe) {
  if (!rpe) return 'bg-gray-100 text-gray-500'
  if (rpe <= 3) return 'bg-green-100 text-green-700'
  if (rpe <= 5) return 'bg-yellow-100 text-yellow-700'
  if (rpe <= 7) return 'bg-orange-100 text-orange-700'
  return 'bg-red-100 text-red-700'
}

function fmtDate(dateStr) {
  if (!dateStr) return ''
  try { return format(parseISO(dateStr + 'T12:00:00'), 'EEE, MMM d yyyy') } catch { return dateStr }
}

// Escape a value for CSV
function csvCell(val) {
  if (val === null || val === undefined) return ''
  const s = String(val).replace(/"/g, '""')
  return s.includes(',') || s.includes('\n') || s.includes('"') ? `"${s}"` : s
}

function buildCSV(rows) {
  const headers = [
    'Runner Name', 'Date',
    'Warmup', 'Main Workout', 'Cool-Down', 'Cross Training', 'Coach Notes',
    'Logged?', 'What Runner Did', 'Distance', 'Time', 'RPE', 'Runner Notes', 'Submitted At',
  ]
  const lines = [headers.join(',')]
  rows.forEach((r) => {
    lines.push([
      r.runnerName, r.date,
      r.warmup, r.mainWorkout, r.cooldown, r.crossTraining, r.coachNotes,
      r.logged ? 'Yes' : 'No',
      r.actualActivity, r.distance, r.duration,
      r.rpe ? `${r.rpe}/10` : '', r.runnerNotes, r.submittedAt,
    ].map(csvCell).join(','))
  })
  return lines.join('\n')
}

function downloadCSV(content, filename) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function DataExport() {
  const { docs: assignments, loading: aLoading } = useCollection('assignments',  'date')
  const { docs: logs,        loading: lLoading } = useCollection('workoutLogs',  'submittedAt')
  const { docs: runners,     loading: rLoading } = useCollection('runners',      'name')

  const [selectedRunner, setSelectedRunner] = useState('')
  const [search,         setSearch]         = useState('')

  const loading = aLoading || lLoading || rLoading

  // Build a map: assignmentId → log
  const logByAssignment = useMemo(() => {
    const map = {}
    logs.forEach((l) => { if (l.assignmentId) map[l.assignmentId] = l })
    return map
  }, [logs])

  // Merge assignments + logs into unified rows
  const mergedRows = useMemo(() => {
    return assignments
      .filter((a) => a.date)
      .map((a) => {
        const log = logByAssignment[a.id]
        return {
          id:             a.id,
          runnerName:     a.runnerName || '',
          runnerId:       a.runnerId   || '',
          date:           a.date,
          warmup:         a.warmup         || '',
          mainWorkout:    a.mainWorkout    || '',
          cooldown:       a.cooldown       || '',
          crossTraining:  a.crossTraining  || '',
          coachNotes:     a.notes          || '',
          logged:         !!log,
          actualActivity: log?.actualActivity || '',
          distance:       log?.distance       || '',
          duration:       log?.duration       || '',
          rpe:            log?.rpe            || null,
          runnerNotes:    log?.notes          || '',
          submittedAt:    log?.submittedAt?.toDate
            ? format(log.submittedAt.toDate(), 'M/d/yyyy h:mm a')
            : '',
        }
      })
      .sort((a, b) => {
        // Sort by runner name, then date
        const nc = a.runnerName.localeCompare(b.runnerName)
        return nc !== 0 ? nc : a.date.localeCompare(b.date)
      })
  }, [assignments, logByAssignment])

  // Filtered rows based on selected runner + search text
  const filteredRows = useMemo(() => {
    return mergedRows.filter((r) => {
      if (selectedRunner && r.runnerId !== selectedRunner) return false
      if (search) {
        const q = search.toLowerCase()
        return (
          r.runnerName.toLowerCase().includes(q) ||
          r.mainWorkout.toLowerCase().includes(q) ||
          r.actualActivity.toLowerCase().includes(q) ||
          r.date.includes(q)
        )
      }
      return true
    })
  }, [mergedRows, selectedRunner, search])

  // Stats for the selected view
  const stats = useMemo(() => {
    const total   = filteredRows.length
    const logged  = filteredRows.filter((r) => r.logged).length
    const runners = new Set(filteredRows.map((r) => r.runnerId)).size
    return { total, logged, runners }
  }, [filteredRows])

  function handleExport() {
    const csv      = buildCSV(filteredRows)
    const runnerLabel = selectedRunner
      ? runners.find((r) => r.id === selectedRunner)?.name?.replace(/\s+/g, '_') || 'runner'
      : 'all_runners'
    const date     = format(new Date(), 'yyyy-MM-dd')
    downloadCSV(csv, `workouts_${runnerLabel}_${date}.csv`)
  }

  if (loading) return (
    <div className="p-8 text-gray-400">Loading data…</div>
  )

  return (
    <div className="p-8 max-w-7xl">

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Data Export</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Search by runner to see their workouts and log entries together. Download as CSV to save to an external drive.
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-end gap-3 mb-5">
        {/* Runner filter */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Filter by Runner</label>
          <select
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 min-w-[200px]"
            value={selectedRunner}
            onChange={(e) => setSelectedRunner(e.target.value)}
          >
            <option value="">All Runners</option>
            {runners.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>

        {/* Text search */}
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-semibold text-gray-600 mb-1">Search</label>
          <input
            type="text"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            placeholder="Search workouts, activities, dates…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Export button */}
        <button
          onClick={handleExport}
          disabled={filteredRows.length === 0}
          className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Download CSV {filteredRows.length > 0 && `(${filteredRows.length} rows)`}
        </button>
      </div>

      {/* Stats bar */}
      <div className="flex gap-6 mb-5 text-sm text-gray-500">
        <span><strong className="text-gray-900">{stats.runners}</strong> runner{stats.runners !== 1 ? 's' : ''}</span>
        <span><strong className="text-gray-900">{stats.total}</strong> workout{stats.total !== 1 ? 's' : ''}</span>
        <span><strong className="text-emerald-600">{stats.logged}</strong> logged ({stats.total > 0 ? Math.round(stats.logged / stats.total * 100) : 0}%)</span>
        <span className="text-gray-400">{stats.total - stats.logged} not yet logged</span>
      </div>

      {/* Results */}
      {filteredRows.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center text-gray-400">
          No workouts found for the selected filters.
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRows.map((row) => (
            <RunnerWorkoutRow key={row.id} row={row} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Single row: workout + log side by side ────────────────────────────────────

function RunnerWorkoutRow({ row }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

      {/* Summary row — always visible */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left px-5 py-4 flex items-center gap-4 hover:bg-gray-50 transition-colors"
      >
        {/* Runner + date */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-900">{row.runnerName}</span>
            <span className="text-xs text-gray-400">·</span>
            <span className="text-sm text-gray-500">{fmtDate(row.date)}</span>
          </div>
          {row.mainWorkout && (
            <p className="text-sm text-gray-600 mt-0.5 truncate">⚡ {row.mainWorkout}</p>
          )}
        </div>

        {/* Log status */}
        <div className="flex-shrink-0 flex items-center gap-3">
          {row.logged ? (
            <>
              {row.rpe && (
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${rpeColor(row.rpe)}`}>
                  RPE {row.rpe}/10
                </span>
              )}
              <span className="text-xs bg-emerald-100 text-emerald-700 font-semibold px-2.5 py-0.5 rounded-full">
                ✓ Logged
              </span>
            </>
          ) : (
            <span className="text-xs bg-gray-100 text-gray-400 font-semibold px-2.5 py-0.5 rounded-full">
              Not logged
            </span>
          )}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className={`h-4 w-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Expanded detail */}
      {open && (
        <div className="border-t border-gray-100 grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-100">

          {/* Left: Assigned workout */}
          <div className="px-5 py-4 space-y-3">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Assigned Workout</p>
            {row.warmup && (
              <DetailBlock emoji="🔥" label="Warm-Up" value={row.warmup} />
            )}
            {row.mainWorkout && (
              <DetailBlock emoji="⚡" label="Main Workout" value={row.mainWorkout} />
            )}
            {row.cooldown && (
              <DetailBlock emoji="❄️" label="Cool-Down" value={row.cooldown} />
            )}
            {row.crossTraining && (
              <DetailBlock emoji="💪" label="Cross Training" value={row.crossTraining} />
            )}
            {row.coachNotes && (
              <DetailBlock emoji="📝" label="Coach Notes" value={row.coachNotes} />
            )}
            {!row.warmup && !row.mainWorkout && !row.cooldown && !row.crossTraining && !row.coachNotes && (
              <p className="text-xs text-gray-400 italic">Rest / recovery day</p>
            )}
          </div>

          {/* Right: Runner's log */}
          <div className="px-5 py-4 space-y-3">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Runner's Log</p>
            {row.logged ? (
              <>
                {row.actualActivity && (
                  <DetailBlock emoji="✏️" label="What they did" value={row.actualActivity} />
                )}
                <div className="flex gap-4 flex-wrap">
                  {row.distance && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500">Distance</p>
                      <p className="text-sm text-gray-800">{row.distance}</p>
                    </div>
                  )}
                  {row.duration && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500">Time</p>
                      <p className="text-sm text-gray-800">{row.duration}</p>
                    </div>
                  )}
                  {row.rpe && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500">Effort</p>
                      <span className={`text-sm font-semibold px-2 py-0.5 rounded-full ${rpeColor(row.rpe)}`}>
                        {row.rpe}/10 — {RPE_LABELS[row.rpe]}
                      </span>
                    </div>
                  )}
                </div>
                {row.runnerNotes && (
                  <DetailBlock emoji="💬" label="Runner's notes" value={row.runnerNotes} />
                )}
                {row.submittedAt && (
                  <p className="text-xs text-gray-400">Submitted {row.submittedAt}</p>
                )}
              </>
            ) : (
              <p className="text-xs text-gray-400 italic">Runner hasn't logged this workout yet.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function DetailBlock({ emoji, label, value }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 mb-0.5">{emoji} {label}</p>
      <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{value}</p>
    </div>
  )
}
