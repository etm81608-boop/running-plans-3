import { useEffect, useState, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import {
  collection, query, where, getDocs, addDoc, serverTimestamp,
} from 'firebase/firestore'
import { db } from '../firebase/config'
import { format, parseISO, startOfDay, addDays, startOfWeek, isPast } from 'date-fns'
import { ctToText } from '../components/CrossTrainingInput'
import { SWIM_WORKOUTS } from '../data/swimWorkouts'
import { STRENGTH_WORKOUTS } from '../data/strengthWorkouts'

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
function addWeeks(mondayStr, n) {
  return addDays(parseISO(mondayStr + 'T12:00:00'), n * 7).toISOString().split('T')[0]
}

// ── Meet data ─────────────────────────────────────────────────────────────────

const ALL_MEETS = [
  { id: 'v1',  date: '2026-03-21', name: 'Upper Darby Relays',            location: 'Upper Darby High School',            home: false, level: 'Varsity' },
  { id: 'v2',  date: '2026-03-27', name: 'Neshaminy Distance Festival',    location: 'Neshaminy High School',              home: false, level: 'Varsity' },
  { id: 'v3',  date: '2026-04-08', name: 'Multi-Team Meet',                location: 'William Penn Charter School',        home: false, level: 'Varsity' },
  { id: 'v4',  date: '2026-04-10', name: 'Haverford Distance Night',       location: 'Haverford High School',              home: false, level: 'Varsity' },
  { id: 'v5',  date: '2026-04-11', name: 'DELCO Relays',                   location: 'Marple Newtown High School',         home: false, level: 'Varsity' },
  { id: 'v6',  date: '2026-04-11', name: 'Brooks Fords Track Classic',     location: 'Haverford High School',              home: false, level: 'Varsity' },
  { id: 'v7',  date: '2026-04-15', name: 'Home Multi-Team Meet',           location: 'Greenwood Track',                    home: true,  level: 'Varsity' },
  { id: 'v8',  date: '2026-04-18', name: 'Kellerman Relays',               location: 'Great Valley High School',           home: false, level: 'Varsity' },
  { id: 'v9',  date: '2026-04-23', name: 'Penn Relays — Day 1',            location: 'Franklin Field, Philadelphia',        home: false, level: 'Varsity' },
  { id: 'v10', date: '2026-04-24', name: 'Penn Relays — Day 2',            location: 'Franklin Field, Philadelphia',        home: false, level: 'Varsity' },
  { id: 'v11', date: '2026-04-29', name: 'Away Dual/Tri Meet',             location: 'Germantown Academy',                 home: false, level: 'Varsity' },
  { id: 'v12', date: '2026-04-30', name: 'DELCO Champs — Day 1',           location: 'Upper Darby High School',            home: false, level: 'Varsity', championship: true },
  { id: 'v13', date: '2026-05-02', name: 'DELCO Champs — Day 2',           location: 'Rap Curry Athletic Complex',         home: false, level: 'Varsity', championship: true },
  { id: 'v14', date: '2026-05-09', name: 'Inter-Ac Track Champs',          location: 'Greenwood Track',                    home: true,  level: 'Varsity', championship: true },
  { id: 'v15', date: '2026-05-16', name: 'PAISAA Championship',            location: 'Malvern Preparatory School',         home: false, level: 'Varsity', championship: true },
  { id: 'm1',  date: '2026-04-02', name: 'EA @ Penn Charter',              location: 'William Penn Charter School',        home: false, level: 'MS' },
  { id: 'm2',  date: '2026-04-08', name: 'Penn Relay Qualifier',           location: 'William Penn Charter School',        home: false, level: 'MS' },
  { id: 'm3',  date: '2026-04-13', name: "MP & St. Anne's @ EA",           location: 'Greenwood Track',                    home: true,  level: 'MS' },
  { id: 'm4',  date: '2026-04-23', name: 'EA & Notre Dame @ GA',           location: 'Germantown Academy',                 home: false, level: 'MS' },
  { id: 'm5',  date: '2026-04-24', name: 'Penn Relays',                    location: 'Franklin Field, Philadelphia',        home: false, level: 'MS' },
  { id: 'm6',  date: '2026-04-27', name: 'EA @ Springside Chestnut Hill',  location: 'Springside Chestnut Hill Academy',   home: false, level: 'MS' },
  { id: 'm7',  date: '2026-04-30', name: 'Haverford School @ EA',          location: 'Greenwood Track',                    home: true,  level: 'MS' },
  { id: 'm8',  date: '2026-05-04', name: 'IAAL Championship',              location: 'TBD',                                home: false, level: 'MS', championship: true },
  { id: 'm9',  date: '2026-05-20', name: 'DELCO Champs',                   location: 'Rap Curry Athletic Complex',         home: false, level: 'MS', championship: true },
]

const MEETS_BY_DATE = {}
ALL_MEETS.forEach((m) => {
  if (!MEETS_BY_DATE[m.date]) MEETS_BY_DATE[m.date] = []
  MEETS_BY_DATE[m.date].push(m)
})

// ── Main page ─────────────────────────────────────────────────────────────────

export default function RunnerPage() {
  const { runnerId } = useParams()
  const [assignments,  setAssignments]  = useState([])
  const [peersByDate,  setPeersByDate]  = useState({})
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState(null)
  const runnerName = assignments[0]?.runnerName || ''

  const LS_KEY = `logged_${runnerId}`
  const [loggedIds,   setLoggedIds]   = useState(() => {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]') } catch { return [] }
  })
  const [logOpenDate, setLogOpenDate] = useState(null)
  const [showPastMeets, setShowPastMeets] = useState(false)

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

  // 4 weeks: 1 back, this week, +1, +2
  const weeks = useMemo(() => {
    const thisMonday = getMondayOf(today)
    const startMonday = addWeeks(thisMonday, -1)
    return [0, 1, 2, 3].map((i) => {
      const monday = addWeeks(startMonday, i)
      const days   = weekDays(monday)
      let label = ''
      if (i === 0) label = 'Last Week'
      else if (i === 1) label = 'This Week'
      else if (i === 2) label = 'Next Week'
      else label = 'In Two Weeks'
      return { monday, days, label }
    })
  }, [today])

  const upcomingCount = useMemo(
    () => assignments.filter((a) => a.date >= today).length,
    [assignments, today]
  )

  const upcomingMeets = ALL_MEETS.filter((m) => m.date >= today).sort((a, b) => a.date.localeCompare(b.date))
  const pastMeets     = ALL_MEETS.filter((m) => m.date < today).sort((a, b) => b.date.localeCompare(a.date))

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-800 to-brand-900 px-4 py-8">

      {/* School Header */}
      <div className="max-w-7xl mx-auto mb-4">
        <div className="bg-white/10 backdrop-blur rounded-3xl px-6 py-4 text-white flex items-center gap-4">
          <img
            src="https://resources.finalsite.net/images/v1752766793/episcopalacademypa/iki09ehlwxicgcugftmq/sheid_full.svg"
            alt="Episcopal Academy"
            className="w-14 h-14 object-contain flex-shrink-0"
            onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex' }}
          />
          <div style={{ display: 'none' }} className="w-14 h-14 rounded-full bg-white flex items-center justify-center flex-shrink-0">
            <span className="text-brand-800 font-black text-xl">EA</span>
          </div>
          <div>
            <p className="text-white/70 text-xs font-semibold uppercase tracking-widest">Episcopal Academy</p>
            <h1 className="text-2xl font-black leading-tight">Women's XC & Track</h1>
          </div>
        </div>
      </div>

      {/* Runner Header */}
      <div className="max-w-7xl mx-auto mb-6">
        <div className="bg-white/10 backdrop-blur rounded-3xl px-6 py-5 text-white flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-lg font-bold">
              {getInitials(runnerName) || '🏃'}
            </div>
            <div>
              <p className="text-white/60 text-sm">Your Schedule</p>
              <h2 className="text-2xl font-bold">{runnerName || 'Runner Schedule'}</h2>
            </div>
          </div>
          <div className="flex gap-5 text-sm text-white/70">
            <span>📅 {upcomingCount} upcoming workouts</span>
            <span>✅ {loggedIds.length} logged</span>
          </div>
        </div>
      </div>

      {/* 4-week workout grids */}
      {weeks.map(({ monday, days, label }) => (
        <div key={monday} className="max-w-7xl mx-auto mb-5">
          {/* Week label */}
          <p className="text-white/70 text-xs font-bold uppercase tracking-widest mb-2 px-1">
            {label} · {format(parseISO(days[0] + 'T12:00:00'), 'MMM d')} — {format(parseISO(days[6] + 'T12:00:00'), 'MMM d')}
          </p>
          <div className="bg-white rounded-3xl shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <div className="grid grid-cols-7 min-w-[700px]">

                {/* Date headers */}
                {days.map((dateStr) => {
                  const d       = parseISO(dateStr + 'T12:00:00')
                  const isToday = dateStr === today
                  const isPastDay = dateStr < today
                  const hasWkt  = !!assignmentByDate[dateStr]
                  const hasMeet = !!MEETS_BY_DATE[dateStr]
                  return (
                    <div key={dateStr} className={`text-center py-3 px-2 border-b border-r border-gray-100 last:border-r-0 ${
                      isToday        ? 'bg-brand-600 text-white'
                      : hasWkt && !isPastDay ? 'bg-brand-50 text-brand-700'
                      : isPastDay    ? 'bg-gray-50 text-gray-400'
                      : 'bg-gray-50 text-gray-300'
                    }`}>
                      <p className="text-xs font-semibold uppercase tracking-wide opacity-80">{format(d, 'EEE')}</p>
                      <p className="text-2xl font-bold leading-none mt-0.5">{format(d, 'd')}</p>
                      <p className="text-xs opacity-70 mt-0.5">{format(d, 'MMM')}</p>
                      {hasMeet && <div className="mt-1 w-2 h-2 rounded-full bg-red-400 mx-auto" />}
                    </div>
                  )
                })}

                {/* Workout + meet content */}
                {days.map((dateStr) => {
                  const a        = assignmentByDate[dateStr]
                  const isPastDay = dateStr < today
                  const isToday  = dateStr === today
                  const isLogged = a ? loggedIds.includes(a.id) : false
                  const logOpen  = logOpenDate === dateStr
                  const dayMeets = MEETS_BY_DATE[dateStr] || []

                  return (
                    <div key={dateStr} className={`border-r border-gray-100 last:border-r-0 flex flex-col ${isToday ? 'bg-brand-50/40' : 'bg-white'}`}>
                      <div className="flex-1 flex flex-col p-3 gap-2">

                        {/* Meet badges */}
                        {dayMeets.map((meet) => (
                          <div key={meet.id} className={`rounded-lg border p-2 ${meet.championship ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'}`}>
                            <p className={`text-xs font-bold mb-0.5 ${meet.championship ? 'text-amber-700' : 'text-red-700'}`}>
                              {meet.championship ? '🏆' : '🏟️'} {meet.level === 'MS' ? 'MS — ' : ''}{meet.name}
                            </p>
                            <p className="text-xs text-gray-600">📍 {meet.location}</p>
                            <p className="text-xs text-gray-500">{meet.home ? '🏠 Home' : '✈️ Away'}</p>
                          </div>
                        ))}

                        {a ? (
                          <>
                            <div className="flex justify-center">
                              {isLogged
                                ? <span className="text-xs bg-emerald-100 text-emerald-700 font-semibold px-2 py-0.5 rounded-full">✓ Logged</span>
                                : isPastDay
                                  ? <span className="text-xs bg-gray-100 text-gray-400 font-semibold px-2 py-0.5 rounded-full">Past</span>
                                  : <span className="text-xs bg-brand-100 text-brand-700 font-semibold px-2 py-0.5 rounded-full">Upcoming</span>
                              }
                            </div>
                            {a.warmup        && <DayBlock emoji="🔥" label="Warm-Up"   content={a.warmup}        bg="bg-green-50"  border="border-green-200"  text="text-green-800" />}
                            {a.mainWorkout   && <DayBlock emoji="⚡" label="Main"      content={a.mainWorkout}   bg="bg-indigo-50" border="border-indigo-200" text="text-indigo-800" />}
                            {a.cooldown      && <DayBlock emoji="❄️" label="Cool-Down" content={a.cooldown}      bg="bg-blue-50"   border="border-blue-200"   text="text-blue-800" />}
                            {ctToText(a.crossTraining) && <DayBlock emoji="💪" label="Cross" content={ctToText(a.crossTraining)} bg="bg-teal-50" border="border-teal-200" text="text-teal-800" />}
                            {a.notes         && <DayBlock emoji="📝" label="Notes"     content={a.notes}         bg="bg-amber-50"  border="border-amber-200"  text="text-amber-800" />}
                            {!a.warmup && !a.mainWorkout && !a.cooldown && !a.crossTraining && !a.notes && (
                              <p className="text-xs text-gray-400 text-center py-2 italic">Rest / recovery</p>
                            )}

                            {(peersByDate[dateStr] || []).length > 0 && (
                              <div className="rounded-lg bg-indigo-50 border border-indigo-100 p-2">
                                <p className="text-xs font-bold text-indigo-500 mb-1">👯 Partners</p>
                                {peersByDate[dateStr].map((p) => (
                                  <div key={p.id} className="text-xs text-indigo-700 font-medium truncate">
                                    {p.runnerName}
                                    {p.mainWorkout && <span className="text-indigo-400 font-normal"> — {p.mainWorkout.slice(0, 40)}</span>}
                                  </div>
                                ))}
                              </div>
                            )}

                            <div className="mt-auto pt-2">
                              {isLogged ? (
                                <LogSummary assignmentId={a.id} />
                              ) : (
                                <>
                                  {!logOpen && (
                                    <button onClick={() => setLogOpenDate(dateStr)}
                                      className="w-full text-xs bg-emerald-600 hover:bg-emerald-700 text-white py-1.5 rounded-lg font-semibold transition-colors">
                                      📋 Log Activity
                                    </button>
                                  )}
                                  {logOpen && (
                                    <LogForm assignmentId={a.id} assignment={a}
                                      onLogged={() => { markLogged(a.id); setLogOpenDate(null) }}
                                      onCancel={() => setLogOpenDate(null)} compact />
                                  )}
                                </>
                              )}
                            </div>
                          </>
                        ) : (
                          !dayMeets.length && (
                            <div className="flex-1 flex items-center justify-center py-6">
                              <p className="text-xs text-gray-300 italic">Rest</p>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* Full season meet schedule */}
      <div className="max-w-7xl mx-auto mb-6">
        <div className="bg-white/10 backdrop-blur rounded-3xl px-5 py-5">
          <p className="text-white font-black text-lg mb-4">🏟️ Season Meet Schedule</p>

          {/* Upcoming meets */}
          {upcomingMeets.length > 0 && (
            <div className="mb-4">
              <p className="text-white/60 text-xs font-bold uppercase tracking-widest mb-2">Upcoming</p>
              <div className="space-y-2">
                {upcomingMeets.map((meet) => (
                  <MeetRow key={meet.id} meet={meet} />
                ))}
              </div>
            </div>
          )}

          {/* Past meets */}
          {pastMeets.length > 0 && (
            <div>
              <button
                onClick={() => setShowPastMeets((v) => !v)}
                className="w-full flex items-center justify-between text-white/50 hover:text-white/70 text-xs font-bold uppercase tracking-widest mb-2 transition-colors"
              >
                <span>Completed ({pastMeets.length})</span>
                <svg xmlns="http://www.w3.org/2000/svg" className={`h-3 w-3 transition-transform ${showPastMeets ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showPastMeets && (
                <div className="space-y-2 opacity-50">
                  {pastMeets.map((meet) => (
                    <MeetRow key={meet.id} meet={meet} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Swim Workouts */}
      <SwimSection />

      {/* Strength Workouts */}
      <StrengthSection />

      <p className="text-center text-white/30 text-xs pb-4 max-w-7xl mx-auto">
        Episcopal Academy Women's XC & Track · Newtown Square, PA
      </p>
    </div>
  )
}

// ── Meet Row (runner-facing) ──────────────────────────────────────────────────

function MeetRow({ meet }) {
  const d = parseISO(meet.date + 'T12:00:00')
  return (
    <div className="flex items-center gap-3 bg-white/10 rounded-2xl px-4 py-3">
      <div className={`flex-shrink-0 w-10 text-center rounded-lg py-1 ${meet.championship ? 'bg-amber-400/40' : 'bg-white/20'}`}>
        <p className="text-white/60 text-xs">{format(d, 'MMM')}</p>
        <p className="text-white font-black text-sm leading-none">{format(d, 'd')}</p>
        <p className="text-white/50 text-xs">{format(d, 'EEE')}</p>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm font-semibold truncate">
          {meet.championship ? '🏆 ' : ''}{meet.name}
        </p>
        <p className="text-white/50 text-xs truncate">{meet.location}</p>
      </div>
      <div className="flex-shrink-0 flex flex-col items-end gap-1">
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
          meet.level === 'MS' ? 'bg-purple-400/30 text-purple-200' : 'bg-red-400/30 text-red-200'
        }`}>
          {meet.level === 'MS' ? 'MS' : 'Varsity'}
        </span>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
          meet.home ? 'bg-emerald-400/30 text-emerald-200' : 'bg-orange-400/30 text-orange-200'
        }`}>
          {meet.home ? 'Home' : 'Away'}
        </span>
      </div>
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
  if (!log) return <p className="text-xs text-emerald-600 font-semibold text-center py-1">✅ Logged!</p>
  return (
    <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-2 space-y-1">
      <p className="text-xs font-bold text-emerald-600">✅ Your Log</p>
      {log.actualActivity && <p className="text-xs text-gray-700 line-clamp-3">{log.actualActivity}</p>}
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
    if (!form.actualActivity.trim()) { setError('Please describe what you did.'); return }
    setSaving(true); setError(null)
    const logData = {
      actualActivity: form.actualActivity.trim(),
      distance: form.distance.trim(),
      duration: form.duration.trim(),
      rpe: form.rpe || null,
      notes: form.notes.trim(),
    }
    try {
      await addDoc(collection(db, 'workoutLogs'), {
        assignmentId,
        runnerId:    assignment.runnerId   || '',
        runnerName:  assignment.runnerName || '',
        date:        assignment.date       || '',
        ...logData,
        rpe: logData.rpe ? parseInt(logData.rpe, 10) : null,
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
      <textarea rows={compact ? 2 : 3}
        className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none"
        placeholder="What did you do? (completed, modified, skipped…)"
        value={form.actualActivity} onChange={(e) => set('actualActivity', e.target.value)} />
      <div className="grid grid-cols-2 gap-1">
        <input type="text" className="border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400"
          placeholder="Distance" value={form.distance} onChange={(e) => set('distance', e.target.value)} />
        <input type="text" className="border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400"
          placeholder="Time" value={form.duration} onChange={(e) => set('duration', e.target.value)} />
      </div>
      <div>
        <p className="text-xs text-gray-400 mb-1">Effort (1–10)</p>
        <div className="flex gap-1 flex-wrap">
          {[1,2,3,4,5,6,7,8,9,10].map((n) => (
            <button key={n} type="button" onClick={() => set('rpe', n === form.rpe ? '' : n)}
              className={`w-6 h-6 rounded text-xs font-bold transition-colors ${
                form.rpe === n ? 'bg-emerald-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-emerald-300'
              }`}>{n}</button>
          ))}
        </div>
      </div>
      <textarea rows={1}
        className="w-full border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none"
        placeholder="Notes for coach (optional)" value={form.notes} onChange={(e) => set('notes', e.target.value)} />
      {error && <p className="text-xs text-red-500">{error}</p>}
      <div className="flex gap-1">
        <button type="submit" disabled={saving}
          className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50 transition-colors">
          {saving ? 'Saving…' : 'Submit'}
        </button>
        <button type="button" onClick={onCancel}
          className="px-3 py-1.5 rounded-lg text-xs text-gray-500 hover:bg-gray-100 border border-gray-200">✕</button>
      </div>
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

// ── Swim Workouts Section ─────────────────────────────────────────────────────

function SwimSection() {
  const [selectedId, setSelectedId] = useState(null)
  const [open, setOpen] = useState(false)
  const workout = selectedId ? SWIM_WORKOUTS.find((w) => w.id === selectedId) : null

  return (
    <div className="max-w-7xl mx-auto mb-6">
      <div className="bg-white/10 backdrop-blur rounded-3xl px-5 py-5">

        {/* Header / toggle */}
        <button
          onClick={() => setOpen((v) => !v)}
          className="w-full flex items-center justify-between text-white"
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">🏊</span>
            <div className="text-left">
              <p className="font-black text-lg leading-tight">Swim Workouts</p>
              <p className="text-white/50 text-xs">5 cross-training sessions from Coach</p>
            </div>
          </div>
          <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 text-white/60 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {open && (
          <div className="mt-4 space-y-4">
            {/* Dropdown */}
            <select
              value={selectedId || ''}
              onChange={(e) => setSelectedId(e.target.value || null)}
              className="w-full bg-white/10 text-white border border-white/20 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-white/40"
            >
              <option value="">— choose a workout —</option>
              {SWIM_WORKOUTS.map((w) => (
                <option key={w.id} value={w.id} className="text-gray-900 bg-white">
                  {w.title} · {w.subtitle}
                </option>
              ))}
            </select>

            {/* Quick chips */}
            <div className="flex flex-wrap gap-2">
              {SWIM_WORKOUTS.map((w) => (
                <button
                  key={w.id}
                  onClick={() => setSelectedId(w.id === selectedId ? null : w.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors border ${
                    selectedId === w.id
                      ? 'bg-white text-brand-700 border-white'
                      : 'bg-white/10 text-white/70 border-white/20 hover:bg-white/20'
                  }`}
                >
                  #{w.id.replace('swim', '')} · {w.type}
                </button>
              ))}
            </div>

            {/* Workout detail */}
            {workout && (
              <div className="bg-white rounded-2xl overflow-hidden">
                {/* Workout header */}
                <div className="bg-gradient-to-r from-cyan-600 to-blue-700 px-5 py-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-white font-black text-base leading-tight">{workout.title}</p>
                    <p className="text-white/70 text-xs mt-0.5">{workout.subtitle}</p>
                  </div>
                  <div className="bg-white/20 rounded-xl px-3 py-2 text-center flex-shrink-0">
                    <p className="text-white font-black text-lg leading-none">
                      {workout.sets.reduce((s, x) => s + (x.yards || 0), 0).toLocaleString()}
                    </p>
                    <p className="text-white/70 text-xs">yards</p>
                  </div>
                </div>

                {/* Coach note */}
                {workout.note && (
                  <div className="bg-amber-50 border-b border-amber-100 px-5 py-3">
                    <p className="text-xs font-bold text-amber-700 mb-1">📋 Note</p>
                    <p className="text-xs text-amber-800 leading-relaxed">{workout.note}</p>
                  </div>
                )}

                {/* Sets */}
                <div className="divide-y divide-gray-100">
                  {workout.sets.map((set, i) => (
                    <div key={i} className="px-5 py-3 flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-xs font-bold text-blue-600">{i + 1}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">{set.label}</p>
                        <p className="text-sm text-gray-800 leading-relaxed">{set.detail}</p>
                        {set.rest && <p className="text-xs text-gray-400 italic mt-0.5">⏱ {set.rest}</p>}
                      </div>
                      {set.yards > 0 && (
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-bold text-blue-600">{set.yards}</p>
                          <p className="text-xs text-gray-400">yds</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Strength Workouts Section ─────────────────────────────────────────────────

function StrengthSection() {
  const [selectedId, setSelectedId] = useState(null)
  const [open, setOpen] = useState(false)
  const workout = selectedId ? STRENGTH_WORKOUTS.find((w) => w.id === selectedId) : null

  return (
    <div className="max-w-7xl mx-auto mb-6">
      <div className="bg-white/10 backdrop-blur rounded-3xl px-5 py-5">

        {/* Header / toggle */}
        <button
          onClick={() => setOpen((v) => !v)}
          className="w-full flex items-center justify-between text-white"
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">💪</span>
            <div className="text-left">
              <p className="font-black text-lg leading-tight">Strength Workouts</p>
              <p className="text-white/50 text-xs">Harvard Track program — 4 workouts with video guides</p>
            </div>
          </div>
          <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 text-white/60 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {open && (
          <div className="mt-4 space-y-4">
            {/* Dropdown */}
            <select
              value={selectedId || ''}
              onChange={(e) => setSelectedId(e.target.value || null)}
              className="w-full bg-white/10 text-white border border-white/20 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-white/40"
            >
              <option value="">— choose a workout —</option>
              {STRENGTH_WORKOUTS.map((w) => (
                <option key={w.id} value={w.id} className="text-gray-900 bg-white">
                  {w.title} · {w.type}
                </option>
              ))}
            </select>

            {/* Quick chips */}
            <div className="flex flex-wrap gap-2">
              {STRENGTH_WORKOUTS.map((w) => (
                <button
                  key={w.id}
                  onClick={() => setSelectedId(w.id === selectedId ? null : w.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors border ${
                    selectedId === w.id
                      ? 'bg-white text-brand-700 border-white'
                      : 'bg-white/10 text-white/70 border-white/20 hover:bg-white/20'
                  }`}
                >
                  #{w.id.replace('str', '')} · {w.type}
                </button>
              ))}
            </div>

            {/* Workout detail */}
            {workout && (
              <div className="bg-white rounded-2xl overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-orange-600 to-red-700 px-5 py-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-white font-black text-base leading-tight">{workout.title}</p>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${workout.typeBadge}`}>
                      {workout.type}
                    </span>
                  </div>
                  <div className="bg-white/20 rounded-xl px-3 py-2 text-center flex-shrink-0">
                    <p className="text-white font-black text-lg leading-none">{workout.exercises.length}</p>
                    <p className="text-white/70 text-xs">exercises</p>
                  </div>
                </div>

                {/* Note */}
                {workout.note && (
                  <div className="bg-amber-50 border-b border-amber-100 px-5 py-3">
                    <p className="text-xs font-bold text-amber-700 mb-1">📋 Note</p>
                    <p className="text-xs text-amber-800 leading-relaxed">{workout.note}</p>
                  </div>
                )}

                {/* Exercise list */}
                <div className="divide-y divide-gray-100">
                  {workout.exercises.map((ex, i) => (
                    <div key={i} className="px-5 py-3 flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-orange-50 border border-orange-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-xs font-bold text-orange-600">{i + 1}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900">{ex.name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{ex.reps}</p>
                        {ex.videos.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {ex.videos.map((v, vi) => (
                              <a
                                key={vi}
                                href={v.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-50 border border-red-200 text-red-700 text-xs font-semibold hover:bg-red-100 transition-colors"
                              >
                                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                                  <path d="M21.593 7.203a2.506 2.506 0 00-1.762-1.766C18.265 5.007 12 5 12 5s-6.264-.007-7.831.404a2.56 2.56 0 00-1.766 1.778c-.413 1.566-.417 4.814-.417 4.814s-.004 3.264.406 4.814c.23.857.905 1.534 1.763 1.765 1.582.43 7.83.437 7.83.437s6.265.007 7.831-.403a2.515 2.515 0 001.767-1.763c.414-1.565.417-4.812.417-4.812s.02-3.265-.407-4.831zM9.996 15.005l.005-6 5.207 3.005-5.212 2.995z"/>
                                </svg>
                                {v.label}
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
