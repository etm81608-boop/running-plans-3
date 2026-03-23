import { useState } from 'react'
import { SWIM_WORKOUTS } from '../data/swimWorkouts'

export default function SwimWorkouts() {
  const [selectedId, setSelectedId] = useState(SWIM_WORKOUTS[0].id)
  const workout = SWIM_WORKOUTS.find((w) => w.id === selectedId)

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Swim Workouts</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          5 cross-training swim workouts for your athletes. Assign via Bulk Assign or Team Grid using the Swim cross-training category.
        </p>
      </div>

      {/* Dropdown selector */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6">
        <label className="block text-sm font-semibold text-gray-700 mb-2">Select a Workout</label>
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white"
        >
          {SWIM_WORKOUTS.map((w) => (
            <option key={w.id} value={w.id}>
              {w.title} — {w.subtitle}
            </option>
          ))}
        </select>

        {/* Quick-pick chips */}
        <div className="flex flex-wrap gap-2 mt-3">
          {SWIM_WORKOUTS.map((w) => (
            <button
              key={w.id}
              onClick={() => setSelectedId(w.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors border ${
                selectedId === w.id
                  ? 'bg-brand-600 text-white border-brand-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-brand-300'
              }`}
            >
              #{w.id.replace('swim', '')} · {w.type}
            </button>
          ))}
        </div>
      </div>

      {/* Workout detail card */}
      {workout && <WorkoutCard workout={workout} />}
    </div>
  )
}

function WorkoutCard({ workout }) {
  const totalYards = workout.sets.reduce((sum, s) => sum + (s.yards || 0), 0)

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-brand-700 to-brand-800 px-6 py-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">🏊</span>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${workout.typeBadge}`}>
                {workout.type}
              </span>
            </div>
            <h2 className="text-xl font-bold text-white">{workout.title}</h2>
            <p className="text-brand-200 text-sm mt-0.5">{workout.subtitle}</p>
          </div>
          <div className="bg-white/10 rounded-xl px-4 py-3 text-center">
            <p className="text-white/70 text-xs font-semibold uppercase tracking-wide">Total</p>
            <p className="text-white text-2xl font-bold leading-none">{totalYards.toLocaleString()}</p>
            <p className="text-white/60 text-xs">yards</p>
          </div>
        </div>
      </div>

      {/* Coach note */}
      {workout.note && (
        <div className="bg-amber-50 border-b border-amber-100 px-6 py-4">
          <p className="text-xs font-bold text-amber-700 uppercase tracking-wide mb-1">📋 Coach Note</p>
          <p className="text-sm text-amber-800 leading-relaxed">{workout.note}</p>
        </div>
      )}

      {/* Sets */}
      <div className="divide-y divide-gray-100">
        {workout.sets.map((set, i) => (
          <div key={i} className="px-6 py-4 flex items-start gap-4">
            <div className="w-8 h-8 rounded-full bg-brand-50 border border-brand-100 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-brand-600">{i + 1}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-0.5">{set.label}</p>
              <p className="text-sm text-gray-800 leading-relaxed">{set.detail}</p>
              {set.rest && (
                <p className="text-xs text-gray-400 mt-1 italic">⏱ {set.rest}</p>
              )}
            </div>
            {set.yards > 0 && (
              <div className="text-right flex-shrink-0">
                <p className="text-sm font-bold text-brand-600">{set.yards}</p>
                <p className="text-xs text-gray-400">yds</p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Footer total */}
      <div className="bg-gray-50 border-t border-gray-100 px-6 py-4 flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-600">Total Distance</p>
        <p className="text-lg font-bold text-brand-700">{totalYards.toLocaleString()} yards</p>
      </div>
    </div>
  )
}
