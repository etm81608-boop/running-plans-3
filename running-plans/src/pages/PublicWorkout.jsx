import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { doc, getDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase/config'
import { format } from 'date-fns'

// localStorage helpers — remember if this device already submitted for this workout
function getStoredLog(assignmentId) {
  try { return JSON.parse(localStorage.getItem(`wlog_${assignmentId}`) || 'null') } catch { return null }
}
function storeLog(assignmentId, data) {
  try { localStorage.setItem(`wlog_${assignmentId}`, JSON.stringify(data)) } catch {}
}

export default function PublicWorkout() {
  const { assignmentId } = useParams()
  const [assignment, setAssignment] = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState(null)

  // Log state — check localStorage immediately so there's no flash of the form
  const [savedLog,      setSavedLog]      = useState(() => getStoredLog(assignmentId))
  const [logForm,       setLogForm]       = useState({ actualActivity: '', distance: '', duration: '', rpe: '', notes: '' })
  const [logSaving,     setLogSaving]     = useState(false)
  const [logError,      setLogError]      = useState(null)

  useEffect(() => {
    async function load() {
      try {
        const snap = await getDoc(doc(db, 'assignments', assignmentId))
        if (!snap.exists()) {
          setError('Workout not found. This link may be invalid.')
          setLoading(false)
          return
        }
        setAssignment({ id: snap.id, ...snap.data() })
      } catch {
        setError('Unable to load workout. Please try again later.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [assignmentId])

  async function handleLogSubmit(e) {
    e.preventDefault()
    if (!logForm.actualActivity.trim()) {
      setLogError('Please describe what you did before submitting.')
      return
    }
    setLogSaving(true)
    setLogError(null)
    const logData = {
      actualActivity: logForm.actualActivity.trim(),
      distance:       logForm.distance.trim(),
      duration:       logForm.duration.trim(),
      rpe:            logForm.rpe || null,
      notes:          logForm.notes.trim(),
    }
    try {
      await addDoc(collection(db, 'workoutLogs'), {
        assignmentId,
        runnerId:   assignment.runnerId   || '',
        runnerName: assignment.runnerName || '',
        date:       assignment.date       || '',
        ...logData,
        rpe:        logData.rpe ? parseInt(logData.rpe, 10) : null,
        submittedAt: serverTimestamp(),
      })
      // Save to localStorage so this device remembers the submission
      storeLog(assignmentId, logData)
      setSavedLog(logData)
    } catch {
      setLogError('Something went wrong. Please try again.')
    } finally {
      setLogSaving(false)
    }
  }

  function setLog(field, val) {
    setLogForm((f) => ({ ...f, [field]: val }))
  }

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
      <div className="w-full max-w-lg space-y-5">

        {/* ── Workout Card ── */}
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">

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

        {/* ── Log Your Activity Card ── */}
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
          <div className="bg-emerald-600 px-7 py-5 text-white">
            <h2 className="text-lg font-bold">📋 Log Your Activity</h2>
            <p className="text-emerald-200 text-sm mt-0.5">Let your coach know how it went</p>
          </div>

          <div className="px-7 py-6">

            {/* Already submitted confirmation */}
            {savedLog ? (
              <div className="text-center py-4">
                <span className="text-5xl">✅</span>
                <p className="mt-3 text-lg font-semibold text-gray-800">Activity logged!</p>
                <p className="text-sm text-gray-500 mt-1">Your coach can see your response.</p>
                <div className="mt-5 text-left bg-gray-50 rounded-2xl p-4 space-y-2">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Your submission</p>
                  {savedLog.actualActivity && (
                    <p className="text-sm text-gray-700"><span className="font-semibold">What you did:</span> {savedLog.actualActivity}</p>
                  )}
                  {savedLog.distance && (
                    <p className="text-sm text-gray-700"><span className="font-semibold">Distance:</span> {savedLog.distance}</p>
                  )}
                  {savedLog.duration && (
                    <p className="text-sm text-gray-700"><span className="font-semibold">Time:</span> {savedLog.duration}</p>
                  )}
                  {savedLog.rpe && (
                    <p className="text-sm text-gray-700"><span className="font-semibold">Effort (RPE):</span> {savedLog.rpe}/10</p>
                  )}
                  {savedLog.notes && (
                    <p className="text-sm text-gray-700"><span className="font-semibold">Notes:</span> {savedLog.notes}</p>
                  )}
                </div>
              </div>
            ) : (
              <form onSubmit={handleLogSubmit} className="space-y-4">

                {/* What did you do */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    What did you actually do? <span className="text-red-400">*</span>
                  </label>
                  <textarea
                    rows={3}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none"
                    placeholder="e.g. Completed the full workout, modified the intervals, did 4 instead of 6…"
                    value={logForm.actualActivity}
                    onChange={(e) => setLog('actualActivity', e.target.value)}
                  />
                </div>

                {/* Distance + Time row */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Distance <span className="text-gray-400 font-normal">(optional)</span></label>
                    <input
                      type="text"
                      className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                      placeholder="e.g. 5.2 miles"
                      value={logForm.distance}
                      onChange={(e) => setLog('distance', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Total time <span className="text-gray-400 font-normal">(optional)</span></label>
                    <input
                      type="text"
                      className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                      placeholder="e.g. 42 min"
                      value={logForm.duration}
                      onChange={(e) => setLog('duration', e.target.value)}
                    />
                  </div>
                </div>

                {/* RPE */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    How hard did it feel? <span className="text-gray-400 font-normal">(1 = very easy, 10 = max effort)</span>
                  </label>
                  <div className="flex gap-2 flex-wrap">
                    {[1,2,3,4,5,6,7,8,9,10].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setLog('rpe', n === logForm.rpe ? '' : n)}
                        className={`w-9 h-9 rounded-xl text-sm font-bold transition-colors ${
                          logForm.rpe === n
                            ? 'bg-emerald-600 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-emerald-100'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Anything else to share? <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <textarea
                    rows={2}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none"
                    placeholder="How you felt, any issues, splits, weather…"
                    value={logForm.notes}
                    onChange={(e) => setLog('notes', e.target.value)}
                  />
                </div>

                {logError && (
                  <p className="text-sm text-red-500">{logError}</p>
                )}

                <button
                  type="submit"
                  disabled={logSaving}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors"
                >
                  {logSaving ? 'Submitting…' : 'Submit Activity Log'}
                </button>
              </form>
            )}
          </div>
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

