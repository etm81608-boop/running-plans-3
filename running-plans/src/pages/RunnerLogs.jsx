import { useEffect, useState, useMemo } from 'react'
import { collection, getDocs, orderBy, query } from 'firebase/firestore'
import { db } from '../firebase/config'
import { format, parseISO } from 'date-fns'

// ── Helpers ───────────────────────────────────────────────────────────────────

function toMillis(ts) {
  if (!ts) return 0
  if (typeof ts.toMillis === 'function') return ts.toMillis()
  if (ts.seconds) return ts.seconds * 1000
  return 0
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function RunnerLogs() {
  const [allLogs,   setAllLogs]   = useState([])
  const [loading,   setLoading]   = useState(true)
  const [search,    setSearch]    = useState('')
  const [dateFrom,  setDateFrom]  = useState('')
  const [dateTo,    setDateTo]    = useState('')

  useEffect(() => {
    async function load() {
      const snap = await getDocs(
        query(collection(db, 'workoutLogs'), orderBy('date', 'desc'))
      )
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }))

      // ── Keep only the latest log per assignmentId ──────────────────────────
      const latestByAssignment = {}
      docs.forEach((doc) => {
        const key = doc.assignmentId || doc.id
        const existing = latestByAssignment[key]
        const docTime  = toMillis(doc.updatedAt) || toMillis(doc.submittedAt)
        const prevTime = existing
          ? toMillis(existing.updatedAt) || toMillis(existing.submittedAt)
          : -1
        if (!existing || docTime > prevTime) {
          latestByAssignment[key] = doc
        }
      })

      const deduped = Object.values(latestByAssignment)
        .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      setAllLogs(deduped)
      setLoading(false)
    }
    load()
  }, [])

  const filtered = useMemo(() => {
    return allLogs.filter((log) => {
      if (search && !log.runnerName?.toLowerCase().includes(search.toLowerCase())) return false
      if (dateFrom && log.date < dateFrom) return false
      if (dateTo   && log.date > dateTo)   return false
      return true
    })
  }, [allLogs, search, dateFrom, dateTo])

  // Group by date for display
  const byDate = useMemo(() => {
    const map = {}
    filtered.forEach((log) => {
      const d = log.date || 'Unknown'
      if (!map[d]) map[d] = []
      map[d].push(log)
    })
    // Sort runners within each day alphabetically
    Object.values(map).forEach((arr) =>
      arr.sort((a, b) => (a.runnerName || '').localeCompare(b.runnerName || ''))
    )
    return map
  }, [filtered])

  const sortedDates = Object.keys(byDate).sort((a, b) => b.localeCompare(a))

  return (
    <div className="p-8 max-w-5xl">

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Runner Logs</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          All submitted workout logs · most recent edit shown per day
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <input
          type="text"
          placeholder="Search by runner name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-brand-400"
        />
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500 font-semibold uppercase tracking-wide">From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500 font-semibold uppercase tracking-wide">To</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
          />
        </div>
        {(search || dateFrom || dateTo) && (
          <button
            onClick={() => { setSearch(''); setDateFrom(''); setDateTo('') }}
            className="text-xs text-gray-400 hover:text-gray-700 font-semibold underline transition-colors"
          >
            Clear filters
          </button>
        )}
        <span className="ml-auto text-xs text-gray-400 self-center font-medium">
          {filtered.length} log{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center gap-3 py-12 justify-center text-gray-400">
          <div className="w-5 h-5 border-2 border-brand-300 border-t-brand-600 rounded-full animate-spin" />
          Loading logs…
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-xl p-12 text-center text-gray-400">
          No logs found.
        </div>
      ) : (
        <div className="space-y-8">
          {sortedDates.map((dateStr) => (
            <div key={dateStr}>
              {/* Date header */}
              <div className="flex items-center gap-3 mb-3">
                <h2 className="text-sm font-black text-gray-700 uppercase tracking-wide">
                  {dateStr !== 'Unknown'
                    ? format(parseISO(dateStr + 'T12:00:00'), 'EEEE, MMMM d, yyyy')
                    : 'Unknown Date'}
                </h2>
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-xs text-gray-400">{byDate[dateStr].length} runner{byDate[dateStr].length !== 1 ? 's' : ''}</span>
              </div>

              {/* Log cards for this date */}
              <div className="space-y-3">
                {byDate[dateStr].map((log) => (
                  <LogCard key={log.id} log={log} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Log Card ──────────────────────────────────────────────────────────────────

function LogCard({ log }) {
  const [expanded, setExpanded] = useState(false)
  const hasSplits  = log.splits && log.splits.length > 0
  const hasExtras  = hasSplits || log.notes
  const submittedAt = log.updatedAt || log.submittedAt
  const wasEdited   = !!log.updatedAt

  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">

      {/* Top bar — runner + date stamp */}
      <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-brand-100 flex items-center justify-center text-brand-700 font-black text-xs flex-shrink-0">
            {log.runnerName?.trim().split(/\s+/).map((w) => w[0]?.toUpperCase()).join('') || '?'}
          </div>
          <p className="font-bold text-gray-900 text-sm">{log.runnerName || 'Unknown Runner'}</p>
        </div>
        <div className="text-right">
          {submittedAt && (
            <p className="text-xs text-gray-400">
              {wasEdited ? '✏️ Edited' : 'Logged'}{' '}
              {toMillis(submittedAt)
                ? format(new Date(toMillis(submittedAt)), 'MMM d @ h:mm a')
                : ''}
            </p>
          )}
        </div>
      </div>

      {/* Main body */}
      <div className="px-5 py-4 space-y-3">

        {/* Activity description */}
        {log.actualActivity && (
          <p className="text-sm text-gray-800 leading-relaxed">{log.actualActivity}</p>
        )}

        {/* Stats row */}
        <div className="flex flex-wrap gap-4">
          {log.distance && (
            <Stat label="Distance" value={log.distance} />
          )}
          {log.duration && (
            <Stat label="Time" value={log.duration} />
          )}
          {log.avgPace && (
            <Stat label="Avg Pace" value={log.avgPace} />
          )}
          {log.avgHeartRate && (
            <Stat label="Avg HR" value={log.avgHeartRate} />
          )}
          {log.rpe != null && log.rpe !== '' && (
            <Stat label="Effort (RPE)" value={`${log.rpe} / 10`} accent />
          )}
        </div>

        {/* Splits — always shown if present */}
        {hasSplits && (
          <div>
            <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-2">Splits</p>
            <div className="flex flex-wrap gap-2">
              {log.splits.map((split, i) => (
                <div key={i} className="flex items-center gap-1.5 bg-brand-50 border border-brand-100 rounded-lg px-3 py-1">
                  <span className="text-xs text-brand-400 font-semibold">Lap {i + 1}</span>
                  <span className="text-sm font-black text-brand-700">{split}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        {log.notes && (
          <div className="bg-amber-50 border border-amber-100 rounded-lg px-4 py-3">
            <p className="text-xs font-black text-amber-600 uppercase tracking-widest mb-1">Notes for Coach</p>
            <p className="text-sm text-gray-700 leading-relaxed">{log.notes}</p>
          </div>
        )}

        {/* Nothing logged */}
        {!log.actualActivity && !log.distance && !log.avgPace && !log.rpe && !hasSplits && !log.notes && (
          <p className="text-sm text-gray-400 italic">No details recorded.</p>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value, accent = false }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{label}</p>
      <p className={`text-sm font-black ${accent ? 'text-brand-600' : 'text-gray-800'}`}>{value}</p>
    </div>
  )
}
