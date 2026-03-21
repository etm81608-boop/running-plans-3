import { useMemo, useState } from 'react'
import { useCollection } from '../hooks/useCollection'
import { format } from 'date-fns'

const RPE_LABELS = {
  1: 'Very Easy', 2: 'Easy', 3: 'Moderate', 4: 'Somewhat Hard',
  5: 'Hard', 6: 'Hard+', 7: 'Very Hard', 8: 'Very Hard+',
  9: 'Max Effort', 10: 'All Out',
}

function rpeColor(rpe) {
  if (!rpe) return 'bg-gray-100 text-gray-500'
  if (rpe <= 3) return 'bg-green-100 text-green-700'
  if (rpe <= 5) return 'bg-yellow-100 text-yellow-700'
  if (rpe <= 7) return 'bg-orange-100 text-orange-700'
  return 'bg-red-100 text-red-700'
}

export default function RunnerLogs() {
  const { docs: logs,    loading: logsLoading }    = useCollection('workoutLogs',  'submittedAt')
  const { docs: runners, loading: runnersLoading } = useCollection('runners',      'name')

  const [filterRunner, setFilterRunner] = useState('')
  const [search,       setSearch]       = useState('')

  const sortedLogs = useMemo(() => {
    return [...logs].sort((a, b) => {
      // Sort by date descending
      if (a.date > b.date) return -1
      if (a.date < b.date) return  1
      return 0
    })
  }, [logs])

  const filtered = useMemo(() => {
    return sortedLogs.filter((log) => {
      if (filterRunner && log.runnerId !== filterRunner) return false
      if (search) {
        const q = search.toLowerCase()
        return (
          log.runnerName?.toLowerCase().includes(q) ||
          log.actualActivity?.toLowerCase().includes(q) ||
          log.notes?.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [sortedLogs, filterRunner, search])

  const loading = logsLoading || runnersLoading

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Runner Logs</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Activity logs submitted by your runners via their workout links.
        </p>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <select
          value={filterRunner}
          onChange={(e) => setFilterRunner(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white"
        >
          <option value="">All runners</option>
          {runners.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>

        <input
          type="text"
          placeholder="Search logs…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-400 flex-1 min-w-48"
        />

        <div className="flex items-center gap-2 ml-auto">
          <span className="text-sm text-gray-500">
            {filtered.length} log{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-center py-16 text-gray-400">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <span className="text-5xl">📋</span>
          <p className="mt-4 text-gray-500 font-medium">No logs yet</p>
          <p className="text-sm text-gray-400 mt-1">
            {logs.length === 0
              ? 'Logs will appear here once runners submit their activity via workout links.'
              : 'No logs match your current filter.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((log) => (
            <LogCard key={log.id} log={log} />
          ))}
        </div>
      )}
    </div>
  )
}

function LogCard({ log }) {
  const [expanded, setExpanded] = useState(false)

  const dateStr = log.date
    ? format(new Date(log.date + 'T12:00:00'), 'EEE, MMM d, yyyy')
    : '—'

  const submittedStr = log.submittedAt?.toDate
    ? format(log.submittedAt.toDate(), 'MMM d · h:mm a')
    : null

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Card header — always visible */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left px-5 py-4 flex items-center gap-4 hover:bg-gray-50 transition-colors"
      >
        {/* Runner initial bubble */}
        <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0">
          <span className="text-sm font-bold text-brand-700">
            {log.runnerName?.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase() || '?'}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-900">{log.runnerName || 'Unknown'}</span>
            <span className="text-gray-400 text-sm">·</span>
            <span className="text-sm text-gray-500">{dateStr}</span>
            {log.rpe && (
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${rpeColor(log.rpe)}`}>
                RPE {log.rpe} — {RPE_LABELS[log.rpe]}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-600 mt-0.5 truncate">{log.actualActivity}</p>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          {(log.distance || log.duration) && (
            <div className="text-right hidden sm:block">
              {log.distance && <p className="text-xs font-medium text-gray-700">{log.distance}</p>}
              {log.duration && <p className="text-xs text-gray-400">{log.duration}</p>}
            </div>
          )}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className={`h-4 w-4 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-gray-100 px-5 py-4 bg-gray-50 space-y-3">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">What they did</p>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{log.actualActivity}</p>
          </div>

          {(log.distance || log.duration) && (
            <div className="flex gap-6">
              {log.distance && (
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-0.5">Distance</p>
                  <p className="text-sm text-gray-700">{log.distance}</p>
                </div>
              )}
              {log.duration && (
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-0.5">Time</p>
                  <p className="text-sm text-gray-700">{log.duration}</p>
                </div>
              )}
              {log.rpe && (
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-0.5">Effort</p>
                  <span className={`text-sm font-semibold px-2 py-0.5 rounded-full ${rpeColor(log.rpe)}`}>
                    {log.rpe}/10 — {RPE_LABELS[log.rpe]}
                  </span>
                </div>
              )}
            </div>
          )}

          {log.notes && (
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Runner notes</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{log.notes}</p>
            </div>
          )}

          {submittedStr && (
            <p className="text-xs text-gray-400 pt-1 border-t border-gray-200">Submitted {submittedStr}</p>
          )}
        </div>
      )}
    </div>
  )
}
