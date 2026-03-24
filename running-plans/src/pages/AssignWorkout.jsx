import { useState, useMemo } from 'react'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useCollection } from '../hooks/useCollection'
import { sendWorkoutEmail } from '../utils/emailService'
import Toast from '../components/Toast'
import { WORKOUT_TYPES, getWorkoutTypeLabel, getWorkoutTypeColor } from '../utils/constants'
import { format } from 'date-fns'

// Lift sub-options: general categories + Harvard strength workout slots
// (Add or edit these to match the names on your Strength page)
const ALL_LIFT_OPTIONS = [
  'Mobility',
  'Heavy Lift',
  'Light Lift',
  'Body Weight',
  'Strength Workout A',
  'Strength Workout B',
  'Strength Workout C',
  'Strength Workout D',
]

const CROSS_TRAINING_TYPES = [
  { value: 'swim',       label: 'Swim' },
  { value: 'bike',       label: 'Bike / Cycling' },
  { value: 'walk',       label: 'Walk' },
  { value: 'elliptical', label: 'Elliptical' },
  { value: 'lift',       label: 'Lift' },
]

// Workout types for the filter chips (exclude legacy 'rest')
const ASSIGN_WORKOUT_TYPES = WORKOUT_TYPES.filter((t) => t.value !== 'rest')

const EMPTY_XT = { type: '', liftOption: '', notes: '' }

export default function AssignWorkout() {
  const { docs: workouts } = useCollection('workouts', 'createdAt')
  const { docs: runners }  = useCollection('runners',  'name')
  const { docs: groups }   = useCollection('groups',   'name')

  // Step 1: workout
  const [selectedWorkout, setSelectedWorkout] = useState(null)
  // Step 2: date
  const [date, setDate] = useState('')
  // Step 3: recipients
  const [mode, setMode]                       = useState('group')
  const [selectedGroup, setSelectedGroup]     = useState('')
  const [selectedRunners, setSelectedRunners] = useState([])
  // Step 4: cross training (optional)
  const [crossTraining, setCrossTraining]     = useState(EMPTY_XT)
  // Step 5: notes + delivery
  const [notes,     setNotes]     = useState('')
  const [sendEmail, setSendEmail] = useState(false)

  const [saving,    setSaving]    = useState(false)
  const [toast,     setToast]     = useState(null)
  const [shareLink, setShareLink] = useState('')

  // Workout type filter for library
  const [typeFilter, setTypeFilter] = useState('all')

  // Filtered workouts in library
  const filteredWorkouts = useMemo(() => {
    if (typeFilter === 'all') return workouts
    return workouts.filter((w) => w.type === typeFilter)
  }, [workouts, typeFilter])

  // Derived recipient list
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

  function setCt(field, value) {
    setCrossTraining((prev) => ({ ...prev, [field]: value }))
  }

  async function handleAssign() {
    if (!selectedWorkout || !date || recipients.length === 0) return
    setSaving(true)

    const dateStr = format(new Date(date + 'T12:00:00'), 'MMMM d, yyyy')

    try {
      const xtData = crossTraining.type
        ? {
            type:       crossTraining.type,
            liftOption: crossTraining.type === 'lift' ? crossTraining.liftOption : '',
            notes:      crossTraining.type !== 'lift' ? crossTraining.notes : '',
          }
        : null

      const assignmentData = {
        workoutId:    selectedWorkout.id,
        workoutTitle: selectedWorkout.title,
        workoutType:  selectedWorkout.type,
        workoutData:  selectedWorkout,
        date,
        dateStr,
        runnerIds:    recipients.map((r) => r.id),
        runnerNames:  recipients.map((r) => r.name),
        groupName:    mode === 'group' ? selectedGroup : mode === 'all' ? 'All Runners' : '',
        crossTraining: xtData,
        notes,
        createdAt: serverTimestamp(),
      }

      const docRef = await addDoc(collection(db, 'assignments'), assignmentData)

      const appUrl = import.meta.env.VITE_APP_URL || window.location.origin
      setShareLink(`${appUrl}/#/workout/${docRef.id}`)

      if (sendEmail) {
        const emailRunners = recipients.filter((r) => r.email)
        let emailErrors = 0
        for (const runner of emailRunners) {
          try {
            await sendWorkoutEmail(runner, selectedWorkout, docRef.id, dateStr, notes)
          } catch {
            emailErrors++
          }
        }
        if (emailErrors > 0) {
          setToast({ message: `Assignment saved. ${emailErrors} email(s) failed — check EmailJS config.`, type: 'info' })
        } else {
          setToast({ message: `Assignment saved and emails sent to ${emailRunners.length} runner(s)!`, type: 'success' })
        }
      } else {
        setToast({ message: 'Workout assigned successfully!', type: 'success' })
      }

      // Reset form
      setSelectedWorkout(null)
      setDate('')
      setNotes('')
      setSelectedRunners([])
      setSelectedGroup('')
      setSendEmail(false)
      setCrossTraining(EMPTY_XT)

    } catch (err) {
      setToast({ message: 'Error: ' + err.message, type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const canAssign = selectedWorkout && date && recipients.length > 0

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Assign Workout</h1>
        <p className="text-sm text-gray-500 mt-0.5">Choose a workout, date, and runners — then send or share.</p>
      </div>

      <div className="space-y-6">

        {/* Step 1: Workout */}
        <Section step="1" title="Choose a Workout">
          {/* Type filter chips */}
          <div className="flex flex-wrap gap-1.5 mb-4">
            <button
              onClick={() => setTypeFilter('all')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${typeFilter === 'all' ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              All
            </button>
            {ASSIGN_WORKOUT_TYPES.map((t) => (
              <button
                key={t.value}
                onClick={() => setTypeFilter(t.value)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${typeFilter === t.value ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {filteredWorkouts.length === 0 ? (
            <p className="text-sm text-gray-400">No workouts match. Build your library first.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filteredWorkouts.map((w) => (
                <button
                  key={w.id}
                  onClick={() => setSelectedWorkout(w)}
                  className={`text-left p-4 rounded-xl border-2 transition-colors ${
                    selectedWorkout?.id === w.id
                      ? 'border-brand-500 bg-brand-50'
                      : 'border-gray-200 hover:border-brand-200 bg-white'
                  }`}
                >
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getWorkoutTypeColor(w.type)}`}>
                    {getWorkoutTypeLabel(w.type)}
                  </span>
                  <p className="font-medium text-gray-900 mt-1">{w.title}</p>
                  {w.description && (
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{w.description}</p>
                  )}
                </button>
              ))}
            </div>
          )}
        </Section>

        {/* Step 2: Date */}
        <Section step="2" title="Select Date">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
          />
        </Section>

        {/* Step 3: Recipients */}
        <Section step="3" title="Select Recipients">
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
        </Section>

        {/* Step 4: Cross Training (optional) */}
        <Section step="4" title="Cross Training">
          <p className="text-xs text-gray-400 mb-3">Optional — add any supplemental cross training for this day.</p>
          <div className="space-y-3">

            {/* Cross training type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select
                value={crossTraining.type}
                onChange={(e) => setCrossTraining({ type: e.target.value, liftOption: '', notes: '' })}
                className="w-full sm:w-64 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
              >
                <option value="">— none —</option>
                {CROSS_TRAINING_TYPES.map((ct) => (
                  <option key={ct.value} value={ct.value}>{ct.label}</option>
                ))}
              </select>
            </div>

            {/* Lift sub-selector */}
            {crossTraining.type === 'lift' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Lift Type</label>
                <select
                  value={crossTraining.liftOption}
                  onChange={(e) => setCt('liftOption', e.target.value)}
                  className="w-full sm:w-64 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                >
                  <option value="">— choose lift —</option>
                  {ALL_LIFT_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Notes for non-lift cross training */}
            {crossTraining.type && crossTraining.type !== 'lift' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Duration / Notes</label>
                <input
                  type="text"
                  value={crossTraining.notes}
                  onChange={(e) => setCt('notes', e.target.value)}
                  placeholder="e.g. 30 min easy"
                  className="w-full sm:w-64 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                />
              </div>
            )}
          </div>
        </Section>

        {/* Step 5: Notes + Delivery */}
        <Section step="5" title="Notes &amp; Delivery">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Assignment Notes <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <textarea
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any specific notes for this workout on this date…"
              />
            </div>
            <label className="flex items-center gap-3 cursor-pointer">
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
              <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
                Requires EmailJS to be configured in your .env file. See README for setup instructions.
              </p>
            )}
          </div>
        </Section>

        {/* Summary */}
        {canAssign && (
          <div className="bg-brand-50 border border-brand-200 rounded-xl p-5">
            <p className="text-sm font-semibold text-brand-800 mb-2">Assignment Summary</p>
            <ul className="text-sm text-brand-700 space-y-1">
              <li><strong>Workout:</strong> {selectedWorkout?.title}</li>
              <li><strong>Date:</strong> {date ? format(new Date(date + 'T12:00:00'), 'EEEE, MMMM d, yyyy') : ''}</li>
              <li><strong>Recipients:</strong> {recipients.length} runner{recipients.length !== 1 ? 's' : ''}</li>
              {crossTraining.type && (
                <li>
                  <strong>Cross Training:</strong>{' '}
                  {crossTraining.type === 'lift' && crossTraining.liftOption
                    ? `Lift — ${crossTraining.liftOption}`
                    : crossTraining.type}
                  {crossTraining.notes && ` · ${crossTraining.notes}`}
                </li>
              )}
              {sendEmail && <li><strong>Emails:</strong> {recipients.filter((r) => r.email).length} will be sent</li>}
            </ul>
          </div>
        )}

        <button
          onClick={handleAssign}
          disabled={!canAssign || saving}
          className="w-full bg-brand-600 hover:bg-brand-700 text-white py-3 rounded-xl font-semibold text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving…' : 'Assign Workout'}
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

function Section({ step, title, children }) {
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
