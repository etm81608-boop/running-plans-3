import { useState, useMemo } from 'react'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useCollection } from '../hooks/useCollection'
import { sendWorkoutEmail } from '../utils/emailService'
import Toast from '../components/Toast'
import { getWorkoutTypeLabel, getWorkoutTypeColor } from '../utils/constants'
import { format } from 'date-fns'

export default function AssignWorkout() {
  const { docs: workouts } = useCollection('workouts', 'createdAt')
  const { docs: runners }  = useCollection('runners',  'name')
  const { docs: groups }   = useCollection('groups',   'name')

  // Step 1: workout
  const [selectedWorkout, setSelectedWorkout] = useState(null)
  // Step 2: date
  const [date, setDate] = useState('')
  // Step 3: recipients
  const [mode, setMode]                 = useState('group') // 'group'|'individual'|'all'
  const [selectedGroup, setSelectedGroup]     = useState('')
  const [selectedRunners, setSelectedRunners] = useState([])
  // Step 4: options
  const [notes,      setNotes]      = useState('')
  const [sendEmail,  setSendEmail]  = useState(false)

  const [saving,  setSaving]  = useState(false)
  const [toast,   setToast]   = useState(null)
  const [shareLink, setShareLink] = useState('')

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

  async function handleAssign() {
    if (!selectedWorkout || !date || recipients.length === 0) return
    setSaving(true)

    const dateStr = format(new Date(date + 'T12:00:00'), 'MMMM d, yyyy')

    try {
      const assignmentData = {
        workoutId:    selectedWorkout.id,
        workoutTitle: selectedWorkout.title,
        workoutType:  selectedWorkout.type,
        workoutData:  selectedWorkout,          // snapshot of workout
        date,                                    // yyyy-MM-dd
        dateStr,
        runnerIds:    recipients.map((r) => r.id),
        runnerNames:  recipients.map((r) => r.name),
        groupName:    mode === 'group' ? selectedGroup : mode === 'all' ? 'All Runners' : '',
        notes,
        createdAt: serverTimestamp(),
      }

      const docRef = await addDoc(collection(db, 'assignments'), assignmentData)

      // Build share link
      const appUrl    = import.meta.env.VITE_APP_URL || window.location.origin
      const link      = `${appUrl}/#/workout/${docRef.id}`
      setShareLink(link)

      // Optionally send emails
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
          {workouts.length === 0 ? (
            <p className="text-sm text-gray-400">No workouts yet. Build your library first.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {workouts.map((w) => (
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
        </Section>

        {/* Step 4: Notes + Send Options */}
        <Section step="4" title="Notes &amp; Delivery">
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

        {/* Summary + Submit */}
        {canAssign && (
          <div className="bg-brand-50 border border-brand-200 rounded-xl p-5">
            <p className="text-sm font-semibold text-brand-800 mb-2">Assignment Summary</p>
            <ul className="text-sm text-brand-700 space-y-1">
              <li><strong>Workout:</strong> {selectedWorkout?.title}</li>
              <li><strong>Date:</strong> {date ? format(new Date(date + 'T12:00:00'), 'EEEE, MMMM d, yyyy') : ''}</li>
              <li><strong>Recipients:</strong> {recipients.length} runner{recipients.length !== 1 ? 's' : ''}</li>
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
