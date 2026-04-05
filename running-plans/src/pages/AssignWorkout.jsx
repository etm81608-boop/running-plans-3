import { useState, useMemo } from 'react'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useCollection } from '../hooks/useCollection'
import { sendWorkoutEmail } from '../utils/emailService'
import Toast from '../components/Toast'
import CrossTrainingInput from '../components/CrossTrainingInput'
import { getWorkoutTypeLabel, getWorkoutTypeColor } from '../utils/constants'
import { useWorkoutTypes } from '../hooks/useWorkoutTypes'
import { format } from 'date-fns'

// ── Constants ─────────────────────────────────────────────────────────────────

const DRILL_OPTIONS = [
  'Cone / Wicket Drills',
  'Hurdle Drills',
  'Hip Drills',
]

const EMPTY_XT = []

// ── Main Component ────────────────────────────────────────────────────────────

export default function AssignWorkout() {
  const allWorkoutTypes = useWorkoutTypes()
  const typeOptions     = allWorkoutTypes.filter((t) => t.value !== 'rest')

  const { docs: runners } = useCollection('runners', 'name')
  const { docs: groups }  = useCollection('groups',  'name')

  // ── Workout fields ────────────────────────────────────────────────────────
  const [date,             setDate]             = useState('')
  const [workoutType,      setWorkoutType]      = useState('easy')
  const [workoutTitle,     setWorkoutTitle]     = useState('')
  const [warmup,           setWarmup]           = useState('')
  const [drills,           setDrills]           = useState('')
  const [additionalWarmup, setAdditionalWarmup] = useState('')
  const [mainWorkout,      setMainWorkout]      = useState('')
  const [cooldown,         setCooldown]         = useState('')
  const [crossTraining,    setCrossTraining]    = useState(EMPTY_XT)
  const [notes,            setNotes]            = useState('')

  // ── Recipients ────────────────────────────────────────────────────────────
  const [mode,            setMode]            = useState('group')
  const [selectedGroup,   setSelectedGroup]   = useState('')
  const [selectedRunners, setSelectedRunners] = useState([])
  const [sendEmail,       setSendEmail]       = useState(false)

  // ── UI state ──────────────────────────────────────────────────────────────
  const [saving,    setSaving]    = useState(false)
  const [toast,     setToast]     = useState(null)
  const [shareLink, setShareLink] = useState('')

  // ── Derived recipient list ─────────────────────────────────────────────────
  const recipients = useMemo(() => {
    if (mode === 'all')        return runners
    if (mode === 'group')      return runners.filter((r) => r.group === selectedGroup)
    if (mode === 'individual') return runners.filter((r) => selectedRunners.includes(r.id))
    return []
  }, [mode, runners, selectedGroup, selectedRunners])

  function toggleRunner(id) {
    setSelectedRunners((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  // ── Save ───────────────────────────────────────────────────────────────────
  async function handleAssign() {
    if (!date || recipients.length === 0) return
    setSaving(true)

    const dateStr     = format(new Date(date + 'T12:00:00'), 'MMMM d, yyyy')
    const typeObj     = allWorkoutTypes.find((t) => t.value === workoutType)
    const autoTitle   = workoutTitle.trim() || `${typeObj?.label ?? workoutType} — ${dateStr}`
    const xtData      = (Array.isArray(crossTraining) && crossTraining.length > 0) ? crossTraining : null

    try {
      let firstDocId = null

      // Create ONE Firestore doc per runner so each runner's page query works
      for (const runner of recipients) {
        const data = {
          runnerId:        runner.id,
          runnerName:      runner.name,
          date,
          dateStr,
          workoutTitle:    autoTitle,
          workoutType,
          warmup:          warmup.trim(),
          drills:          drills || '',
          additionalWarmup: additionalWarmup.trim(),
          mainWorkout:     mainWorkout.trim(),
          cooldown:        cooldown.trim(),
          crossTraining:   xtData,
          notes:           notes.trim(),
          createdAt:       serverTimestamp(),
        }
        const docRef = await addDoc(collection(db, 'assignments'), data)
        if (!firstDocId) firstDocId = docRef.id

        // Send email if requested
        if (sendEmail && runner.email) {
          try {
            // Build a minimal workoutData object so sendWorkoutEmail still works
            const workoutForEmail = {
              title:       autoTitle,
              type:        workoutType,
              description: mainWorkout.trim(),
              warmup:      warmup.trim(),
              mainSet:     mainWorkout.trim(),
              cooldown:    cooldown.trim(),
            }
            await import('../utils/emailService').then(({ sendWorkoutEmail }) =>
              sendWorkoutEmail(runner, workoutForEmail, docRef.id, dateStr, notes)
            )
          } catch {
            // email failures are non-fatal — carry on
          }
        }
      }

      const appUrl = import.meta.env.VITE_APP_URL || window.location.origin
      if (firstDocId) setShareLink(`${appUrl}/#/workout/${firstDocId}`)
      setToast({ message: `Workout assigned to ${recipients.length} runner${recipients.length !== 1 ? 's' : ''}!`, type: 'success' })

      // Reset form
      setDate(''); setWorkoutTitle(''); setWorkoutType('easy')
      setWarmup(''); setDrills(''); setAdditionalWarmup('')
      setMainWorkout(''); setCooldown('')
      setCrossTraining(EMPTY_XT); setNotes('')
      setSelectedRunners([]); setSelectedGroup(''); setSendEmail(false)

    } catch (err) {
      setToast({ message: 'Error: ' + err.message, type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const canAssign = date && recipients.length > 0

  // ── Color dot for current type ─────────────────────────────────────────────
  const typeColor = allWorkoutTypes.find((t) => t.value === workoutType)?.calendarColor ?? '#6366f1'

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Assign Workout</h1>
        <p className="text-sm text-gray-500 mt-0.5">Write the workout, choose runners, and save.</p>
      </div>

      <div className="space-y-5">

        {/* ── 1. Date ── */}
        <Card step="1" title="Date">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
          />
        </Card>

        {/* ── 2. Type & Title ── */}
        <Card step="2" title="Type & Title">
          <div className="flex flex-wrap gap-3 items-start">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-medium text-gray-500 mb-1">Workout Type</label>
              <div className="flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: typeColor }}
                />
                <select
                  value={workoutType}
                  onChange={(e) => setWorkoutType(e.target.value)}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white"
                >
                  {typeOptions.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Workout Name <span className="text-gray-400">(optional)</span>
              </label>
              <input
                type="text"
                value={workoutTitle}
                onChange={(e) => setWorkoutTitle(e.target.value)}
                placeholder={`e.g. Tuesday Tempo`}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
              />
            </div>
          </div>
        </Card>

        {/* ── 3. Warm-Up ── */}
        <Card step="3" title="Warm-Up">
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">General Warm-Up</label>
              <textarea
                rows={2}
                value={warmup}
                onChange={(e) => setWarmup(e.target.value)}
                placeholder="e.g. 10 min easy jog, dynamic stretching…"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Drills</label>
              <select
                value={drills}
                onChange={(e) => setDrills(e.target.value)}
                className="w-full sm:w-72 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white"
              >
                <option value="">— none —</option>
                {DRILL_OPTIONS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Additional Warm-Up <span className="text-gray-400">(optional)</span>
              </label>
              <textarea
                rows={2}
                value={additionalWarmup}
                onChange={(e) => setAdditionalWarmup(e.target.value)}
                placeholder="Any extra warm-up specific to today's workout…"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
              />
            </div>
          </div>
        </Card>

        {/* ── 4. Main Workout ── */}
        <Card step="4" title="Main Workout">
          <textarea
            rows={5}
            value={mainWorkout}
            onChange={(e) => setMainWorkout(e.target.value)}
            placeholder="Describe the main set in detail — intervals, distances, targets, rest periods…"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
          />
        </Card>

        {/* ── 5. Cool-Down ── */}
        <Card step="5" title="Cool-Down">
          <textarea
            rows={2}
            value={cooldown}
            onChange={(e) => setCooldown(e.target.value)}
            placeholder="e.g. 10 min easy jog, static stretching…"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
          />
        </Card>

        {/* ── 6. Cross Training ── */}
        <Card step="6" title="Cross Training">
          <p className="text-xs text-gray-400 mb-3">Optional supplement to the main workout.</p>
          <CrossTrainingInput value={crossTraining} onChange={setCrossTraining} />
        </Card>

        {/* ── 7. Coach Notes ── */}
        <Card step="7" title="Coach Notes">
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any extra context, reminders, or motivation for runners…"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
          />
        </Card>

        {/* ── 8. Recipients ── */}
        <Card step="8" title="Recipients">
          {/* Mode tabs */}
          <div className="flex gap-2 mb-4">
            {[
              { key: 'all',        label: 'All Runners' },
              { key: 'group',      label: 'By Group' },
              { key: 'individual', label: 'Individuals' },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setMode(key)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  mode === key ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {mode === 'all' && (
            <p className="text-sm text-gray-600">
              All {runners.length} runner{runners.length !== 1 ? 's' : ''} will receive this workout.
            </p>
          )}

          {mode === 'group' && (
            <div>
              <select
                className="w-full sm:w-64 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                value={selectedGroup}
                onChange={(e) => setSelectedGroup(e.target.value)}
              >
                <option value="">— choose a group —</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.name}>{g.name}</option>
                ))}
              </select>
              {selectedGroup && (
                <p className="mt-2 text-sm text-gray-500">
                  {recipients.length} runner{recipients.length !== 1 ? 's' : ''} in this group.
                </p>
              )}
            </div>
          )}

          {mode === 'individual' && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {runners.map((r) => (
                <button
                  key={r.id}
                  onClick={() => toggleRunner(r.id)}
                  className={`text-left px-3 py-2 rounded-lg border text-sm transition-colors ${
                    selectedRunners.includes(r.id)
                      ? 'border-brand-500 bg-brand-50 text-brand-700 font-medium'
                      : 'border-gray-200 text-gray-700 hover:border-brand-200'
                  }`}
                >
                  {r.name}
                  {r.group && <span className="block text-xs text-gray-400">{r.group}</span>}
                </button>
              ))}
            </div>
          )}

          {/* Email toggle */}
          <label className="flex items-center gap-3 cursor-pointer mt-4">
            <input
              type="checkbox"
              checked={sendEmail}
              onChange={(e) => setSendEmail(e.target.checked)}
              className="w-4 h-4 text-brand-600 rounded"
            />
            <span className="text-sm text-gray-700">
              Send workout via email to runners with email addresses
            </span>
          </label>
          {sendEmail && (
            <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg mt-2">
              Requires EmailJS to be configured in your .env file.
            </p>
          )}
        </Card>

        {/* ── Summary ── */}
        {canAssign && (
          <div className="bg-brand-50 border border-brand-200 rounded-xl p-5">
            <p className="text-sm font-semibold text-brand-800 mb-2">Ready to assign</p>
            <div className="text-sm text-brand-700 space-y-0.5">
              <p>
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full mr-1.5"
                  style={{ backgroundColor: typeColor }}
                />
                <strong>{workoutTitle.trim() || getWorkoutTypeLabel(workoutType)}</strong>
              </p>
              <p>📅 {date ? format(new Date(date + 'T12:00:00'), 'EEEE, MMMM d, yyyy') : ''}</p>
              <p>👥 {recipients.length} runner{recipients.length !== 1 ? 's' : ''}</p>
              {(Array.isArray(crossTraining) && crossTraining.length > 0) && (
                <p>🏊 Cross training: {crossTraining.map(c => c.type).filter(Boolean).join(', ')}</p>
              )}
            </div>
          </div>
        )}

        <button
          onClick={handleAssign}
          disabled={!canAssign || saving}
          className="w-full bg-brand-600 hover:bg-brand-700 text-white py-3 rounded-xl font-semibold text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? `Saving…` : `Assign Workout${recipients.length > 0 ? ` to ${recipients.length} Runner${recipients.length !== 1 ? 's' : ''}` : ''}`}
        </button>

        {/* Share link */}
        {shareLink && (
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-sm font-medium text-gray-700 mb-2">Shareable link for last assignment:</p>
            <div className="flex gap-2">
              <input
                readOnly
                value={shareLink}
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-xs bg-gray-50 text-gray-600 font-mono"
              />
              <button
                onClick={() => { navigator.clipboard.writeText(shareLink); setToast({ message: 'Link copied!', type: 'success' }) }}
                className="bg-brand-600 hover:bg-brand-700 text-white px-3 py-2 rounded-lg text-xs font-medium"
              >
                Copy
              </button>
            </div>
          </div>
        )}

      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}

// ── Card wrapper (consistent with old Section look) ───────────────────────────
function Card({ step, title, children }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center gap-3 mb-4">
        <span className="w-7 h-7 bg-brand-600 text-white text-xs font-bold rounded-full flex items-center justify-center shrink-0">
          {step}
        </span>
        <h2 className="font-semibold text-gray-900">{title}</h2>
      </div>
      {children}
    </div>
  )
}
