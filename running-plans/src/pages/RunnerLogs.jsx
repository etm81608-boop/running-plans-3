import { useEffect, useState, useMemo } from 'react'
import { collection, getDocs, orderBy, query, doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase/config'
import {
  format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval,
  startOfWeek, endOfWeek, isSameMonth, isToday, addMonths,
} from 'date-fns'

const DAY_HEADERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

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

  // ── Calendar state ────────────────────────────────────────────────────────
  const [viewMonth,   setViewMonth]   = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(null)  // 'yyyy-MM-dd'
  const [selectedLog,  setSelectedLog]  = useState(null)  // log object

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(viewMonth)
    const monthEnd   = endOfMonth(viewMonth)
    const calStart   = startOfWeek(monthStart, { weekStartsOn: 0 })
    const calEnd     = endOfWeek(monthEnd,     { weekStartsOn: 0 })
    return eachDayOfInterval({ start: calStart, end: calEnd })
  }, [viewMonth])

  function handleDayClick(dateStr) {
    const logs = byDate[dateStr]
    if (!logs || logs.length === 0) return
    setSelectedDate(dateStr)
    setSelectedLog(null)
  }

  const logsForSelected = selectedDate ? (byDate[selectedDate] || []) : []

  return (
    <div className="p-8">

      {/* Header */}
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900">Runner Logs</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Click any highlighted day to see who responded
        </p>
      </div>

      {/* Runner tabs */}
      {!loading && runners.length > 0 && (
        <div className="mb-5 overflow-x-auto">
          <div className="flex gap-0 border-b border-gray-200 min-w-max">
            <TabButton label="All Runners" active={isAllView} onClick={() => { setSelectedRunner('__all__'); setSelectedDate(null); setSelectedLog(null) }} />
            {runners.map((name) => (
              <TabButton key={name} label={name} active={selectedRunner === name}
                onClick={() => { setSelectedRunner(name); setSelectedDate(null); setSelectedLog(null) }} />
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-3 py-12 justify-center text-gray-400">
          <div className="w-5 h-5 border-2 border-emerald-300 border-t-emerald-600 rounded-full animate-spin" />
          Loading logs…
        </div>
      ) : (
        <div className="flex gap-6 items-start">

          {/* ── Calendar ── */}
          <div className="flex-1 min-w-0 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

            {/* Month navigation */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <button
                onClick={() => { setViewMonth((m) => addMonths(m, -1)); setSelectedDate(null); setSelectedLog(null) }}
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-900 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h2 className="text-base font-bold text-gray-900">
                {format(viewMonth, 'MMMM yyyy')}
              </h2>
              <button
                onClick={() => { setViewMonth((m) => addMonths(m, 1)); setSelectedDate(null); setSelectedLog(null) }}
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-900 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            {/* Day-of-week headers */}
            <div className="grid grid-cols-7 border-b border-gray-100">
              {DAY_HEADERS.map((d) => (
                <div key={d} className="py-2 text-center text-xs font-bold text-gray-400 uppercase tracking-wider">
                  {d}
                </div>
              ))}
            </div>

            {/* Day cells */}
            <div className="grid grid-cols-7">
              {calendarDays.map((day) => {
                const dateStr      = format(day, 'yyyy-MM-dd')
                const logs         = byDate[dateStr] || []
                const count        = logs.length
                const inMonth      = isSameMonth(day, viewMonth)
                const today        = isToday(day)
                const isSelected   = selectedDate === dateStr
                const clickable    = count > 0

                return (
                  <div
                    key={dateStr}
                    onClick={() => handleDayClick(dateStr)}
                    className={`relative min-h-[72px] p-2 border-b border-r border-gray-50 transition-colors
                      ${!inMonth ? 'bg-gray-50/60' : 'bg-white'}
                      ${clickable ? 'cursor-pointer' : 'cursor-default'}
                      ${isSelected ? 'ring-2 ring-inset ring-emerald-500' : ''}
                      ${clickable && !isSelected ? 'hover:bg-emerald-50/50' : ''}
                    `}
                  >
                    {/* Day number */}
                    <div className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-semibold
                      ${today ? 'bg-emerald-600 text-white' : inMonth ? 'text-gray-800' : 'text-gray-300'}
                    `}>
                      {format(day, 'd')}
                    </div>

                    {/* Response count badge — top right */}
                    {count > 0 && (
                      <div className={`absolute top-2 right-2 min-w-[20px] h-5 px-1.5 rounded-full flex items-center justify-center text-xs font-bold
                        ${isSelected ? 'bg-emerald-600 text-white' : 'bg-emerald-100 text-emerald-700'}
                      `}>
                        {count}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── Detail panel ── */}
          {selectedDate ? (
            <div className="w-96 flex-shrink-0">
              {selectedLog ? (
                /* Log detail view */
                <div>
                  <button
                    onClick={() => setSelectedLog(null)}
                    className="flex items-center gap-1.5 text-sm text-emerald-700 font-semibold hover:text-emerald-900 mb-4 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Back to {format(parseISO(selectedDate + 'T12:00:00'), 'MMM d')}
                  </button>
                  <LogCard
                    log={selectedLog}
                    assignment={getAssignment(selectedLog)}
                    showRunner
                    defaultWorkoutOpen={false}
                  />
                </div>
              ) : (
                /* Runner list for this day */
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-100">
                    <p className="text-xs font-bold text-emerald-600 uppercase tracking-widest mb-0.5">
                      {format(parseISO(selectedDate + 'T12:00:00'), 'EEEE, MMMM d')}
                    </p>
                    <p className="text-sm text-gray-500">
                      {logsForSelected.length} response{logsForSelected.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {logsForSelected.map((log) => (
                      <button
                        key={log.id}
                        onClick={() => setSelectedLog(log)}
                        className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-emerald-50 transition-colors text-left group"
                      >
                        <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700 font-black text-xs flex-shrink-0">
                          {log.runnerName?.trim().split(/\s+/).map((w) => w[0]?.toUpperCase()).join('') || '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 text-sm">{log.runnerName || 'Unknown'}</p>
                          {log.rpe != null && log.rpe !== '' && (
                            <p className="text-xs text-gray-400">RPE {log.rpe}/10</p>
                          )}
                        </div>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-300 group-hover:text-emerald-500 transition-colors flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="w-96 flex-shrink-0 bg-white rounded-2xl border border-gray-100 shadow-sm flex items-center justify-center py-16">
              <p className="text-sm text-gray-400 text-center px-6">
                Click a highlighted day on the calendar to see who responded
              </p>
            </div>
          )}

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

  // ── Coach comment state ───────────────────────────────────────────────────
  const [commentDraft,  setCommentDraft]  = useState(log.coachComment || '')
  const [savedComment,  setSavedComment]  = useState(log.coachComment || '')
  const [savingComment, setSavingComment] = useState(false)
  const [commentError,  setCommentError]  = useState('')

  async function handleSaveComment() {
    if (!commentDraft.trim() && !savedComment) return
    setSavingComment(true)
    setCommentError('')
    try {
      await updateDoc(doc(db, 'workoutLogs', log.id), {
        coachComment:    commentDraft.trim() || null,
        coachCommentedAt: serverTimestamp(),
      })
      setSavedComment(commentDraft.trim())
    } catch (err) {
      setCommentError('Could not save. Try again.')
    } finally {
      setSavingComment(false)
    }
  }

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

        {/* ── Coach Comment ── */}
        <div className="border-t border-gray-100 pt-3 mt-1">
          <p className="text-xs font-black text-indigo-500 uppercase tracking-widest mb-2">
            💬 Note to Runner
          </p>
          {savedComment && commentDraft === savedComment && (
            <div className="bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2 mb-2 flex items-start justify-between gap-2">
              <p className="text-sm text-indigo-800 leading-relaxed flex-1">{savedComment}</p>
              <button
                onClick={() => setCommentDraft('')}
                className="text-xs text-indigo-300 hover:text-indigo-600 font-semibold flex-shrink-0 transition-colors"
                title="Clear note"
              >
                ✕
              </button>
            </div>
          )}
          <div className="flex gap-2 items-start">
            <textarea
              value={commentDraft}
              onChange={(e) => setCommentDraft(e.target.value)}
              placeholder="Leave a note for this runner about this workout…"
              rows={2}
              className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none placeholder-gray-300"
            />
            <button
              onClick={handleSaveComment}
              disabled={savingComment || commentDraft === savedComment}
              className="px-3 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 text-white text-xs font-black rounded-lg transition-colors flex-shrink-0"
            >
              {savingComment ? '…' : savedComment && commentDraft === savedComment ? '✓ Saved' : 'Save'}
            </button>
          </div>
          {commentError && <p className="text-xs text-red-400 mt-1">{commentError}</p>}
        </div>

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
