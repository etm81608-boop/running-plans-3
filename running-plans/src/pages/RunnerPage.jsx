import { useEffect, useState, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import {
  collection, query, where, getDocs, addDoc, serverTimestamp,
} from 'firebase/firestore'
import { db } from '../firebase/config'
import { format, parseISO, startOfDay, addDays, startOfWeek } from 'date-fns'

// ── Helpers ──────────────────────────────────────────────────────────────────

// Same localStorage key format used by PublicWorkout.jsx
function getStoredLog(assignmentId) {
  try { return JSON.parse(localStorage.getItem(`wlog_${assignmentId}`) || 'null') } catch { return null }
}
function storeLog(assignmentId, data) {
  try { localStorage.setItem(`wlog_${assignmentId}`, JSON.stringify(data)) } catch {}
}

function getInitials(name = '') {
  return name.trim().split(/\s+/).map((w) => w[0]?.toUpperCase() ?? '').join('')
}

// Get ISO date string for Monday of the week containing dateStr
function getMondayOf(dateStr) {
  const d = parseISO(dateStr + 'T12:00:00')
  const mon = startOfWeek(d, { weekStartsOn: 1 })
  return mon.toISOString().split('T')[0]
}

// Return array of 7 ISO date strings Mon→Sun for a week starting at mondayStr
function weekDays(mondayStr) {
  const base = parseISO(mondayStr + 'T12:00:00')
  return Array.from({ length: 7 }, (_, i) =>
    addDays(base, i).toISOString().split('T')[0]
  )
}

const RPE_LABELS = {
  1:'Very Easy', 2:'Easy', 3:'Moderate', 4:'Somewhat Hard',
  5:'Hard', 6:'Hard+', 7:'Very Hard', 8:'Very Hard+',
  9:'Max Effort', 10:'All Out',
}

function rpeColor(rpe) {
  if (!rpe) return ''
  if (rpe <= 3) return 'bg-green-100 text-green-700'
  if (rpe <= 5) return 'bg-yellow-100 text-yellow-700'
  if (rpe <= 7) return 'bg-orange-100 text-orange-700'
  return 'bg-red-100 text-red-700'
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function RunnerPage() {
  const { runnerId } = useParams()
  const [assignments,  setAssignments]  = useState([])
  const [peersByDate,  setPeersByDate]  = useState({}) // date → [peer assignment, ...]
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState(null)
  const runnerName = assignments[0]?.runnerName || ''

  // localStorage key for tracking which assignments this runner has logged
  const LS_KEY = `logged_${runnerId}`
  const [loggedIds, setLoggedIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]') } catch { return [] }
  })

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
        // Load this runner's own assignments
        const snap = await getDocs(
          query(collection(db, 'assignments'), where('runnerId', '==', runnerId))
        )
        const docs = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((a) => a.date)
          .sort((a, b) => a.date.localeCompare(b.date))
        setAssignments(docs)

        // If any assignment has a visibilityGroup, load peer assignments
        const myGroup = docs.find((a) => a.visibilityGroup)?.visibilityGroup
        if (myGroup) {
          const peerSnap = await getDocs(
            query(
              collection(db, 'assignments'),
              where('visibilityGroup', '==', myGroup)
            )
          )
          const peerDocs = peerSnap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .filter((a) => a.date && a.runnerId !== runnerId)

          // Build map: date → peer assignments
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

  // Build date → assignment lookup
  const assignmentByDate = useMemo(() => {
    const map = {}
    assignments.forEach((a) => { if (a.date) map[a.date] = a })
    return map
  }, [assignments])

  // Week navigation — start on the Monday of the current week
  const [currentMonday, setCurrentMonday] = useState(() => getMondayOf(today))
  const [selectedDate,  setSelectedDate]  = useState(null)
  const [showPast,      setShowPast]      = useState(false)

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
    const next = addDays(parseISO(currentMonday + 'T12:00:00'), 7).toISOString().split('T')[0]
    setCurrentMonday(next)
    setSelectedDate(null)
  }
  function goPrevWeek() {
    const prev = addDays(parseISO(currentMonday + 'T12:00:00'), -7).toISOString().split('T')[0]
    setCurrentMonday(prev)
    setSelectedDate(null)
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

  const selectedAssignment = selectedDate ? assignmentByDate[selectedDate] : null

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-800 to-brand-900 p-4 py-10">
      <div className="max-w-xl mx-auto space-y-4">

        {/* Header */}
        <div className="bg-white/10 backdrop-blur rounded-3xl px-6 py-5 text-white">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center text-xl font-bold">
              {getInitials(runnerName) || '🏃'}
            </div>
            <div>
              <p className="text-white/60 text-sm">Your Schedule</p>
              <h1 className="text-2xl font-bold">{runnerName || 'Runner Schedule'}</h1>
            </div>
          </div>
          <div className="mt-3 flex gap-4 text-sm text-white/70">
            <span>📅 {upcomingCount} upcoming</span>
            <span>✅ {loggedIds.length} logged</span>
          </div>
        </div>

        {/* Weekly horizontal calendar */}
        <div className="bg-white rounded-3xl shadow-xl overflow-hidden">

          {/* Week navigation header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <button
              onClick={goPrevWeek}
              disabled={!hasPrev}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 disabled:opacity-30 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <p className="text-sm font-semibold text-gray-700">
              {format(parseISO(days[0] + 'T12:00:00'), 'MMM d')} — {format(parseISO(days[6] + 'T12:00:00'), 'MMM d, yyyy')}
            </p>
            <button
              onClick={goNextWeek}
              disabled={!hasNext}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 disabled:opacity-30 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Day pills row */}
          <div className="grid grid-cols-7 gap-1 px-3 py-4">
            {days.map((dateStr) => {
              const d          = parseISO(dateStr + 'T12:00:00')
              const hasWorkout = !!assignmentByDate[dateStr]
              const isSelected = selectedDate === dateStr
              const isToday    = dateStr === today
              const isPast     = dateStr < today

              return (
                <button
                  key={dateStr}
                  onClick={() => hasWorkout && setSelectedDate((s) => s === dateStr ? null : dateStr)}
                  disabled={!hasWorkout}
                  className={`flex flex-col items-center py-2.5 px-1 rounded-2xl transition-colors ${
                    isSelected
                      ? 'bg-brand-600 text-white shadow-md'
                      : hasWorkout && !isPast
                        ? 'bg-brand-50 text-brand-700 hover:bg-brand-100 cursor-pointer'
                        : hasWorkout && isPast
                          ? 'bg-gray-100 text-gray-500 hover:bg-gray-200 cursor-pointer'
                          : 'text-gray-300 cursor-default'
                  }`}
                >
                  <span className="text-xs font-medium mb-1">{format(d, 'EEE')}</span>
                  <span className={`text-base font-bold leading-none ${isToday && !isSelected ? 'text-brand-600' : ''}`}>
                    {format(d, 'd')}
                  </span>
                  <div className={`w-1.5 h-1.5 rounded-full mt-1.5 ${
                    hasWorkout
                      ? isSelected ? 'bg-white/70' : isPast ? 'bg-gray-400' : 'bg-brand-400'
                      : 'invisible'
                  }`} />
                  {isToday && (
                    <div className={`w-1 h-1 rounded-full mt-0.5 ${isSelected ? 'bg-yellow-300' : 'bg-yellow-400'}`} />
                  )}
                </button>
              )
            })}
          </div>

          {/* Selected day workout */}
          {selectedAssignment && (
            <div className="border-t border-gray-100">
              <WorkoutCard
                assignment={selectedAssignment}
                peers={peersByDate[selectedDate] || []}
                isLogged={loggedIds.includes(selectedAssignment.id)}
                isPast={selectedDate < today}
                expanded
                onToggle={() => {}}
                onLogged={() => markLogged(selectedAssignment.id)}
                inline
              />
            </div>
          )}

          {!selectedDate && (
            <p className="text-center text-gray-400 text-sm py-5 px-4">
              {Object.keys(assignmentByDate).some((d) => days.includes(d))
                ? 'Tap a highlighted day to see your workout'
                : 'No workouts scheduled this week'}
            </p>
          )}
        </div>

        {/* Past workouts */}
        {pastAssignments.length > 0 && (
          <div>
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
                  <WorkoutCard
                    key={a.id}
                    assignment={a}
                    peers={peersByDate[a.date] || []}
                    isPast
                    isLogged={loggedIds.includes(a.id)}
                    expanded={selectedDate === a.id}
                    onToggle={() => setSelectedDate((s) => s === a.id ? null : a.id)}
                    onLogged={() => markLogged(a.id)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        <p className="text-center text-white/30 text-xs pb-4">Team Running Plans · Episcopal Academy</p>
      </div>
    </div>
  )
}

// ── Workout Card ──────────────────────────────────────────────────────────────

function WorkoutCard({ assignment: a, peers = [], isPast, isLogged, expanded, onToggle, onLogged, inline = false }) {
  const dateStr   = format(parseISO(a.date + 'T12:00:00'), 'EEEE, MMMM d')
  const shortDate = format(parseISO(a.date + 'T12:00:00'), 'EEE M/d')

  const statusBadge = isLogged
    ? <span className="text-xs bg-emerald-100 text-emerald-700 font-semibold px-2.5 py-0.5 rounded-full">✓ Logged</span>
    : isPast
      ? <span className="text-xs bg-gray-100 text-gray-400 font-semibold px-2.5 py-0.5 rounded-full">Past</span>
      : <span className="text-xs bg-brand-100 text-brand-700 font-semibold px-2.5 py-0.5 rounded-full">Upcoming</span>

  return (
    <div className={inline ? '' : 'bg-white rounded-2xl shadow-sm overflow-hidden'}>
      {/* Card header — hidden when inline (already shown by calendar) */}
      {!inline && (
        <button
          onClick={onToggle}
          className="w-full text-left px-5 py-4 flex items-start justify-between gap-3 hover:bg-gray-50 transition-colors"
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="font-semibold text-gray-900 text-sm">{shortDate}</span>
              {statusBadge}
            </div>
            {a.mainWorkout ? (
              <p className="text-sm text-gray-600 line-clamp-2">⚡ {a.mainWorkout}</p>
            ) : (
              <p className="text-sm text-gray-400 italic">Rest / recovery day</p>
            )}
          </div>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className={`h-4 w-4 text-gray-400 mt-1 flex-shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      )}

      {/* Expanded content */}
      {(expanded || inline) && (
        <div className={inline ? '' : 'border-t border-gray-100'}>
          {/* Workout details */}
          <div className="px-5 py-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">{dateStr}</p>
              {statusBadge}
            </div>
            {a.warmup && (
              <Block emoji="🔥" title="Warm-Up" content={a.warmup} color="bg-green-50 border-green-100" />
            )}
            {a.mainWorkout && (
              <Block emoji="⚡" title="Main Workout" content={a.mainWorkout} color="bg-brand-50 border-brand-100" />
            )}
            {a.cooldown && (
              <Block emoji="❄️" title="Cool-Down" content={a.cooldown} color="bg-blue-50 border-blue-100" />
            )}
            {a.crossTraining && (
              <Block emoji="💪" title="Cross Training" content={a.crossTraining} color="bg-teal-50 border-teal-100" />
            )}
            {a.notes && (
              <Block emoji="📝" title="Coach's Notes" content={a.notes} color="bg-amber-50 border-amber-100" />
            )}
          </div>

          {/* Training partners */}
          {peers.length > 0 && (
            <div className="border-t border-gray-100 px-5 py-4 bg-indigo-50">
              <p className="text-xs font-bold text-indigo-500 uppercase tracking-wide mb-2">
                👯 Training Partners Today
              </p>
              <div className="space-y-2">
                {peers.map((p) => (
                  <div key={p.id} className="flex items-start gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-indigo-200 flex items-center justify-center text-xs font-bold text-indigo-700 flex-shrink-0 mt-0.5">
                      {getInitials(p.runnerName)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-800">{p.runnerName}</p>
                      {p.mainWorkout && (
                        <p className="text-xs text-gray-600 line-clamp-2">⚡ {p.mainWorkout}</p>
                      )}
                      {p.warmup && (
                        <p className="text-xs text-gray-400 line-clamp-1">🔥 {p.warmup}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Log form / log summary */}
          <div className="border-t border-gray-100 px-5 py-4 bg-gray-50">
            {isLogged ? (
              <LogSummary assignmentId={a.id} />
            ) : (
              <LogForm assignmentId={a.id} assignment={a} onLogged={onLogged} />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Log Summary ───────────────────────────────────────────────────────────────

function LogSummary({ assignmentId }) {
  const log = getStoredLog(assignmentId)

  if (!log) {
    return (
      <p className="text-emerald-600 font-semibold text-sm text-center py-1">
        ✅ Activity logged — your coach can see your response!
      </p>
    )
  }

  return (
    <div>
      <p className="text-xs font-bold text-emerald-600 uppercase tracking-wide mb-3">✅ Your Activity Log</p>
      <div className="space-y-1.5">
        {log.actualActivity && (
          <div>
            <p className="text-xs font-semibold text-gray-500">What you did</p>
            <p className="text-sm text-gray-800 whitespace-pre-wrap">{log.actualActivity}</p>
          </div>
        )}
        {(log.distance || log.duration || log.rpe) && (
          <div className="flex gap-4 pt-1">
            {log.distance && (
              <div>
                <p className="text-xs font-semibold text-gray-500">Distance</p>
                <p className="text-sm text-gray-800">{log.distance}</p>
              </div>
            )}
            {log.duration && (
              <div>
                <p className="text-xs font-semibold text-gray-500">Time</p>
                <p className="text-sm text-gray-800">{log.duration}</p>
              </div>
            )}
            {log.rpe && (
              <div>
                <p className="text-xs font-semibold text-gray-500">Effort</p>
                <p className="text-sm text-gray-800">{log.rpe}/10</p>
              </div>
            )}
          </div>
        )}
        {log.notes && (
          <div className="pt-1">
            <p className="text-xs font-semibold text-gray-500">Notes</p>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{log.notes}</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Log Form ──────────────────────────────────────────────────────────────────

function LogForm({ assignmentId, assignment, onLogged }) {
  const [form,    setForm]    = useState({ actualActivity: '', distance: '', duration: '', rpe: '', notes: '' })
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState(null)

  function set(field, val) { setForm((f) => ({ ...f, [field]: val })) }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.actualActivity.trim()) {
      setError('Please describe what you did before submitting.')
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
      // Save to localStorage so this device can show the log back to the runner
      storeLog(assignmentId, logData)
      onLogged()
    } catch {
      setError('Something went wrong. Please try again.')
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <p className="text-sm font-semibold text-gray-700">📋 Log your activity</p>

      <div>
        <textarea
          rows={2}
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none"
          placeholder="What did you actually do? (completed workout, modified, skipped, etc.)"
          value={form.actualActivity}
          onChange={(e) => set('actualActivity', e.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <input
          type="text"
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
          placeholder="Distance (e.g. 5 mi)"
          value={form.distance}
          onChange={(e) => set('distance', e.target.value)}
        />
        <input
          type="text"
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
          placeholder="Time (e.g. 40 min)"
          value={form.duration}
          onChange={(e) => set('duration', e.target.value)}
        />
      </div>

      {/* RPE */}
      <div>
        <p className="text-xs text-gray-500 mb-1.5">How hard? (1 = easy, 10 = max)</p>
        <div className="flex gap-1.5 flex-wrap">
          {[1,2,3,4,5,6,7,8,9,10].map((n) => (
            <button
              key={n} type="button"
              onClick={() => set('rpe', n === form.rpe ? '' : n)}
              className={`w-8 h-8 rounded-lg text-xs font-bold transition-colors ${
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
        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none"
        placeholder="Any notes for your coach? (optional)"
        value={form.notes}
        onChange={(e) => set('notes', e.target.value)}
      />

      {error && <p className="text-xs text-red-500">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors"
      >
        {saving ? 'Submitting…' : 'Submit Log'}
      </button>
    </form>
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
