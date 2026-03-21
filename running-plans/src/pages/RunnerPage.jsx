import { useEffect, useState, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import {
  collection, query, where, getDocs, addDoc, serverTimestamp,
} from 'firebase/firestore'
import { db } from '../firebase/config'
import { format, parseISO, startOfDay, addDays, startOfWeek } from 'date-fns'

// ── Helpers ──────────────────────────────────────────────────────────────────

function getStoredLog(assignmentId) {
  try { return JSON.parse(localStorage.getItem(`wlog_${assignmentId}`) || 'null') } catch { return null }
}
function storeLog(assignmentId, data) {
  try { localStorage.setItem(`wlog_${assignmentId}`, JSON.stringify(data)) } catch {}
}

function getInitials(name = '') {
  return name.trim().split(/\s+/).map((w) => w[0]?.toUpperCase() ?? '').join('')
}

function getMondayOf(dateStr) {
  const d = parseISO(dateStr + 'T12:00:00')
  const mon = startOfWeek(d, { weekStartsOn: 1 })
  return mon.toISOString().split('T')[0]
}

function weekDays(mondayStr) {
  const base = parseISO(mondayStr + 'T12:00:00')
  return Array.from({ length: 7 }, (_, i) =>
    addDays(base, i).toISOString().split('T')[0]
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function RunnerPage() {
  const { runnerId } = useParams()
  const [assignments,  setAssignments]  = useState([])
  const [peersByDate,  setPeersByDate]  = useState({})
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState(null)
  const runnerName = assignments[0]?.runnerName || ''

  const LS_KEY = `logged_${runnerId}`
  const [loggedIds, setLoggedIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]') } catch { return [] }
  })
  // Which day's log form is open (dateStr or null)
  const [logOpenDate, setLogOpenDate] = useState(null)
  const [showPast,    setShowPast]    = useState(false)

  function markLogged(assignmentId) {
    setLoggedIds((prev) => {
      const next = [...prev, assignmentId]
      localStorage.setItem(LS_KEY, JSON.stringify(next))
      return next
    })
  }

  useEffect(() => {
    async function load() {
      try {
        const snap = await getDocs(
          query(collection(db, 'assignments'), where('runnerId', '==', runnerId))
        )
        const docs = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((a) => a.date)
          .sort((a, b) => a.date.localeCompare(b.date))
        setAssignments(docs)

        const myGroup = docs.find((a) => a.visibilityGroup)?.visibilityGroup
        if (myGroup) {
          const peerSnap = await getDocs(
            query(collection(db, 'assignments'), where('visibilityGroup', '==', myGroup))
          )
          const peerDocs = peerSnap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .filter((a) => a.date && a.runnerId !== runnerId)
          const map = {}
          peerDocs.forEach((a) => {
            if (!map[a.date]) map[a.date] = []
            map[a.date].push(a)
          })
          setPeersByDate(map)
        }
      } catch {
        setError('Unable to load your schedule. Please try again later.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [runnerId])

  const today = startOfDay(new Date()).toISOString().split('T')[0]

  const assignmentByDate = useMemo(() => {
    const map = {}
    assignments.forEach((a) => { if (a.date) map[a.date] = a })
    return map
  }, [assignments])

  const [currentMonday, setCurrentMonday] = useState(() => getMondayOf(today))
  const days = useMemo(() => weekDays(currentMonday), [currentMonday])

  const hasPrev = useMemo(
    () => assignments.some((a) => a.date < currentMonday),
    [assignments, currentMonday]
  )
  const hasNext = useMemo(
    () => assignments.some((a) => a.date > days[6]),
    [assignments, days]
  )

  function goNextWeek() {
    setCurrentMonday(addDays(parseISO(currentMonday + 'T12:00:00'), 7).toISOString().split('T')[0])
    setLogOpenDate(null)
  }
  function goPrevWeek() {
    setCurrentMonday(addDays(parseISO(currentMonday + 'T12:00:00'), -7).toISOString().split('T')[0])
    setLogOpenDate(null)
  }

  const upcomingCount = useMemo(
    () => assignments.filter((a) => a.date >= today).length,
    [assignments, today]
  )
  const pastAssignments = useMemo(
    () => [...assignments.filter((a) => a.date < currentMonday)].sort((a, b) => b.date.localeCompare(a.date)),
    [assignments, currentMonday]
  )

  if (loading) return (
    <div className="min-h-screen bg-gradient-to-br from-brand-800 to-brand-900 flex items-center justify-center">
      <p className="text-white/60">Loading your schedule…</p>
    </div>
  )

  if (error) return (
    <div className="min-h-screen bg-gradient-to-br from-brand-800 to-brand-900 flex items-center justify-center p-6">
      <div className="text-center text-white">
        <span className="text-5xl">🤔</span>
        <p className="mt-4 text-white/70">{error}</p>
      </div>
    </div>
  )

  const hasAnyWorkoutThisWeek = days.some((d) => assignmentByDate[d])

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-800 to-brand-900 px-4 py-8">

      {/* Header */}
      <div className="max-w-7xl mx-auto mb-6">
        <div className="bg-white/10 backdrop-blur rounded-3xl px-6 py-5 text-white flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-lg font-bold">
              {getInitials(runnerName) || '🏃'}
            </div>
            <div>
              <p className="text-white/60 text-sm">Your Schedule</p>
              <h1 className="text-2xl font-bold">{runnerName || 'Runner Schedule'}</h1>
            </div>
          </div>
          <div className="flex gap-5 text-sm text-white/70">
            <span>📅 {upcomingCount} upcoming</span>
            <span>✅ {loggedIds.length} logged</span>
          </div>
        </div>
      </div>

      {/* Weekly grid card */}
      <div className="max-w-7xl mx-auto mb-6">
        <div className="bg-white rounded-3xl shadow-xl overflow-hidden">

          {/* Week nav header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <button
              onClick={goPrevWeek}
              disabled={!hasPrev}
              className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 disabled:opacity-30 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <p className="text-base font-semibold text-gray-700">
              {format(parseISO(days[0] + 'T12:00:00'), 'MMM d')} — {format(parseISO(days[6] + 'T12:00:00'), 'MMM d, yyyy')}
            </p>
            <button
              onClick={goNextWeek}
              disabled={!hasNext}
              className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 disabled:opacity-30 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* 7-column grid — horizontally scrollable on small screens */}
          <div className="overflow-x-auto">
            <div className="grid grid-cols-7 min-w-[700px]">

              {/* Row 1: Date headers */}
              {days.map((dateStr) => {
                const d       = parseISO(dateStr + 'T12:00:00')
                const isToday = dateStr === today
                const isPast  = dateStr < today
                const hasWkt  = !!assignmentByDate[dateStr]

                return (
                  <div
                    key={dateStr}
                    className={`text-center py-3 px-2 border-b border-r border-gray-100 last:border-r-0 ${
                      isToday
                        ? 'bg-brand-600 text-white'
                        : hasWkt && !isPast
                          ? 'bg-brand-50 text-brand-700'
                          : isPast
                            ? 'bg-gray-50 text-gray-500'
                            : 'bg-gray-50 text-gray-300'
                    }`}
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide opacity-80">
                      {format(d, 'EEE')}
                    </p>
                    <p className="text-2xl font-bold leading-none mt-0.5">
                      {format(d, 'd')}
                    </p>
                    <p className="text-xs opacity-70 mt-0.5">
                      {format(d, 'MMM')}
                    </p>
                  </div>
                )
              })}

              {/* Row 2: Workout content */}
              {days.map((dateStr) => {
                const a      = assignmentByDate[dateStr]
                const isPast = dateStr < today
                const isToday = dateStr === today
                const isLogged = a ? loggedIds.includes(a.id) : false
                const logOpen  = logOpenDate === dateStr

                return (
                  <div
                    key={dateStr}
                    className={`border-r border-gray-100 last:border-r-0 flex flex-col ${
                      isToday ? 'bg-brand-50/40' : 'bg-white'
                    }`}
                  >
                    {a ? (
                      <div className="flex-1 flex flex-col p-3 gap-2">

                        {/* Status badge */}
                        <div className="flex justify-center">
                          {isLogged
                            ? <span className="text-xs bg-emerald-100 text-emerald-700 font-semibold px-2 py-0.5 rounded-full">✓ Logged</span>
                            : isPast
                              ? <span className="text-xs bg-gray-100 text-gray-400 font-semibold px-2 py-0.5 rounded-full">Past</span>
                              : <span className="text-xs bg-brand-100 text-brand-700 font-semibold px-2 py-0.5 rounded-full">Upcoming</span>
                          }
                        </div>

                        {/* Workout blocks */}
                        {a.warmup && (
                          <DayBlock emoji="🔥" label="Warm-Up" content={a.warmup} bg="bg-green-50" border="border-green-200" text="text-green-800" />
                        )}
                        {a.mainWorkout && (
                          <DayBlock emoji="⚡" label="Main" content={a.mainWorkout} bg="bg-indigo-50" border="border-indigo-200" text="text-indigo-800" />
                        )}
                        {a.cooldown && (
                          <DayBlock emoji="❄️" label="Cool-Down" content={a.cooldown} bg="bg-blue-50" border="border-blue-200" text="text-blue-800" />
                        )}
                        {a.crossTraining && (
                          <DayBlock emoji="💪" label="Cross Train" content={a.crossTraining} bg="bg-teal-50" border="border-teal-200" text="text-teal-800" />
                        )}
                        {a.notes && (
                          <DayBlock emoji="📝" label="Notes" content={a.notes} bg="bg-amber-50" border="border-amber-200" text="text-amber-800" />
                        )}
                        {!a.warmup && !a.mainWorkout && !a.cooldown && !a.crossTraining && !a.notes && (
                          <p className="text-xs text-gray-400 text-center py-2 italic">Rest / recovery</p>
                        )}

                        {/* Training partners */}
                        {(peersByDate[dateStr] || []).length > 0 && (
                          <div className="mt-1 rounded-lg bg-indigo-50 border border-indigo-100 p-2">
                            <p className="text-xs font-bold text-indigo-500 mb-1">👯 Partners</p>
                            {peersByDate[dateStr].map((p) => (
                              <div key={p.id} className="text-xs text-indigo-700 font-medium truncate">
                                {p.runnerName}
                                {p.mainWorkout && (
                                  <span className="text-indigo-400 font-normal"> — {p.mainWorkout.slice(0, 40)}</span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Log section */}
                        <div className="mt-auto pt-2">
                          {isLogged ? (
                            <LogSummary assignmentId={a.id} />
                          ) : (
                            <>
                              {!logOpen && (
                                <button
                                  onClick={() => setLogOpenDate(dateStr)}
                                  className="w-full text-xs bg-emerald-600 hover:bg-emerald-700 text-white py-1.5 rounded-lg font-semibold transition-colors"
                                >
                                  📋 Log Activity
                                </button>
                              )}
                              {logOpen && (
                                <LogForm
                                  assignmentId={a.id}
                                  assignment={a}
                                  onLogged={() => {
                                    markLogged(a.id)
                                    setLogOpenDate(null)
                                  }}
                                  onCancel={() => setLogOpenDate(null)}
                                  compact
                                />
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1 flex items-center justify-center py-8">
                        <p className="text-xs text-gray-300 italic">Rest day</p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {!hasAnyWorkoutThisWeek && (
            <p className="text-center text-gray-400 text-sm py-6 px-4">
              No workouts scheduled this week
            </p>
          )}
        </div>
      </div>

      {/* Past workouts */}
      {pastAssignments.length > 0 && (
        <div className="max-w-7xl mx-auto mb-6">
          <button
            onClick={() => setShowPast((v) => !v)}
            className="w-full flex items-center justify-between bg-white/10 hover:bg-white/20 text-white rounded-2xl px-5 py-3 text-sm font-medium transition-colors"
          >
            <span>Past workouts ({pastAssignments.length})</span>
            <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 transition-transform ${showPast ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {showPast && (
            <div className="mt-2 space-y-2">
              {pastAssignments.map((a) => (
                <PastWorkoutCard
                  key={a.id}
                  assignment={a}
                  isLogged={loggedIds.includes(a.id)}
                  onLogged={() => markLogged(a.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <p className="text-center text-white/30 text-xs pb-4 max-w-7xl mx-auto">
        Team Running Plans · Episcopal Academy
      </p>
    </div>
  )
}

// ── Day Block ─────────────────────────────────────────────────────────────────

function DayBlock({ emoji, label, content, bg, border, text }) {
  return (
    <div className={`rounded-lg border p-2 ${bg} ${border}`}>
      <p className={`text-xs font-bold mb-0.5 ${text}`}>{emoji} {label}</p>
      <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">{content}</p>
    </div>
  )
}

// ── Log Summary ───────────────────────────────────────────────────────────────

function LogSummary({ assignmentId }) {
  const log = getStoredLog(assignmentId)
  if (!log) {
    return (
      <p className="text-xs text-emerald-600 font-semibold text-center py-1">
        ✅ Logged!
      </p>
    )
  }
  return (
    <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-2 space-y-1">
      <p className="text-xs font-bold text-emerald-600">✅ Your Log</p>
      {log.actualActivity && (
        <p className="text-xs text-gray-700 line-clamp-3">{log.actualActivity}</p>
      )}
      <div className="flex gap-2 flex-wrap">
        {log.distance && <span className="text-xs text-gray-500">📏 {log.distance}</span>}
        {log.duration  && <span className="text-xs text-gray-500">⏱ {log.duration}</span>}
        {log.rpe       && <span className="text-xs text-gray-500">💪 RPE {log.rpe}/10</span>}
      </div>
      {log.notes && <p className="text-xs text-gray-400 italic line-clamp-2">{log.notes}</p>}
    </div>
  )
}

// ── Log Form ──────────────────────────────────────────────────────────────────

function LogForm({ assignmentId, assignment, onLogged, onCancel, compact = false }) {
  const [form,   setForm]   = useState({ actualActivity: '', distance: '', duration: '', rpe: '', notes: '' })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState(null)

  function set(field, val) { setForm((f) => ({ ...f, [field]: val })) }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.actualActivity.trim()) {
      setError('Please describe what you did.')
      return
    }
    setSaving(true)
    setError(null)
    const logData = {
      actualActivity: form.actualActivity.trim(),
      distance:       form.distance.trim(),
      duration:       form.duration.trim(),
      rpe:            form.rpe || null,
      notes:          form.notes.trim(),
    }
    try {
      await addDoc(collection(db, 'workoutLogs'), {
        assignmentId,
        runnerId:    assignment.runnerId   || '',
        runnerName:  assignment.runnerName || '',
        date:        assignment.date       || '',
        ...logData,
        rpe:         logData.rpe ? parseInt(logData.rpe, 10) : null,
        submittedAt: serverTimestamp(),
      })
      storeLog(assignmentId, logData)
      onLogged()
    } catch {
      setError('Something went wrong. Try again.')
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <textarea
        rows={compact ? 2 : 3}
        className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none"
        placeholder="What did you do? (completed, modified, skipped…)"
        value={form.actualActivity}
        onChange={(e) => set('actualActivity', e.target.value)}
      />
      <div className="grid grid-cols-2 gap-1">
        <input
          type="text"
          className="border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400"
          placeholder="Distance"
          value={form.distance}
          onChange={(e) => set('distance', e.target.value)}
        />
        <input
          type="text"
          className="border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400"
          placeholder="Time"
          value={form.duration}
          onChange={(e) => set('duration', e.target.value)}
        />
      </div>
      <div>
        <p className="text-xs text-gray-400 mb-1">Effort (1–10)</p>
        <div className="flex gap-1 flex-wrap">
          {[1,2,3,4,5,6,7,8,9,10].map((n) => (
            <button
              key={n} type="button"
              onClick={() => set('rpe', n === form.rpe ? '' : n)}
              className={`w-6 h-6 rounded text-xs font-bold transition-colors ${
                form.rpe === n
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:border-emerald-300'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
      <textarea
        rows={1}
        className="w-full border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none"
        placeholder="Notes for coach (optional)"
        value={form.notes}
        onChange={(e) => set('notes', e.target.value)}
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
      <div className="flex gap-1">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving…' : 'Submit'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 rounded-lg text-xs text-gray-500 hover:bg-gray-100 border border-gray-200"
        >
          ✕
        </button>
      </div>
    </form>
  )
}

// ── Past Workout Card ─────────────────────────────────────────────────────────

function PastWorkoutCard({ assignment: a, isLogged, onLogged }) {
  const [open,        setOpen]        = useState(false)
  const [logFormOpen, setLogFormOpen] = useState(false)

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left px-5 py-4 flex items-start justify-between gap-3 hover:bg-gray-50 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-semibold text-gray-900 text-sm">
              {format(parseISO(a.date + 'T12:00:00'), 'EEE M/d')}
            </span>
            {isLogged
              ? <span className="text-xs bg-emerald-100 text-emerald-700 font-semibold px-2 py-0.5 rounded-full">✓ Logged</span>
              : <span className="text-xs bg-gray-100 text-gray-400 font-semibold px-2 py-0.5 rounded-full">Past</span>
            }
          </div>
          {a.mainWorkout
            ? <p className="text-sm text-gray-600 line-clamp-2">⚡ {a.mainWorkout}</p>
            : <p className="text-sm text-gray-400 italic">Rest / recovery</p>
          }
        </div>
        <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 text-gray-400 mt-1 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="border-t border-gray-100 px-5 py-4 space-y-3">
          {a.warmup       && <Block emoji="🔥" title="Warm-Up"      content={a.warmup}       color="bg-green-50 border-green-100" />}
          {a.mainWorkout  && <Block emoji="⚡" title="Main Workout" content={a.mainWorkout}  color="bg-brand-50 border-brand-100" />}
          {a.cooldown     && <Block emoji="❄️" title="Cool-Down"    content={a.cooldown}     color="bg-blue-50 border-blue-100" />}
          {a.crossTraining && <Block emoji="💪" title="Cross Training" content={a.crossTraining} color="bg-teal-50 border-teal-100" />}
          {a.notes        && <Block emoji="📝" title="Coach's Notes" content={a.notes}       color="bg-amber-50 border-amber-100" />}

          <div className="border-t border-gray-100 pt-3 bg-gray-50 -mx-5 px-5 pb-1">
            {isLogged ? (
              <LogSummary assignmentId={a.id} />
            ) : logFormOpen ? (
              <LogForm
                assignmentId={a.id}
                assignment={a}
                onLogged={() => { onLogged(); setLogFormOpen(false) }}
                onCancel={() => setLogFormOpen(false)}
              />
            ) : (
              <button
                onClick={() => setLogFormOpen(true)}
                className="w-full text-sm bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-xl font-semibold transition-colors"
              >
                📋 Log Activity
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Block ─────────────────────────────────────────────────────────────────────

function Block({ emoji, title, content, color = 'bg-gray-50 border-gray-100' }) {
  return (
    <div className={`rounded-xl border p-3 ${color}`}>
      <p className="text-xs font-bold text-gray-600 mb-1">{emoji} {title}</p>
      <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{content}</p>
    </div>
  )
}
