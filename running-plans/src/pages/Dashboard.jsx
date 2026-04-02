import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { collection, getDocs, query, orderBy, limit, where } from 'firebase/firestore'
import { db } from '../firebase/config'
import { format, startOfToday, addDays } from 'date-fns'
import { getWorkoutTypeColor, getWorkoutTypeLabel } from '../utils/constants'

function StatCard({ label, value, icon, color }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-emerald-100 p-5 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-sm text-gray-500">{label}</p>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [stats,      setStats]      = useState({ runners: 0, workouts: 0, groups: 0, assignments: 0 })
  const [upcoming,   setUpcoming]   = useState([])
  const [loading,    setLoading]    = useState(true)

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
            limit(10),
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

  return (
    <div>
      {/* Nature/Track Hero Banner */}
      <div
        className="relative overflow-hidden px-8 pt-10 pb-8"
        style={{ background: 'linear-gradient(135deg, #052e16 0%, #14532d 40%, #164e63 100%)' }}
      >
        {/* Decorative track lane lines */}
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 60px, rgba(255,255,255,0.4) 60px, rgba(255,255,255,0.4) 62px)',
        }} />
        {/* Tree silhouette accent */}
        <svg className="absolute right-0 bottom-0 opacity-10 h-32" viewBox="0 0 200 120" fill="white" xmlns="http://www.w3.org/2000/svg">
          <polygon points="100,0 140,60 120,60 150,100 110,100 110,120 90,120 90,100 50,100 80,60 60,60" />
          <polygon points="160,20 190,70 175,70 195,110 165,110 165,120 155,120 155,110 125,110 145,70 130,70" />
          <polygon points="30,30 60,80 45,80 65,115 35,115 35,120 25,120 25,115 -5,115 15,80 0,80" />
        </svg>
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-1">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span className="text-emerald-400 text-xs font-semibold uppercase tracking-widest">Coach Dashboard</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Welcome back, Coach.</h1>
          <p className="text-emerald-200/70 text-sm mt-1">Here's your team overview — let's have a great season.</p>
        </div>
      </div>

      <div className="p-8">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          <StatCard label="Runners"         value={stats.runners}     icon="🏃" color="bg-emerald-50" />
          <StatCard label="Workout Library" value={stats.workouts}    icon="📋" color="bg-sky-50" />
          <StatCard label="Training Groups" value={stats.groups}      icon="👥" color="bg-teal-50" />
          <StatCard label="Assignments"     value={stats.assignments} icon="📅" color="bg-cyan-50" />
        </div>

        {/* Upcoming workouts */}
        <div className="bg-white rounded-2xl shadow-sm border border-emerald-100 p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-semibold text-gray-900">Upcoming Workouts (next 14 days)</h2>
            <Link to="/calendar" className="text-sm text-emerald-700 hover:underline font-medium">
              View calendar →
            </Link>
          </div>

          {loading ? (
            <p className="text-sm text-gray-400">Loading…</p>
          ) : upcoming.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-gray-400 text-sm">No workouts scheduled in the next 14 days.</p>
              <Link to="/assign" className="mt-3 inline-block text-sm text-emerald-700 font-medium hover:underline">
                Assign a workout →
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {upcoming.map((a) => (
                <div key={a.id} className="flex items-center gap-4 p-3 rounded-xl bg-emerald-50/40 hover:bg-emerald-50 transition-colors">
                  <div className="text-center min-w-[48px]">
                    <p className="text-xs text-emerald-500 uppercase font-medium">{a.date ? format(new Date(a.date + 'T12:00:00'), 'MMM') : ''}</p>
                    <p className="text-xl font-bold text-gray-800">{a.date ? format(new Date(a.date + 'T12:00:00'), 'd') : ''}</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{a.workoutTitle || 'Workout'}</p>
                    <p className="text-xs text-gray-500">
                      {Array.isArray(a.runnerNames) && a.runnerNames.length > 0
                        ? a.runnerNames.slice(0, 3).join(', ') + (a.runnerNames.length > 3 ? ` +${a.runnerNames.length - 3}` : '')
                        : a.groupName || 'All runners'}
                    </p>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium shrink-0 ${getWorkoutTypeColor(a.workoutType)}`}>
                    {getWorkoutTypeLabel(a.workoutType)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link to="/assign"   className="text-white rounded-xl p-4 text-center font-medium transition-colors" style={{ background: 'linear-gradient(135deg, #15803d, #0369a1)' }}
            onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
          >
            + Assign Workout
          </Link>
          <Link to="/roster"   className="bg-white border border-emerald-200 hover:bg-emerald-50 text-gray-700 rounded-xl p-4 text-center font-medium transition-colors">
            Manage Roster
          </Link>
          <Link to="/workouts" className="bg-white border border-emerald-200 hover:bg-emerald-50 text-gray-700 rounded-xl p-4 text-center font-medium transition-colors">
            Workout Library
          </Link>
        </div>
      </div>
    </div>
  )
}
