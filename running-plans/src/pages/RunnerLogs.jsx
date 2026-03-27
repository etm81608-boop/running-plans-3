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
  const [allLogs,        setAllLogs]        = useState([])
  const [assignById,     setAssignById]     = useState({})
  const [assignByKey,    setAssignByKey]    = useState({}) // runnerId_date fallback
  const [loading,        setLoading]        = useState(true)
  const [selectedRunner, setSelectedRunner] = useState('__all__')
  const [dateFrom,       setDateFrom]       = useState('')
  const [dateTo,         setDateTo]         = useState('')

  useEffect(() => {
    async function load() {
      // ── Load workout logs ──────────────────────────────────────────────────
      const logSnap = await getDocs(
        query(collection(db, 'workoutLogs'), orderBy('date', 'desc'))
      )
      const docs = logSnap.docs.map((d) => ({ id: d.id, ...d.data() }))

      // Keep only the latest log per assignmentId
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

      // ── Load assignments ───────────────────────────────────────────────────
      const assignSnap = await getDocs(collection(db, 'assignments'))
      const byId  = {}
      const byKey = {}
      assignSnap.docs.forEach((d) => {
        const a = { id: d.id, ...d.data() }
        byId[d.id] = a
        if (a.runnerId && a.date) {
          byKey[`${a.runnerId}_${a.date}`] = a
        }
      })
      setAssignById(byId)
      setAssignByKey(byKey)

      setLoading(false)
    }
    load()
  }, [])

  // ── Unique runner list (alphabetical) ─────────────────────────────────────
  const runners = useMemo(() => {
    const map = {}
    allLogs.forEach((log) => {
      if (log.runnerName && !map[log.runnerName]) {
        map[log.runnerName] = log.runnerName
      }
    })
    return Object.keys(map).sort((a, b) => a.localeCompare(b))
  }, [allLogs])

  // ── Filter by selected runner + date range ────────────────────────────────
  const filtered = useMemo(() => {
    return allLogs.filter((log) => {
      if (selectedRunner !== '__all__' && log.runnerName !== selectedRunner) return false
      if (dateFrom && log.date < dateFrom) return false
      if (dateTo   && log.date > dateTo)   return false
      return true
    })
  }, [allLogs, selectedRunner, dateFrom, dateTo])

  // ── Group by date ─────────────────────────────────────────────────────────
  const byDate = useMemo(() => {
    const map = {}
    filtered.forEach((log) => {
      const d = log.date || 'Unknown'
      if (!map[d]) map[d] = []
      map[d].push(log)
    })
    Object.values(map).forEach((arr) =>
      arr.sort((a, b) => (a.runnerName || '').localeCompare(b.runnerName || ''))
    )
    return map
  }, [filtered])

  const sortedDates = Object.keys(byDate).sort((a, b) => b.localeCompare(a))

  // ── Look up assignment for a log ──────────────────────────────────────────
  function getAssignment(log) {
    if (log.assignmentId && assignById[log.assignmentId]) {
      return assignById[log.assignmentId]
    }
    if (log.runnerId && log.date) {
      return assignByKey[`${log.runnerId}_${log.date}`] || null
    }
    return null
  }

  const isAllView = selectedRunner === '__all__'

  return (
    <div className="p-8 max-w-5xl">

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Runner Logs</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          All submitted workout logs · most recent edit shown per day
        </p>
      </div>

      {/* Athlete tabs */}
      {!loading && runners.length > 0 && (
        <div className="mb-0 overflow-x-auto">
          <div className="flex gap-0 border-b border-gray-200 min-w-max">
            <TabButton
              label="All Runners"
              active={isAllView}
              onClick={() => setSelectedRunner('__all__')}
            />
            {runners.map((name) => (
              <TabButton
                key={name}
                label={name}
                active={selectedRunner === name}
                onClick={() => setSelectedRunner(name)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Date filters */}
      <div className="flex flex-wrap gap-3 mt-5 mb-6">
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
        {(dateFrom || dateTo) && (
          <button
            onClick={() => { setDateFrom(''); setDateTo('') }}
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
                {isAllView && (
                  <span className="text-xs text-gray-400">
                    {byDate[dateStr].length} runner{byDate[dateStr].length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>

              {/* Log cards */}
              <div className="space-y-4">
                {byDate[dateStr].map((log) => (
                  <LogCard
                    key={log.id}
                    log={log}
                    assignment={getAssignment(log)}
                    showRunner={isAllView}
                    defaultWorkoutOpen={!isAllView}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Tab Button ────────────────────────────────────────────────────────────────

function TabButton({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2.5 text-sm font-semibold whitespace-nowrap transition-all border-b-2 -mb-px ${
        active
          ? 'border-brand-600 text-brand-700 bg-white'
          : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300'
      }`}
    >
      {label}
    </button>
  )
}

// ── Log Card ──────────────────────────────────────────────────────────────────

function LogCard({ log, assignment, showRunner, defaultWorkoutOpen }) {
  const hasSplits   = log.splits && log.splits.length > 0
  const submittedAt = log.updatedAt || log.submittedAt
  const wasEdited   = !!log.updatedAt

  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">

      {/* Assigned workout panel (above the log) */}
      {assignment && (
        <AssignedWorkoutPanel assignment={assignment} defaultOpen={defaultWorkoutOpen} />
      )}

      {/* Top bar — runner name + timestamp */}
      <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-100">
        <div className="flex items-center gap-3">
          {showRunner ? (
            <>
              <div className="w-8 h-8 rounded-lg bg-brand-100 flex items-center justify-center text-brand-700 font-black text-xs flex-shrink-0">
                {log.runnerName?.trim().split(/\s+/).map((w) => w[0]?.toUpperCase()).join('') || '?'}
              </div>
              <p className="font-bold text-gray-900 text-sm">{log.runnerName || 'Unknown Runner'}</p>
            </>
          ) : (
            <p className="text-xs font-black text-gray-500 uppercase tracking-widest">Runner's Log</p>
          )}
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

        {log.actualActivity && (
          <p className="text-sm text-gray-800 leading-relaxed">{log.actualActivity}</p>
        )}

        <div className="flex flex-wrap gap-4">
          {log.distance     && <Stat label="Distance"    value={log.distance}              />}
          {log.duration     && <Stat label="Time"        value={log.duration}              />}
          {log.avgPace      && <Stat label="Avg Pace"    value={log.avgPace}               />}
          {log.avgHeartRate && <Stat label="Avg HR"      value={log.avgHeartRate}          />}
          {log.rpe != null && log.rpe !== '' && (
            <Stat label="Effort (RPE)" value={`${log.rpe} / 10`} accent />
          )}
        </div>

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

        {log.notes && (
          <div className="bg-amber-50 border border-amber-100 rounded-lg px-4 py-3">
            <p className="text-xs font-black text-amber-600 uppercase tracking-widest mb-1">Notes for Coach</p>
            <p className="text-sm text-gray-700 leading-relaxed">{log.notes}</p>
          </div>
        )}

        {!log.actualActivity && !log.distance && !log.avgPace && !log.rpe && !hasSplits && !log.notes && (
          <p className="text-sm text-gray-400 italic">No details recorded.</p>
        )}
      </div>
    </div>
  )
}

// ── Assigned Workout Panel ────────────────────────────────────────────────────

function AssignedWorkoutPanel({ assignment, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)

  const hasDetail =
    assignment.warmup          ||
    assignment.drills          ||
    assignment.additionalWarmup ||
    assignment.mainWorkout     ||
    assignment.cooldown        ||
    assignment.notes

  return (
    <div className="border-b border-blue-100 bg-blue-50">
      {/* Header row — always visible */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-2.5 text-left group"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-black text-blue-500 uppercase tracking-widest">
            📋 Assigned Workout
          </span>
          {assignment.workoutTitle && (
            <span className="text-xs font-semibold text-blue-800">
              {assignment.workoutTitle}
            </span>
          )}
          {assignment.workoutType && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-600 font-medium capitalize">
              {assignment.workoutType.replace(/_/g, ' ')}
            </span>
          )}
        </div>
        {hasDetail && (
          <span className="text-xs text-blue-400 font-semibold ml-4 shrink-0 group-hover:text-blue-600 transition-colors">
            {open ? '▲ Hide' : '▼ Show'}
          </span>
        )}
      </button>

      {/* Expandable detail */}
      {open && hasDetail && (
        <div className="px-5 pb-4 space-y-3 border-t border-blue-100">
          {assignment.warmup && (
            <WorkoutSection label="Warm-Up" content={assignment.warmup} />
          )}
          {assignment.drills && (
            <WorkoutSection label="Drills" content={assignment.drills} />
          )}
          {assignment.additionalWarmup && (
            <WorkoutSection label="Additional Warm-Up" content={assignment.additionalWarmup} />
          )}
          {assignment.mainWorkout && (
            <WorkoutSection label="Main Workout" content={assignment.mainWorkout} highlight />
          )}
          {assignment.cooldown && (
            <WorkoutSection label="Cool-Down" content={assignment.cooldown} />
          )}
          {assignment.notes && (
            <WorkoutSection label="Coach Notes" content={assignment.notes} />
          )}
        </div>
      )}
    </div>
  )
}

function WorkoutSection({ label, content, highlight = false }) {
  return (
    <div className="pt-3">
      <p className={`text-xs font-black uppercase tracking-widest mb-1 ${
        highlight ? 'text-blue-700' : 'text-blue-400'
      }`}>
        {label}
      </p>
      <p className={`text-sm leading-relaxed whitespace-pre-wrap ${
        highlight ? 'text-gray-900 font-medium' : 'text-gray-600'
      }`}>
        {content}
      </p>
    </div>
  )
}

// ── Stat chip ─────────────────────────────────────────────────────────────────

function Stat({ label, value, accent = false }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{label}</p>
      <p className={`text-sm font-black ${accent ? 'text-brand-600' : 'text-gray-800'}`}>{value}</p>
    </div>
  )
}
