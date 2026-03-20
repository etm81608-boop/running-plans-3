import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase/config'
import { getWorkoutTypeLabel, getWorkoutTypeColor } from '../utils/constants'
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
      } catch (err) {
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

  const w = assignment.workoutData || {}

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-800 to-brand-900 flex items-start justify-center p-4 py-12">
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-brand-700 px-7 py-6 text-white">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl">🏃</span>
            <span className="text-sm font-medium text-brand-300">Team Running Plans</span>
          </div>
          <h1 className="text-2xl font-bold mt-1">{assignment.workoutTitle}</h1>
          <p className="text-brand-300 text-sm mt-1">
            {assignment.date ? format(new Date(assignment.date + 'T12:00:00'), 'EEEE, MMMM d, yyyy') : ''}
          </p>
        </div>

        {/* Body */}
        <div className="px-7 py-6 space-y-5">
          <span className={`inline-block text-xs px-3 py-1 rounded-full font-medium ${getWorkoutTypeColor(assignment.workoutType)}`}>
            {getWorkoutTypeLabel(assignment.workoutType)}
          </span>

          {w.description && (
            <p className="text-gray-600 text-sm">{w.description}</p>
          )}

          {w.targetPace && (
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium text-gray-700">Target pace:</span>
              <span className="text-brand-600 font-semibold">{w.targetPace}</span>
            </div>
          )}

          {w.warmup && (
            <Block emoji="🔥" title="Warm-Up" content={w.warmup} />
          )}

          {w.mainSet && (
            <Block emoji="⚡" title="Main Set" content={w.mainSet} color="bg-brand-50 border-brand-100" />
          )}

          {w.cooldown && (
            <Block emoji="❄️" title="Cool-Down" content={w.cooldown} />
          )}

          {/* Coach's notes for this assignment */}
          {assignment.notes && (
            <Block emoji="📝" title="Coach's Notes" content={assignment.notes} color="bg-amber-50 border-amber-100" />
          )}

          {/* Workout library notes */}
          {w.notes && w.notes !== assignment.notes && (
            <Block emoji="💬" title="Additional Notes" content={w.notes} />
          )}
        </div>

        <div className="px-7 py-4 bg-gray-50 border-t border-gray-100 text-xs text-center text-gray-400">
          Sent via Team Running Plans &middot; Good luck today!
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
