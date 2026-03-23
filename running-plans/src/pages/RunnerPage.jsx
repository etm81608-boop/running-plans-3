import { useEffect, useState, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import {
  collection, query, where, getDocs, addDoc, serverTimestamp,
} from 'firebase/firestore'
import { db } from '../firebase/config'
import { format, parseISO, startOfDay, addDays, startOfWeek } from 'date-fns'
import { ctToText } from '../components/CrossTrainingInput'
import { SWIM_WORKOUTS } from '../data/swimWorkouts'
import { STRENGTH_WORKOUTS } from '../data/strengthWorkouts'

// ── Helpers ───────────────────────────────────────────────────────────────────

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
  return startOfWeek(d, { weekStartsOn: 1 }).toISOString().split('T')[0]
}
function weekDays(mondayStr) {
  const base = parseISO(mondayStr + 'T12:00:00')
  return Array.from({ length: 7 }, (_, i) => addDays(base, i).toISOString().split('T')[0])
}
function shiftWeek(mondayStr, n) {
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

// ── Tabs ──────────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'schedule', label: 'My Schedule' },
  { id: 'meets',    label: 'Meets'       },
  { id: 'swim',     label: 'Swim'        },
  { id: 'strength', label: 'Strength'    },
]

// ── Main page ─────────────────────────────────────────────────────────────────

export default function RunnerPage() {
  const { runnerId } = useParams()
  const [assignments,  setAssignments]  = useState([])
  const [peersByDate,  setPeersByDate]  = useState({})
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState(null)
  const [activeTab,    setActiveTab]    = useState('schedule')
  const [weekOffset,   setWeekOffset]   = useState(0)   // 0 = this week
  const runnerName = assignments[0]?.runnerName || ''

  const LS_KEY = `logged_${runnerId}`
  const [loggedIds,     setLoggedIds]     = useState(() => {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]') } catch { return [] }
  })
  const [logOpenDate,   setLogOpenDate]   = useState(null)
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

  const thisMonday   = getMondayOf(today)
  const currentMonday = shiftWeek(thisMonday, weekOffset)
  const currentDays   = weekDays(currentMonday)

  const upcomingCount = useMemo(
    () => assignments.filter((a) => a.date >= today).length,
    [assignments, today]
  )
  const loggedCount = loggedIds.length

  const upcomingMeets = ALL_MEETS.filter((m) => m.date >= today).sort((a, b) => a.date.localeCompare(b.date))
  const pastMeets     = ALL_MEETS.filter((m) => m.date < today).sort((a, b) => b.date.localeCompare(a.date))

  const weekLabel = weekOffset === 0 ? 'This Week'
    : weekOffset === -1 ? 'Last Week'
    : weekOffset === 1  ? 'Next Week'
    : weekOffset > 0    ? `In ${weekOffset} Weeks`
    : `${Math.abs(weekOffset)} Weeks Ago`

  if (loading) return (
    <div className="min-h-screen bg-pink-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-rose-200 border-t-rose-400 rounded-full animate-spin mx-auto mb-3" />
        <p className="text-rose-400 text-sm">Loading your schedule…</p>
      </div>
    </div>
  )

  if (error) return (
    <div className="min-h-screen bg-pink-50 flex items-center justify-center p-6">
      <div className="text-center">
        <span className="text-5xl">🤔</span>
        <p className="mt-4 text-rose-400">{error}</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-pink-50">

      {/* ── Header ── */}
      <header className="bg-gradient-to-br from-rose-100 via-pink-50 to-violet-100 border-b border-rose-200">
        {/* School bar */}
        <div className="border-b border-rose-200/60 px-4 py-3 flex items-center gap-3">
          <img
            src="https://resources.finalsite.net/images/v1752766793/episcopalacademypa/iki09ehlwxicgcugftmq/sheid_full.svg"
            alt="Episcopal Academy"
            className="w-8 h-8 object-contain flex-shrink-0"
            onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex' }}
          />
          <div style={{ display: 'none' }} className="w-8 h-8 bg-rose-200 flex items-center justify-center flex-shrink-0">
            <span className="text-rose-700 font-black text-xs">EA</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-rose-400 uppercase tracking-widest">Episcopal Academy</span>
            <span className="text-rose-200">·</span>
            <span className="text-xs font-semibold text-violet-500 uppercase tracking-widest">Women's XC & Track</span>
          </div>
        </div>

        {/* Runner hero */}
        <div className="px-4 py-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-rose-300 flex items-center justify-center text-rose-900 font-black text-lg flex-shrink-0">
              {getInitials(runnerName) || '🏃'}
            </div>
            <div>
              <p className="text-xs text-rose-400 uppercase tracking-widest font-semibold">Athlete</p>
              <h1 className="text-2xl font-black text-rose-900 leading-tight">{runnerName || 'Runner'}</h1>
            </div>
          </div>
          <div className="flex gap-4 text-right">
            <div>
              <p className="text-2xl font-black text-rose-500 leading-none">{upcomingCount}</p>
              <p className="text-xs text-rose-400 uppercase tracking-wide mt-0.5">Upcoming</p>
            </div>
            <div className="w-px bg-rose-200 self-stretch" />
            <div>
              <p className="text-2xl font-black text-emerald-500 leading-none">{loggedCount}</p>
              <p className="text-xs text-rose-400 uppercase tracking-wide mt-0.5">Logged</p>
            </div>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex border-t border-rose-200/60 bg-white/50">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-3 text-sm font-semibold transition-colors relative ${
                activeTab === tab.id
                  ? 'text-rose-700'
                  : 'text-rose-300 hover:text-rose-500'
              }`}
            >
              {tab.label}
              {activeTab === tab.id && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-rose-400" />
              )}
            </button>
          ))}
        </div>
      </header>

      {/* ── Tab: My Schedule ── */}
      {activeTab === 'schedule' && (
        <div className="max-w-7xl mx-auto px-3 py-4">

          {/* Week navigation */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => setWeekOffset((o) => o - 1)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-rose-500 border border-rose-200 bg-white hover:bg-rose-50 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Prev
            </button>

            <div className="text-center">
              <p className="text-sm font-black text-rose-800 uppercase tracking-wide">{weekLabel}</p>
              <p className="text-xs text-rose-400 mt-0.5">
                {format(parseISO(currentDays[0] + 'T12:00:00'), 'MMM d')} — {format(parseISO(currentDays[6] + 'T12:00:00'), 'MMM d, yyyy')}
              </p>
            </div>

            <div className="flex gap-2">
              {weekOffset !== 0 && (
                <button
                  onClick={() => setWeekOffset(0)}
                  className="px-3 py-2 text-xs font-bold text-rose-600 border border-rose-300 bg-rose-100 hover:bg-rose-200 transition-colors uppercase tracking-wide"
                >
                  Today
                </button>
              )}
              <button
                onClick={() => setWeekOffset((o) => o + 1)}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-rose-500 border border-rose-200 bg-white hover:bg-rose-50 transition-colors"
              >
                Next
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>

          {/* Week grid */}
          <div className="bg-white border border-rose-100 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <div className="grid grid-cols-7 min-w-[640px]">

                {/* Day headers */}
                {currentDays.map((dateStr) => {
                  const d        = parseISO(dateStr + 'T12:00:00')
                  const isToday  = dateStr === today
                  const isPast   = dateStr < today
                  const hasMeet  = !!MEETS_BY_DATE[dateStr]
                  return (
                    <div
                      key={dateStr}
                      className={`text-center py-2.5 px-1 border-r border-rose-100 last:border-r-0 border-b ${
                        isToday ? 'bg-rose-200 text-rose-900' : isPast ? 'bg-rose-50/50 text-rose-300' : 'bg-white text-rose-700'
                      }`}
                    >
                      <p className={`text-xs font-bold uppercase tracking-wider ${isToday ? 'text-rose-600' : 'opacity-60'}`}>
                        {format(d, 'EEE')}
                      </p>
                      <p className="text-xl font-black leading-none mt-0.5">{format(d, 'd')}</p>
                      <p className={`text-xs mt-0.5 ${isToday ? 'text-rose-500' : 'opacity-50'}`}>{format(d, 'MMM')}</p>
                      {hasMeet && (
                        <div className={`mx-auto mt-1.5 w-1.5 h-1.5 rounded-full ${isToday ? 'bg-rose-500' : 'bg-violet-400'}`} />
                      )}
                    </div>
                  )
                })}

                {/* Day content cells */}
                {currentDays.map((dateStr) => {
                  const a        = assignmentByDate[dateStr]
                  const isPast   = dateStr < today
                  const isToday  = dateStr === today
                  const isLogged = a ? loggedIds.includes(a.id) : false
                  const dayMeets = MEETS_BY_DATE[dateStr] || []

                  return (
                    <div
                      key={dateStr}
                      className={`border-r border-rose-100 last:border-r-0 min-h-[160px] flex flex-col ${
                        isToday ? 'bg-rose-50/40' : isPast ? 'bg-rose-50/20' : 'bg-white'
                      }`}
                    >
                      <div className="flex-1 flex flex-col p-2 gap-1.5">

                        {/* Meet badges */}
                        {dayMeets.map((meet) => (
                          <div
                            key={meet.id}
                            className={`border-l-2 pl-2 pr-1 py-1 text-xs ${
                              meet.championship
                                ? 'border-amber-400 bg-amber-50'
                                : 'border-rose-400 bg-rose-50'
                            }`}
                          >
                            <p className={`font-bold text-xs leading-tight ${meet.championship ? 'text-amber-700' : 'text-rose-700'}`}>
                              {meet.championship ? '🏆 ' : ''}{meet.name}
                            </p>
                            <p className="text-gray-500 text-xs mt-0.5 leading-tight">{meet.location}</p>
                          </div>
                        ))}

                        {a ? (
                          <>
                            {/* Status indicator */}
                            <div className="flex justify-center">
                              {isLogged
                                ? <span className="text-xs text-emerald-500 font-semibold italic">✓ Logged</span>
                                : isPast
                                  ? <span className="text-xs text-rose-300 font-semibold italic">Past</span>
                                  : isToday
                                    ? <span className="text-xs text-rose-600 font-semibold italic">Today</span>
                                    : <span className="text-xs text-violet-400 font-semibold italic">Upcoming</span>
                              }
                            </div>

                            {a.warmup && (
                              <div className="border-l-2 border-green-400 pl-2 py-0.5 bg-green-50">
                                <p className="text-xs font-bold text-green-700">Warm-Up</p>
                                <p className="text-xs text-gray-600 leading-snug line-clamp-2">{a.warmup}</p>
                              </div>
                            )}
                            {a.mainWorkout && (
                              <div className="border-l-2 border-rose-500 pl-2 py-0.5 bg-rose-50">
                                <p className="text-xs font-bold text-rose-700">Main</p>
                                <p className="text-xs text-gray-700 leading-snug line-clamp-3">{a.mainWorkout}</p>
                              </div>
                            )}
                            {a.cooldown && (
                              <div className="border-l-2 border-sky-400 pl-2 py-0.5 bg-sky-50">
                                <p className="text-xs font-bold text-sky-700">Cool-Down</p>
                                <p className="text-xs text-gray-600 leading-snug line-clamp-2">{a.cooldown}</p>
                              </div>
                            )}
                            {ctToText(a.crossTraining) && (
                              <div className="border-l-2 border-teal-400 pl-2 py-0.5 bg-teal-50">
                                <p className="text-xs font-bold text-teal-700">Cross</p>
                                <p className="text-xs text-gray-600 leading-snug">{ctToText(a.crossTraining)}</p>
                              </div>
                            )}
                            {a.notes && (
                              <div className="border-l-2 border-amber-400 pl-2 py-0.5 bg-amber-50">
                                <p className="text-xs font-bold text-amber-700">Notes</p>
                                <p className="text-xs text-gray-600 leading-snug line-clamp-2">{a.notes}</p>
                              </div>
                            )}
                            {!a.warmup && !a.mainWorkout && !a.cooldown && !ctToText(a.crossTraining) && !a.notes && (
                              <p className="text-xs text-gray-300 text-center py-3 italic">Rest</p>
                            )}

                            {/* Partners */}
                            {(peersByDate[dateStr] || []).length > 0 && (
                              <div className="border border-violet-100 bg-violet-50 p-1.5">
                                <p className="text-xs font-bold text-violet-500 mb-0.5">Partners</p>
                                {peersByDate[dateStr].map((p) => (
                                  <p key={p.id} className="text-xs text-violet-700 truncate font-medium">{p.runnerName}</p>
                                ))}
                              </div>
                            )}

                            {/* Log button */}
                            <div className="mt-auto pt-1">
                              {isLogged ? (
                                <LogSummary assignmentId={a.id} />
                              ) : (
                                <button
                                  onClick={() => setLogOpenDate(dateStr)}
                                  className="w-full text-xs bg-emerald-400 hover:bg-emerald-500 text-white py-1.5 font-bold transition-colors uppercase tracking-wide"
                                >
                                  Log Activity
                                </button>
                              )}
                            </div>
                          </>
                        ) : (
                          !dayMeets.length && (
                            <div className="flex-1 flex items-center justify-center py-4">
                              <p className="text-xs text-gray-200 italic">Rest</p>
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
      )}

      {/* ── Tab: Meets ── */}
      {activeTab === 'meets' && (
        <div className="max-w-3xl mx-auto px-4 py-6">
          <h2 className="text-xs font-black uppercase tracking-widest text-rose-400 mb-4">Season Meet Schedule</h2>

          {upcomingMeets.length > 0 && (
            <div className="mb-6">
              <p className="text-xs font-bold text-rose-500 uppercase tracking-widest mb-2">Upcoming</p>
              <div className="divide-y divide-rose-100 border border-rose-100 bg-white">
                {upcomingMeets.map((meet) => <MeetRow key={meet.id} meet={meet} />)}
              </div>
            </div>
          )}

          {pastMeets.length > 0 && (
            <div>
              <button
                onClick={() => setShowPastMeets((v) => !v)}
                className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 hover:text-gray-600 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className={`h-3 w-3 transition-transform ${showPastMeets ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
                Completed ({pastMeets.length})
              </button>
              {showPastMeets && (
                <div className="divide-y divide-rose-100 border border-rose-100 bg-white opacity-60">
                  {pastMeets.map((meet) => <MeetRow key={meet.id} meet={meet} />)}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Swim ── */}
      {activeTab === 'swim' && (
        <div className="max-w-3xl mx-auto px-4 py-6">
          <SwimSection />
        </div>
      )}

      {/* ── Tab: Strength ── */}
      {activeTab === 'strength' && (
        <div className="max-w-3xl mx-auto px-4 py-6">
          <StrengthSection />
        </div>
      )}

      <p className="text-center text-rose-300 text-xs py-8">
        Episcopal Academy Women's XC & Track · Newtown Square, PA
      </p>

      {/* Full-screen log modal */}
      {logOpenDate && (() => {
        const a = assignmentByDate[logOpenDate]
        if (!a) return null
        return (
          <LogModal
            assignment={a}
            onLogged={() => { markLogged(a.id); setLogOpenDate(null) }}
            onCancel={() => setLogOpenDate(null)}
          />
        )
      })()}
    </div>
  )
}

// ── Meet Row ──────────────────────────────────────────────────────────────────

function MeetRow({ meet }) {
  const d = parseISO(meet.date + 'T12:00:00')
  return (
    <div className="flex items-center gap-4 px-4 py-3">
      <div className={`w-10 text-center flex-shrink-0 ${meet.championship ? 'text-amber-600' : 'text-rose-600'}`}>
        <p className="text-xs font-semibold uppercase">{format(d, 'MMM')}</p>
        <p className="text-xl font-black leading-none">{format(d, 'd')}</p>
        <p className="text-xs opacity-60">{format(d, 'EEE')}</p>
      </div>
      <div className={`w-px self-stretch ${meet.championship ? 'bg-amber-300' : 'bg-rose-300'}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-gray-900 truncate">
          {meet.championship ? '🏆 ' : ''}{meet.name}
        </p>
        <p className="text-xs text-gray-400 truncate">{meet.location}</p>
      </div>
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        <span className={`text-xs font-semibold italic ${meet.level === 'MS' ? 'text-violet-500' : 'text-rose-500'}`}>
          {meet.level === 'MS' ? 'MS' : 'Varsity'}
        </span>
        <span className={`text-xs font-semibold italic ${meet.home ? 'text-emerald-500' : 'text-gray-400'}`}>
          {meet.home ? 'Home' : 'Away'}
        </span>
      </div>
    </div>
  )
}

// ── Log Summary ───────────────────────────────────────────────────────────────

function LogSummary({ assignmentId }) {
  const log = getStoredLog(assignmentId)
  if (!log) return <p className="text-xs text-emerald-500 font-semibold italic text-center py-1">✓ Logged</p>
  return (
    <div className="border-t border-emerald-100 pt-2 space-y-0.5">
      <p className="text-xs font-semibold text-emerald-500 italic">✓ Logged</p>
      {log.actualActivity && <p className="text-xs text-rose-500 line-clamp-2 italic">{log.actualActivity}</p>}
      <div className="flex gap-2 flex-wrap">
        {log.distance     && <span className="text-xs text-rose-400">{log.distance}</span>}
        {log.avgPace      && <span className="text-xs text-rose-400">@ {log.avgPace}</span>}
        {log.avgHeartRate && <span className="text-xs text-rose-400">♥ {log.avgHeartRate}</span>}
        {log.rpe          && <span className="text-xs text-violet-500 font-semibold">RPE {log.rpe}</span>}
      </div>
    </div>
  )
}

// ── Swim Section ──────────────────────────────────────────────────────────────

function SwimSection() {
  const [selectedId, setSelectedId] = useState(null)
  const workout = selectedId ? SWIM_WORKOUTS.find((w) => w.id === selectedId) : null

  return (
    <div>
      <h2 className="text-xs font-black uppercase tracking-widest text-sky-400 mb-4">Swim Workouts</h2>

      <select
        value={selectedId || ''}
        onChange={(e) => setSelectedId(e.target.value || null)}
        className="w-full border border-sky-200 bg-white px-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-sky-300 mb-3 text-sky-800"
      >
        <option value="">— Select a swim workout —</option>
        {SWIM_WORKOUTS.map((w) => (
          <option key={w.id} value={w.id}>{w.title} · {w.subtitle}</option>
        ))}
      </select>

      <div className="flex flex-wrap gap-2 mb-5">
        {SWIM_WORKOUTS.map((w) => (
          <button
            key={w.id}
            onClick={() => setSelectedId(w.id === selectedId ? null : w.id)}
            className={`px-3 py-1 text-xs font-bold uppercase tracking-wide border transition-colors ${
              selectedId === w.id
                ? 'bg-sky-300 text-sky-900 border-sky-300'
                : 'bg-white text-sky-500 border-sky-200 hover:bg-sky-50'
            }`}
          >
            {w.type}
          </button>
        ))}
      </div>

      {workout && (
        <div className="border border-sky-100 bg-white overflow-hidden">
          <div className="bg-gradient-to-r from-sky-100 to-violet-100 px-5 py-4 flex items-center justify-between border-b border-sky-200">
            <div>
              <p className="font-black text-base text-sky-900">{workout.title}</p>
              <p className="text-sky-500 text-xs mt-0.5">{workout.subtitle}</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-black text-sky-600">
                {workout.sets.reduce((s, x) => s + (x.yards || 0), 0).toLocaleString()}
              </p>
              <p className="text-sky-400 text-xs uppercase tracking-wide">yards</p>
            </div>
          </div>
          {workout.note && (
            <div className="border-b border-amber-100 bg-amber-50 px-5 py-3">
              <p className="text-xs font-bold text-amber-700 mb-1 uppercase tracking-wide">Coach Note</p>
              <p className="text-xs text-amber-800 leading-relaxed">{workout.note}</p>
            </div>
          )}
          <div className="divide-y divide-gray-100">
            {workout.sets.map((set, i) => (
              <div key={i} className="px-5 py-3 flex items-start gap-4">
                <span className="text-xs font-black text-gray-300 w-5 flex-shrink-0 mt-0.5">{i + 1}</span>
                <div className="flex-1">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">{set.label}</p>
                  <p className="text-sm text-gray-800">{set.detail}</p>
                  {set.rest && <p className="text-xs text-gray-400 mt-0.5">{set.rest}</p>}
                </div>
                {set.yards > 0 && (
                  <span className="text-sm font-black text-rose-600 flex-shrink-0">{set.yards} yds</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Strength Section ──────────────────────────────────────────────────────────

function StrengthSection() {
  const [selectedId, setSelectedId] = useState(null)
  const workout = selectedId ? STRENGTH_WORKOUTS.find((w) => w.id === selectedId) : null

  return (
    <div>
      <h2 className="text-xs font-black uppercase tracking-widest text-violet-400 mb-4">Strength Workouts</h2>

      <select
        value={selectedId || ''}
        onChange={(e) => setSelectedId(e.target.value || null)}
        className="w-full border border-violet-200 bg-white px-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-violet-300 mb-3 text-violet-800"
      >
        <option value="">— Select a strength workout —</option>
        {STRENGTH_WORKOUTS.map((w) => (
          <option key={w.id} value={w.id}>{w.title} · {w.type}</option>
        ))}
      </select>

      <div className="flex flex-wrap gap-2 mb-5">
        {STRENGTH_WORKOUTS.map((w) => (
          <button
            key={w.id}
            onClick={() => setSelectedId(w.id === selectedId ? null : w.id)}
            className={`px-3 py-1 text-xs font-bold uppercase tracking-wide border transition-colors ${
              selectedId === w.id
                ? 'bg-violet-200 text-violet-900 border-violet-200'
                : 'bg-white text-violet-500 border-violet-200 hover:bg-violet-50'
            }`}
          >
            {w.title}
          </button>
        ))}
      </div>

      {workout && (
        <div className="border border-violet-100 bg-white overflow-hidden">
          <div className="bg-gradient-to-r from-violet-100 to-rose-100 px-5 py-4 flex items-center justify-between border-b border-violet-200">
            <div>
              <p className="font-black text-base text-violet-900">{workout.title}</p>
              <p className="text-violet-500 text-xs font-bold uppercase tracking-wide mt-0.5">{workout.type}</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-black text-violet-600">{workout.exercises.length}</p>
              <p className="text-violet-400 text-xs uppercase tracking-wide">exercises</p>
            </div>
          </div>
          {workout.note && (
            <div className="border-b border-amber-100 bg-amber-50 px-5 py-3">
              <p className="text-xs font-bold text-amber-700 mb-1 uppercase tracking-wide">Coach Note</p>
              <p className="text-xs text-amber-800 leading-relaxed">{workout.note}</p>
            </div>
          )}
          <div className="divide-y divide-gray-100">
            {workout.exercises.map((ex, i) => (
              <div key={i} className="px-5 py-3 flex items-start gap-4">
                <span className="text-xs font-black text-gray-300 w-5 flex-shrink-0 mt-0.5">{i + 1}</span>
                <div className="flex-1">
                  <p className="text-sm font-bold text-gray-900">{ex.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{ex.reps}</p>
                  {ex.videos.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {ex.videos.map((v, vi) => (
                        <a key={vi} href={v.url} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-0.5 border border-rose-200 bg-rose-50 text-rose-700 text-xs font-bold hover:bg-rose-100 transition-colors"
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
  )
}

// ── Log Modal (full-screen) ───────────────────────────────────────────────────

function LogModal({ assignment, onLogged, onCancel }) {
  const EMPTY = { actualActivity: '', distance: '', duration: '', avgPace: '', avgHeartRate: '', rpe: '', notes: '', splits: [] }
  const [form,   setForm]   = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState(null)

  function set(field, val) { setForm((f) => ({ ...f, [field]: val })) }
  function addSplit()       { setForm((f) => ({ ...f, splits: [...f.splits, ''] })) }
  function removeSplit(i)   { setForm((f) => ({ ...f, splits: f.splits.filter((_, idx) => idx !== i) })) }
  function setSplit(i, val) { setForm((f) => { const s = [...f.splits]; s[i] = val; return { ...f, splits: s } }) }

  async function handleSubmit() {
    if (!form.actualActivity.trim()) { setError('Please describe what you did.'); return }
    setSaving(true); setError(null)
    const logData = {
      actualActivity: form.actualActivity.trim(),
      distance:       form.distance.trim(),
      duration:       form.duration.trim(),
      avgPace:        form.avgPace.trim(),
      avgHeartRate:   form.avgHeartRate.trim(),
      rpe:            form.rpe || null,
      notes:          form.notes.trim(),
      splits:         form.splits.filter(Boolean),
    }
    try {
      await addDoc(collection(db, 'workoutLogs'), {
        assignmentId: assignment.id,
        runnerId:     assignment.runnerId   || '',
        runnerName:   assignment.runnerName || '',
        date:         assignment.date       || '',
        ...logData,
        rpe: logData.rpe ? parseInt(logData.rpe, 10) : null,
        submittedAt: serverTimestamp(),
      })
      storeLog(assignment.id, logData)
      onLogged()
    } catch {
      setError('Something went wrong. Try again.')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-rose-900/30">
      <div className="w-full max-w-xl bg-pink-50 flex flex-col overflow-hidden">

        {/* Header */}
        <div className="bg-gradient-to-r from-rose-200 via-pink-100 to-violet-200 px-6 py-4 flex items-center justify-between flex-shrink-0 border-b border-rose-200">
          <div>
            <p className="font-black text-lg text-rose-900">Log Your Workout</p>
            {assignment.date && (
              <p className="text-rose-500 text-xs font-semibold mt-0.5">
                {format(parseISO(assignment.date + 'T12:00:00'), 'EEEE, MMMM d, yyyy')}
              </p>
            )}
          </div>
          <button onClick={onCancel} className="text-rose-400 hover:text-rose-700 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Assigned workout quick-ref */}
        {(assignment.mainWorkout || assignment.warmup) && (
          <div className="border-b border-rose-100 bg-rose-50 px-5 py-3 flex-shrink-0">
            <p className="text-xs font-black text-rose-400 uppercase tracking-widest mb-1">Assigned Workout</p>
            {assignment.warmup      && <p className="text-xs text-rose-600">Warm-Up: {assignment.warmup}</p>}
            {assignment.mainWorkout && <p className="text-xs font-semibold text-rose-800">Main: {assignment.mainWorkout}</p>}
            {assignment.cooldown    && <p className="text-xs text-rose-600">Cool-Down: {assignment.cooldown}</p>}
          </div>
        )}

        {/* Scrollable form */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 bg-white">

          <div>
            <label className="block text-xs font-black text-gray-700 uppercase tracking-widest mb-1.5">What did you do? *</label>
            <textarea rows={4}
              className="w-full border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400 resize-none"
              placeholder="Describe your workout — completed, modified, how it felt…"
              value={form.actualActivity} onChange={(e) => set('actualActivity', e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {[
              ['Total Distance', 'distance', 'e.g. 5.2 miles'],
              ['Total Time',     'duration', 'e.g. 42:30'],
              ['Avg Pace',       'avgPace',  'e.g. 8:15 / mile'],
              ['Avg Heart Rate', 'avgHeartRate', 'e.g. 162 bpm'],
            ].map(([label, field, placeholder]) => (
              <div key={field}>
                <label className="block text-xs font-black text-gray-700 uppercase tracking-widest mb-1.5">{label}</label>
                <input type="text"
                  className="w-full border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
                  placeholder={placeholder}
                  value={form[field]} onChange={(e) => set(field, e.target.value)}
                />
              </div>
            ))}
          </div>

          {/* Splits */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-black text-gray-700 uppercase tracking-widest">
                Splits <span className="text-gray-400 font-normal normal-case tracking-normal">(track workouts)</span>
              </label>
              <button type="button" onClick={addSplit}
                className="text-xs font-bold text-rose-600 border border-rose-300 px-2 py-1 hover:bg-rose-50 transition-colors uppercase tracking-wide"
              >
                + Add
              </button>
            </div>
            {form.splits.length === 0 ? (
              <p className="text-xs text-gray-300 italic">No splits — click + Add for track workouts</p>
            ) : (
              <div className="space-y-2">
                {form.splits.map((split, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-xs font-black text-gray-300 w-10 text-right">Lap {i + 1}</span>
                    <input type="text"
                      className="flex-1 border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
                      placeholder="e.g. 1:32"
                      value={split} onChange={(e) => setSplit(i, e.target.value)}
                    />
                    <button type="button" onClick={() => removeSplit(i)} className="text-gray-300 hover:text-red-500 transition-colors">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Effort */}
          <div>
            <label className="block text-xs font-black text-gray-700 uppercase tracking-widest mb-2">Effort Level (1–10)</label>
            <div className="flex gap-1.5 flex-wrap">
              {[1,2,3,4,5,6,7,8,9,10].map((n) => (
                <button key={n} type="button" onClick={() => set('rpe', n === form.rpe ? '' : n)}
                  className={`w-9 h-9 text-sm font-black transition-colors border ${
                    form.rpe === n
                      ? 'bg-rose-300 text-rose-900 border-rose-300'
                      : 'bg-white border-rose-200 text-rose-400 hover:bg-rose-50'
                  }`}
                >{n}</button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-black text-gray-700 uppercase tracking-widest mb-1.5">Notes for Coach</label>
            <textarea rows={3}
              className="w-full border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400 resize-none"
              placeholder="Anything else coach should know…"
              value={form.notes} onChange={(e) => set('notes', e.target.value)}
            />
          </div>

          {error && <p className="text-sm font-semibold text-red-500">{error}</p>}
        </div>

        {/* Actions */}
        <div className="px-6 py-4 border-t border-rose-100 flex gap-3 flex-shrink-0 bg-pink-50">
          <button type="button" onClick={onCancel}
            className="flex-1 border border-rose-200 text-rose-500 py-2.5 text-sm font-black uppercase tracking-wide hover:bg-rose-50 transition-colors"
          >
            Cancel
          </button>
          <button type="button" onClick={handleSubmit} disabled={saving}
            className="flex-1 bg-rose-400 hover:bg-rose-500 text-white py-2.5 text-sm font-black uppercase tracking-wide disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving…' : 'Submit Log'}
          </button>
        </div>
      </div>
    </div>
  )
}
