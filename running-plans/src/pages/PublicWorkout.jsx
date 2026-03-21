import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase/config'
import { format } from 'date-fns'

export default function PublicWorkout() {
  const { assignmentId } = useParams()
  const [assignment, setAssignment] = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState(null)

  useEffect(() => {
    async function load() {
      try {
        const snap = await getDoc(doc(db, 'assignments', assignmentId))
        if (!snap.exists()) {
          setError('Workout not found. This link may be invalid.')
        } else {
          setAssignment({ id: snap.id, ...snap.data() })
        }
      } catch {
        setError('Unable to load workout. Please try again later.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [assignmentId])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400">Loading workout…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <span className="text-5xl">🤔</span>
          <p className="mt-4 text-gray-600">{error}</p>
        </div>
      </div>
    )
  }

  const a = assignment

  // Support both old and new data shapes
  const warmup       = a.warmup       || a.workoutData?.warmup        || ''
  const mainWorkout  = a.mainWorkout  || a.workoutData?.mainSet       || ''
  const cooldown     = a.cooldown     || a.workoutData?.cooldown      || ''
  const crossTraining= a.crossTraining|| a.workoutData?.crossTraining || ''
  const notes        = a.notes        || a.workoutData?.notes         || ''

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-800 to-brand-900 flex items-start justify-center p-4 py-12">
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="bg-brand-700 px-7 py-6 text-white">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xl">🏃</span>
            <span className="text-sm font-medium text-brand-300">Team Running Plans</span>
          </div>
          {a.runnerName && (
            <p className="text-brand-300 text-sm font-medium mb-1">For {a.runnerName}</p>
          )}
          <p className="text-brand-200 text-sm">
            {a.date ? format(new Date(a.date + 'T12:00:00'), 'EEEE, MMMM d, yyyy') : ''}
          </p>
        </div>

        {/* Body */}
        <div className="px-7 py-6 space-y-4">

          {warmup && (
            <Block emoji="🔥" title="Warm-Up" content={warmup} color="bg-green-50 border-green-100" />
          )}

          {mainWorkout && (
            <Block emoji="⚡" title="Main Workout" content={mainWorkout} color="bg-brand-50 border-brand-100" />
          )}

          {cooldown && (
            <Block emoji="❄️" title="Cool-Down" content={cooldown} color="bg-blue-50 border-blue-100" />
          )}

          {crossTraining && (
            <Block emoji="💪" title="Cross Training" content={crossTraining} color="bg-teal-50 border-teal-100" />
          )}

          {notes && (
            <Block emoji="📝" title="Coach's Notes" content={notes} color="bg-amber-50 border-amber-100" />
          )}

          {!warmup && !mainWorkout && !cooldown && !crossTraining && (
            <p className="text-gray-400 text-sm text-center py-4">No workout details added yet.</p>
          )}
        </div>

        <div className="px-7 py-4 bg-gray-50 border-t border-gray-100 text-xs text-center text-gray-400">
          Sent via Team Running Plans · Good luck today! 🏆
        </div>
      </div>
    </div>
  )
}

function Block({ emoji, title, content, color = 'bg-gray-50 border-gray-100' }) {
  return (
    <div className={`rounded-2xl border p-4 ${color}`}>
      <p className="font-semibold text-gray-800 mb-2">{emoji} {title}</p>
      <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{content}</p>
    </div>
  )
}

