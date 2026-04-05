import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { collection, getDocs, query, orderBy, limit, where } from 'firebase/firestore'
import { db } from '../firebase/config'
import { format, startOfToday, addDays, isToday, parseISO } from 'date-fns'
import { getWorkoutTypeColor, getWorkoutTypeLabel } from '../utils/constants'

// Real cross-country & track photos (Unsplash, free license)
// Each has a gradient fallback in case the image is blocked by the browser
const HERO_PHOTO = 'https://images.unsplash.com/photo-GJb72h6FeKc?auto=format&fit=crop&w=1400&q=80'
const FALLBACK_GRADIENT = 'linear-gradient(135deg, #0d1b2e 0%, #1a3a2a 50%, #0d1b2e 100%)'

function StatCard({ label, sublabel, value, icon }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4 flex items-center gap-4">
      <div className="text-2xl">{icon}</div>
      <div>
        <p className="text-2xl font-black text-gray-900 leading-none">{value}</p>
        <p className="text-sm font-semibold text-gray-700 mt-0.5">{label}</p>
        <p className="text-xs text-gray-400 mt-0.5">{sublabel}</p>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [stats,    setStats]    = useState({ runners: 0, workouts: 0, groups: 0, assignments: 0 })
  const [upcoming, setUpcoming] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [imgLoaded, setImgLoaded] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const today   = format(startOfToday(), 'yyyy-MM-dd')
        const weekEnd = format(addDays(startOfToday(), 14), 'yyyy-MM-dd')

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
            limit(8),
          )),
        ])

        setStats({
          runners:     rSnap.size,
          workouts:    wSnap.size,
          groups:      gSnap.size,
          assignments: aSnap.size,
        })
        setUpcoming(upSnap.docs.map((d) => ({ id: d.id, ...d.data() })))
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const today = format(startOfToday(), 'EEEE, MMMM d')

  return (
    <div>

      {/* ── Hero Banner ── */}
      <div className="relative overflow-hidden" style={{ height: '200px' }}>
        {/* Gradient fallback always visible underneath */}
        <div className="absolute inset-0" style={{ background: FALLBACK_GRADIENT }} />

        {/* Real photo on top — hides itself on error */}
        <img
          src={HERO_PHOTO}
          alt=""
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700"
          style={{ opacity: imgLoaded ? 1 : 0 }}
          onLoad={() => setImgLoaded(true)}
          onError={(e) => { e.target.style.display = 'none' }}
        />

        {/* Dark overlay so text is always readable */}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to right, rgba(13,27,46,0.88) 40%, rgba(13,27,46,0.5) 100%)' }} />

        {/* Content */}
        <div className="relative h-full flex flex-col justify-end px-8 pb-6">
          <div className="flex items-end justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <img
                  src="https://resources.finalsite.net/images/v1752766793/episcopalacademypa/iki09ehlwxicgcugftmq/sheid_full.svg"
                  alt="EA"
                  className="h-5 w-5 object-contain opacity-80"
                  onError={(e) => e.target.style.display = 'none'}
                />
                <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#c4a332' }}>
                  Episcopal Academy
                </span>
              </div>
              <h1 className="text-2xl font-black text-white leading-tight">Track & Cross Country</h1>
              <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.55)' }}>{today}</p>
            </div>
            <Link
              to="/assign"
              className="text-sm font-semibold px-4 py-2 rounded-lg transition-opacity hover:opacity-90 flex-shrink-0"
              style={{ background: '#c4a332', color: '#0d1b2e' }}
            >
              + Assign Workout
            </Link>
          </div>
        </div>
      </div>

      <div className="p-6 max-w-5xl">

        {/* ── Stats ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <StatCard
            label="Athletes on Roster"
            sublabel="registered this season"
            value={loading ? '—' : stats.runners}
            icon="🏃"
          />
          <StatCard
            label="Workout Templates"
            sublabel="in your library"
            value={loading ? '—' : stats.workouts}
            icon="📋"
          />
          <StatCard
            label="Training Groups"
            sublabel="active groups"
            value={loading ? '—' : stats.groups}
            icon="👥"
          />
          <StatCard
            label="Workouts Assigned"
            sublabel="total this season"
            value={loading ? '—' : stats.assignments}
            icon="📅"
          />
        </div>

        {/* ── Upcoming workouts ── */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-50">
            <div>
              <h2 className="text-sm font-bold text-gray-900">Upcoming Workouts</h2>
              <p className="text-xs text-gray-400">Next 14 days</p>
            </div>
            <Link to="/calendar" className="text-xs font-semibold hover:underline" style={{ color: '#c4a332' }}>
              Open calendar →
            </Link>
          </div>

          {loading ? (
            <div className="px-5 py-8 text-center text-sm text-gray-400">Loading…</div>
          ) : upcoming.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="text-sm text-gray-400 mb-2">No workouts scheduled in the next 14 days.</p>
              <Link to="/assign" className="text-sm font-semibold hover:underline" style={{ color: '#c4a332' }}>
                Assign a workout →
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {upcoming.map((a) => {
                const dateObj = a.date ? parseISO(a.date + 'T12:00:00') : null
                const isItToday = dateObj ? isToday(dateObj) : false
                return (
                  <div key={a.id} className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50 transition-colors">
                    {/* Date column */}
                    <div className="text-center min-w-[40px]">
                      <p className="text-xs font-semibold uppercase" style={{ color: isItToday ? '#c4a332' : '#9ca3af' }}>
                        {dateObj ? format(dateObj, 'MMM') : ''}
                      </p>
                      <p className={`text-xl font-black leading-none ${isItToday ? 'text-gray-900' : 'text-gray-700'}`}>
                        {dateObj ? format(dateObj, 'd') : ''}
                      </p>
                      <p className="text-xs text-gray-400">{dateObj ? format(dateObj, 'EEE') : ''}</p>
                    </div>

                    {/* Divider */}
                    <div className="w-px h-10 bg-gray-100 flex-shrink-0" />

                    {/* Workout info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-sm truncate">{a.workoutTitle || 'Workout'}</p>
                      <p className="text-xs text-gray-400 truncate">
                        {Array.isArray(a.runnerNames) && a.runnerNames.length > 0
                          ? a.runnerNames.slice(0, 3).join(', ') + (a.runnerNames.length > 3 ? ` +${a.runnerNames.length - 3} more` : '')
                          : a.groupName || 'All runners'}
                      </p>
                    </div>

                    {/* Type badge */}
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium shrink-0 ${getWorkoutTypeColor(a.workoutType)}`}>
                      {getWorkoutTypeLabel(a.workoutType)}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Quick links ── */}
        <div className="mt-4 flex gap-3">
          <Link to="/roster" className="flex-1 text-center text-xs font-semibold py-2.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
            Manage Roster
          </Link>
          <Link to="/workouts" className="flex-1 text-center text-xs font-semibold py-2.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
            Workout Library
          </Link>
          <Link to="/logs" className="flex-1 text-center text-xs font-semibold py-2.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
            Runner Logs
          </Link>
        </div>

      </div>
    </div>
  )
}
