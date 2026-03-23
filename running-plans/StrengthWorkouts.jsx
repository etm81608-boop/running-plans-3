import { useState } from 'react'
import { STRENGTH_WORKOUTS } from '../data/strengthWorkouts'

export default function StrengthWorkouts() {
  const [selectedId, setSelectedId] = useState(STRENGTH_WORKOUTS[0].id)
  const workout = STRENGTH_WORKOUTS.find((w) => w.id === selectedId)

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Strength Workouts</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Harvard Track strength program — 4 workouts. Each exercise includes a video link where available.
        </p>
      </div>

      {/* Dropdown + chips */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6">
        <label className="block text-sm font-semibold text-gray-700 mb-2">Select a Workout</label>
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white"
        >
          {STRENGTH_WORKOUTS.map((w) => (
            <option key={w.id} value={w.id}>
              {w.title} — {w.type}
            </option>
          ))}
        </select>

        <div className="flex flex-wrap gap-2 mt-3">
          {STRENGTH_WORKOUTS.map((w) => (
            <button
              key={w.id}
              onClick={() => setSelectedId(w.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors border ${
                selectedId === w.id
                  ? 'bg-brand-600 text-white border-brand-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-brand-300'
              }`}
            >
              #{w.id.replace('str', '')} · {w.type}
            </button>
          ))}
        </div>
      </div>

      {workout && <WorkoutCard workout={workout} />}
    </div>
  )
}

function WorkoutCard({ workout }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-brand-700 to-brand-800 px-6 py-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">💪</span>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${workout.typeBadge}`}>
                {workout.type}
              </span>
            </div>
            <h2 className="text-xl font-bold text-white">{workout.title}</h2>
          </div>
          <div className="bg-white/10 rounded-xl px-4 py-3 text-center">
            <p className="text-white/70 text-xs font-semibold uppercase tracking-wide">Exercises</p>
            <p className="text-white text-2xl font-bold leading-none">{workout.exercises.length}</p>
          </div>
        </div>
      </div>

      {/* Note */}
      {workout.note && (
        <div className="bg-amber-50 border-b border-amber-100 px-6 py-4">
          <p className="text-xs font-bold text-amber-700 uppercase tracking-wide mb-1">📋 Coach Note</p>
          <p className="text-sm text-amber-800 leading-relaxed">{workout.note}</p>
        </div>
      )}

      {/* Exercise list */}
      <div className="divide-y divide-gray-100">
        {workout.exercises.map((ex, i) => (
          <ExerciseRow key={i} index={i} exercise={ex} />
        ))}
      </div>
    </div>
  )
}

function ExerciseRow({ index, exercise }) {
  return (
    <div className="px-6 py-4 flex items-start gap-4">
      <div className="w-7 h-7 rounded-full bg-brand-50 border border-brand-100 flex items-center justify-center flex-shrink-0 mt-0.5">
        <span className="text-xs font-bold text-brand-600">{index + 1}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900">{exercise.name}</p>
        <p className="text-xs text-gray-500 mt-0.5">{exercise.reps}</p>
        {exercise.videos.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {exercise.videos.map((v, vi) => (
              <a
                key={vi}
                href={v.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 border border-red-200 text-red-700 text-xs font-semibold hover:bg-red-100 transition-colors"
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
  )
}
