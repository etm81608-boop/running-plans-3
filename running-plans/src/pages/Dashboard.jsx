import { useEffect, useState, useMemo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { collection, getDocs, query, orderBy, limit, where } from 'firebase/firestore'
import { db } from '../firebase/config'
import { format, startOfToday, addDays, isToday, parseISO, isTomorrow } from 'date-fns'
import { getWorkoutTypeColor, getWorkoutTypeLabel } from '../utils/constants'

// ── Team photo imports (Vite processes these as hashed assets) ────────────────
import photoTeamXC      from '../assets/photos/team-xc-2025.jpg'
import photoPennStadium from '../assets/photos/penn-relays-stadium.jpg'
import photoDelco       from '../assets/photos/delco-champs.jpg'
import photoNXR         from '../assets/photos/nxr-2025.jpg'
import photoPennFranklin from '../assets/photos/penn-relays-franklin.jpg'
import photoDelcoMS     from '../assets/photos/delco-ms-champs.jpg'
import photoDelcoTrio   from '../assets/photos/delco-champs-trio.jpg'
import photoCoach       from '../assets/photos/penn-relays-coach.jpg'

const PHOTOS = [
  { src: photoTeamXC,       caption: '2025 Episcopal Academy Girls Cross Country Team' },
  { src: photoPennStadium,  caption: 'Penn Relays · Franklin Field' },
  { src: photoDelco,        caption: '2025 Delaware County Cross Country Champions' },
  { src: photoNXR,          caption: 'NXR Northeast Championship 2025 · Bowdoin Park, NY' },
  { src: photoPennFranklin, caption: 'Penn Relays · Penn Campus' },
  { src: photoDelcoMS,      caption: '2025 Delaware County Middle School XC Champions' },
]

// ── helpers ───────────────────────────────────────────────────────────────────

function dayLabel(dateStr) {
  const d = parseISO(dateStr + 'T12:00:00')
  if (isToday(d))    return 'Today'
  if (isTomorrow(d)) return 'Tomorrow'
  return format(d, 'EEEE')
}

// ── Photo Hero ────────────────────────────────────────────────────────────────

function PhotoHero() {
  const [idx,    setIdx]    = useState(0)
  const [fading, setFading] = useState(false)

  const goTo = useCallback((next) => {
    setFading(true)
    setTimeout(() => {
      setIdx(next)
      setFading(false)
    }, 400)
  }, [])

  // Auto-advance every 5 s
  useEffect(() => {
    const id = setInterval(() => {
      setIdx(prev => {
        const next = (prev + 1) % PHOTOS.length
        setFading(true)
        setTimeout(() => setFading(false), 400)
        return next
      })
    }, 5000)
    return () => clearInterval(id)
  }, [])

  const photo = PHOTOS[idx]

  return (
    <div style={{ position: 'relative', height: '220px', overflow: 'hidden', background: '#0d1b2e' }}>
      {/* Photo */}
      <img
        src={photo.src}
        alt={photo.caption}
        style={{
          position: 'absolute', inset: 0,
          width: '100%', height: '100%',
          objectFit: 'cover', objectPosition: 'center 30%',
          opacity: fading ? 0 : 1,
          transition: 'opacity 0.4s ease',
        }}
      />

      {/* Gradient overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(to bottom, rgba(13,27,46,0.1) 0%, rgba(13,27,46,0.0) 35%, rgba(13,27,46,0.7) 100%)',
        pointerEvents: 'none',
      }} />

      {/* Caption + dots */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        padding: '10px 16px',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
      }}>
        <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: '11px', fontWeight: 500, letterSpacing: '0.02em', textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}>
          {photo.caption}
        </p>
        <div style={{ display: 'flex', gap: '5px', alignItems: 'center', flexShrink: 0, marginLeft: '12px' }}>
          {PHOTOS.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              style={{
                width: i === idx ? '18px' : '6px',
                height: '6px',
                borderRadius: '3px',
                background: i === idx ? '#c4a332' : 'rgba(255,255,255,0.45)',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                transition: 'all 0.3s ease',
              }}
            />
          ))}
        </div>
      </div>

      {/* Left / right arrows */}
      <button
        onClick={() => goTo((idx - 1 + PHOTOS.length) % PHOTOS.length)}
        style={{
          position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)',
          background: 'rgba(0,0,0,0.3)', border: 'none', borderRadius: '50%',
          width: '30px', height: '30px', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'white', fontSize: '16px', fontWeight: 'bold',
        }}
      >‹</button>
      <button
        onClick={() => goTo((idx + 1) % PHOTOS.length)}
        style={{
          position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
          background: 'rgba(0,0,0,0.3)', border: 'none', borderRadius: '50%',
          width: '30px', height: '30px', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'white', fontSize: '16px', fontWeight: 'bold',
        }}
      >›</button>
    </div>
  )
}

// ── main ─────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [stats,    setStats]    = useState({ runners: 0, workouts: 0, groups: 0, assignments: 0 })
  const [upcoming, setUpcoming] = useState([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const today   = format(startOfToday(), 'yyyy-MM-dd')
        const weekEnd = format(addDays(startOfToday(), 7), 'yyyy-MM-dd')

        const [rSnap, wSnap, gSnap, aSnap, upSnap] = await Promise.all([
          getDocs(collection(db, 'runners')),
          getDocs(collection(db, 'workouts')),
          getDocs(collection(db, 'groups')),
          getDocs(collection(db, 'assignments')),
          getDocs(query(
            collection(db, 'assignments'),
            where('date', '>=', today),
            where('date', '<=', weekEnd),
            orderBy('date', 'asc'),
            limit(60),
          )),
        ])

        setStats({ runners: rSnap.size, workouts: wSnap.size, groups: gSnap.size, assignments: aSnap.size })
        setUpcoming(upSnap.docs.map((d) => ({ id: d.id, ...d.data() })))
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // Group assignments: one block per unique workout per day
  const schedule = useMemo(() => {
    const byDate = {}
    upcoming.forEach((a) => {
      if (!a.date) return
      if (!byDate[a.date]) byDate[a.date] = {}
      const key = a.workoutTitle || a.workoutType || 'Workout'
      if (!byDate[a.date][key]) {
        byDate[a.date][key] = {
          workoutTitle: a.workoutTitle || getWorkoutTypeLabel(a.workoutType) || 'Workout',
          workoutType:  a.workoutType,
          mainWorkout:  a.mainWorkout || '',
          runners:      [],
        }
      }
      if (a.runnerName) byDate[a.date][key].runners.push(a.runnerName)
    })

    return Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, workoutsMap]) => ({
        date,
        workouts: Object.values(workoutsMap),
      }))
  }, [upcoming])

  const todayStr = format(startOfToday(), 'yyyy-MM-dd')
  const todaySchedule = schedule.find(s => s.date === todayStr)

  return (
    <div className="min-h-screen" style={{ background: '#f5f4f0' }}>

      {/* ── Page header ── */}
      <div className="flex items-center justify-between px-7 py-4" style={{ background: '#0d1b2e', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="flex items-center gap-3">
          <img
            src="https://resources.finalsite.net/images/v1752766793/episcopalacademypa/iki09ehlwxicgcugftmq/sheid_full.svg"
            alt="EA" className="h-7 w-7 object-contain opacity-90"
            onError={e => e.target.style.display = 'none'}
          />
          <div>
            <p className="text-white font-bold text-sm leading-tight">Episcopal Academy</p>
            <p className="text-xs leading-tight" style={{ color: '#c4a332' }}>Track & Cross Country</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{format(startOfToday(), 'EEEE, MMMM d')}</p>
          <Link to="/assign" className="text-xs font-bold px-3 py-1.5 rounded-lg" style={{ background: '#c4a332', color: '#0d1b2e' }}>
            + Assign Workout
          </Link>
        </div>
      </div>

      {/* ── Photo hero ── */}
      <PhotoHero />

      <div className="flex gap-5 p-6 max-w-6xl">

        {/* ── Left: weekly schedule (main content) ── */}
        <div className="flex-1 min-w-0">

          {/* TODAY callout */}
          {!loading && todaySchedule && (
            <div className="mb-4 rounded-xl overflow-hidden border" style={{ background: '#0d1b2e', borderColor: '#c4a332' }}>
              <div className="px-4 py-2 flex items-center gap-2" style={{ borderBottom: '1px solid rgba(196,163,50,0.2)' }}>
                <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#c4a332' }}>Today</span>
                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{format(parseISO(todayStr + 'T12:00:00'), 'MMMM d')}</span>
              </div>
              <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                {todaySchedule.workouts.map((w, i) => (
                  <div key={i} className="px-4 py-3 flex items-start gap-3">
                    <span className={`mt-0.5 text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${getWorkoutTypeColor(w.workoutType)}`}>
                      {getWorkoutTypeLabel(w.workoutType)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white">{w.workoutTitle}</p>
                      {w.mainWorkout && (
                        <p className="text-xs mt-0.5 line-clamp-2" style={{ color: 'rgba(255,255,255,0.45)' }}>{w.mainWorkout}</p>
                      )}
                      <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
                        {w.runners.length > 0
                          ? `${w.runners.length} runner${w.runners.length !== 1 ? 's' : ''} · ${w.runners.slice(0,3).join(', ')}${w.runners.length > 3 ? ` +${w.runners.length - 3}` : ''}`
                          : 'All runners'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Upcoming days */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-sm font-bold text-gray-800">This Week</h2>
              <Link to="/calendar" className="text-xs font-semibold" style={{ color: '#c4a332' }}>
                Full calendar →
              </Link>
            </div>

            {loading ? (
              <div className="py-10 text-center text-sm text-gray-400">Loading…</div>
            ) : schedule.filter(s => s.date !== todayStr).length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-sm text-gray-400">Nothing else scheduled this week.</p>
                <Link to="/assign" className="mt-2 inline-block text-xs font-semibold" style={{ color: '#c4a332' }}>
                  Assign a workout →
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {schedule.filter(s => s.date !== todayStr).map(({ date, workouts }) => {
                  const d = parseISO(date + 'T12:00:00')
                  return (
                    <div key={date} className="flex gap-0">
                      {/* Date strip */}
                      <div className="w-16 flex-shrink-0 flex flex-col items-center justify-start pt-3 pb-2 border-r border-gray-100">
                        <p className="text-xs font-bold uppercase" style={{ color: '#c4a332' }}>{format(d, 'EEE')}</p>
                        <p className="text-2xl font-black text-gray-800 leading-none">{format(d, 'd')}</p>
                        <p className="text-xs text-gray-400">{format(d, 'MMM')}</p>
                      </div>
                      {/* Workouts */}
                      <div className="flex-1 divide-y divide-gray-50">
                        {workouts.map((w, i) => (
                          <div key={i} className="flex items-start gap-3 px-4 py-2.5">
                            <span className={`mt-0.5 text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${getWorkoutTypeColor(w.workoutType)}`}>
                              {getWorkoutTypeLabel(w.workoutType)}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-gray-900 truncate">{w.workoutTitle}</p>
                              <p className="text-xs text-gray-400">
                                {w.runners.length > 0
                                  ? `${w.runners.length} runner${w.runners.length !== 1 ? 's' : ''}`
                                  : 'All runners'}
                                {w.mainWorkout ? ` · ${w.mainWorkout.slice(0, 60)}${w.mainWorkout.length > 60 ? '…' : ''}` : ''}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Right sidebar ── */}
        <div className="w-52 flex-shrink-0 space-y-4">

          {/* Stats */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-2.5 border-b border-gray-50">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Season Overview</p>
            </div>
            {[
              { n: stats.runners,     label: 'Athletes on roster',  link: '/roster'   },
              { n: stats.groups,      label: 'Training groups',     link: '/groups'   },
              { n: stats.workouts,    label: 'Workout templates',   link: '/workouts' },
              { n: stats.assignments, label: 'Workouts assigned',   link: '/assign'   },
            ].map(({ n, label, link }) => (
              <Link key={label} to={link} className="flex items-center justify-between px-4 py-2.5 border-b border-gray-50 hover:bg-gray-50 transition-colors group last:border-0">
                <span className="text-xs text-gray-500 group-hover:text-gray-700 transition-colors leading-tight">{label}</span>
                <span className="text-lg font-black text-gray-900 tabular-nums">{loading ? '—' : n}</span>
              </Link>
            ))}
          </div>

          {/* Quick actions */}
          <div className="space-y-2">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider px-1">Quick Actions</p>
            {[
              { to: '/assign',    label: 'Assign Workout',   primary: true  },
              { to: '/team-grid', label: 'Open Team Grid',   primary: false },
              { to: '/logs',      label: 'View Runner Logs', primary: false },
              { to: '/meets',     label: 'Meet Schedule',    primary: false },
            ].map(({ to, label, primary }) => (
              <Link
                key={to} to={to}
                className="block text-center text-xs font-semibold py-2 rounded-lg transition-colors"
                style={primary
                  ? { background: '#0d1b2e', color: '#c4a332' }
                  : { background: '#fff', border: '1px solid #e5e7eb', color: '#374151' }
                }
              >
                {label}
              </Link>
            ))}
          </div>

          {/* Champs photo card */}
          <div style={{ borderRadius: '10px', overflow: 'hidden', border: '1px solid #e5e7eb' }}>
            <img
              src={photoDelcoTrio}
              alt="2025 Delco XC Champions"
              style={{ width: '100%', height: '110px', objectFit: 'cover', objectPosition: 'center 15%', display: 'block' }}
            />
            <div style={{ background: '#0d1b2e', padding: '6px 10px' }}>
              <p style={{ fontSize: '9px', color: '#c4a332', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                2025 Delco XC Champions
              </p>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
