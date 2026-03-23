import { useState, useMemo } from 'react'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useCollection } from '../hooks/useCollection'
import Toast from '../components/Toast'
import { WORKOUT_TYPES, getWorkoutTypeColor, getWorkoutTypeLabel } from '../utils/constants'
import { format } from 'date-fns'
import CrossTrainingInput, { EMPTY_CT } from '../components/CrossTrainingInput'

const EMPTY_CUSTOM = {
  title: '', type: 'easy', description: '',
  warmup: '', mainSet: '', cooldown: '', targetPace: '', notes: '',
}

// Map workout library fields → assignment fields that CalendarPage / RunnerPage expect
function buildAssignmentFields(workoutDoc, assignmentNotes) {
  const parts = [
    workoutDoc.description?.trim(),
    workoutDoc.mainSet?.trim(),
    workoutDoc.targetPace?.trim() ? `Target pace: ${workoutDoc.targetPace.trim()}` : '',
  ].filter(Boolean)

  const noteParts = [
    workoutDoc.notes?.trim(),
    assignmentNotes?.trim(),
  ].filter(Boolean)

  return {
    warmup:        workoutDoc.warmup?.trim()    || '',
    mainWorkout:   parts.join('\n')             || '',
    cooldown:      workoutDoc.cooldown?.trim()  || '',
    crossTraining: '',
    notes:         noteParts.join('\n\n')       || '',
  }
}

export default function AssignWorkout() {
  const { docs: workouts } = useCollection('workouts', 'createdAt')
  const { docs: runners }  = useCollection('runners',  'name')
  const { docs: groups }   = useCollection('groups',   'name')

  // Step 1: workout source
  const [workoutMode,     setWorkoutMode]     = useState('library') // 'library' | 'custom'
  const [selectedWorkout, setSelectedWorkout] = useState(null)
  const [customWorkout,   setCustomWorkout]   = useState(EMPTY_CUSTOM)
  const [saveToLibrary,   setSaveToLibrary]   = useState(false)

  // Step 2: date
  const [date, setDate] = useState('')

  // Step 3: recipients
  const [mode,             setMode]             = useState('group')
  const [selectedGroup,    setSelectedGroup]    = useState('')
  const [selectedRunners,  setSelectedRunners]  = useState([])

  // Step 4: notes + cross training
  const [notes,          setNotes]          = useState('')
  const [crossTraining,  setCrossTraining]  = useState(EMPTY_CT)

  const [saving,  setSaving]  = useState(false)
  const [toast,   setToast]   = useState(null)

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

  function setCustomField(field, value) {
    setCustomWorkout((prev) => ({ ...prev, [field]: value }))
  }

  // The "active" workout for the summary
  const activeWorkout = workoutMode === 'library'
    ? selectedWorkout
    : customWorkout.title.trim()
      ? { ...customWorkout, title: customWorkout.title.trim() }
      : null

  const canAssign = activeWorkout && date && recipients.length > 0

  async function handleAssign() {
    if (!activeWorkout || !date || recipients.length === 0) return
    setSaving(true)

    const dateStr = format(new Date(date + 'T12:00:00'), 'MMMM d, yyyy')

    try {
      let workoutDoc = activeWorkout

      // If custom, optionally save to library
      if (workoutMode === 'custom') {
        const workoutData = {
          title:       customWorkout.title.trim(),
          type:        customWorkout.type,
          description: customWorkout.description.trim(),
          warmup:      customWorkout.warmup.trim(),
          mainSet:     customWorkout.mainSet.trim(),
          cooldown:    customWorkout.cooldown.trim(),
          targetPace:  customWorkout.targetPace.trim(),
          notes:       customWorkout.notes.trim(),
        }
        if (saveToLibrary) {
          const ref = await addDoc(collection(db, 'workouts'), { ...workoutData, createdAt: serverTimestamp() })
          workoutDoc = { ...workoutData, id: ref.id }
        } else {
          workoutDoc = { ...workoutData, id: `custom_${Date.now()}` }
        }
      }

      // Build the workout fields in the format CalendarPage / RunnerPage expect
      const wktFields = { ...buildAssignmentFields(workoutDoc, notes), crossTraining }

      // Create ONE assignment document per runner
      const promises = recipients.map((runner) =>
        addDoc(collection(db, 'assignments'), {
          runnerId:        runner.id,
          runnerName:      runner.name,
          date,
          dateStr,
          ...wktFields,
          visibilityGroup: runner.visibilityGroup ?? null,
          workoutId:       workoutDoc.id,
          workoutTitle: workoutDoc.title,
          workoutType:  workoutDoc.type,
          workoutData:  workoutDoc,
          createdAt:    serverTimestamp(),
        })
      )

      await Promise.all(promises)

      setToast({
        message: `Assigned to ${recipients.length} runner${recipients.length !== 1 ? 's' : ''}${saveToLibrary && workoutMode === 'custom' ? ' — workout saved to library' : ''}!`,
        type: 'success',
      })

      // Reset form
      setSelectedWorkout(null)
      setCustomWorkout(EMPTY_CUSTOM)
      setSaveToLibrary(false)
      setDate('')
      setNotes('')
      setCrossTraining(EMPTY_CT)
      setSelectedRunners([])
      setSelectedGroup('')

    } catch (err) {
      setToast({ message: 'Error: ' + err.message, type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Assign Workout</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Choose a workout, date, and runners. Each runner's assignment will appear on the master calendar and their personal schedule.
        </p>
      </div>

      <div className="space-y-6">

        {/* Step 1: Workout */}
        <Section step="1" title="Choose a Workout">

          {/* Toggle: Library vs Custom */}
          <div className="flex gap-2 mb-5">
            <button
              onClick={() => { setWorkoutMode('library'); setSelectedWorkout(null) }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                workoutMode === 'library' ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              From Library
            </button>
            <button
              onClick={() => { setWorkoutMode('custom'); setSelectedWorkout(null) }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                workoutMode === 'custom' ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              + Create Custom
            </button>
          </div>

          {/* Library picker */}
          {workoutMode === 'library' && (
            workouts.length === 0 ? (
              <p className="text-sm text-gray-400">No workouts yet. Use "Create Custom" or build your library first.</p>
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
            )
          )}

          {/* Custom workout builder */}
          {workoutMode === 'custom' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                  <input
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                    value={customWorkout.title}
                    onChange={(e) => setCustomField('title', e.target.value)}
                    placeholder="e.g. Tuesday Tempo 4 miles"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                    value={customWorkout.type}
                    onChange={(e) => setCustomField('type', e.target.value)}
                  >
                    {WORKOUT_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Target Pace / Time</label>
                  <input
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                    value={customWorkout.targetPace}
                    onChange={(e) => setCustomField('targetPace', e.target.value)}
                    placeholder="e.g. 7:30/mile"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Overview / Description</label>
                <textarea rows={2}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
                  value={customWorkout.description}
                  onChange={(e) => setCustomField('description', e.target.value)}
                  placeholder="Brief overview of the session…"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Warm-Up</label>
                <textarea rows={2}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
                  value={customWorkout.warmup}
                  onChange={(e) => setCustomField('warmup', e.target.value)}
                  placeholder="e.g. 10 min easy jog, dynamic drills"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Main Set</label>
                <textarea rows={4}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
                  value={customWorkout.mainSet}
                  onChange={(e) => setCustomField('mainSet', e.target.value)}
                  placeholder="e.g. 6 x 800m @ 5K pace, 90 sec rest between each"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cool-Down</label>
                <textarea rows={2}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
                  value={customWorkout.cooldown}
                  onChange={(e) => setCustomField('cooldown', e.target.value)}
                  placeholder="e.g. 10 min easy jog, stretching"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Coach Notes</label>
                <textarea rows={2}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
                  value={customWorkout.notes}
                  onChange={(e) => setCustomField('notes', e.target.value)}
                  placeholder="Any additional notes for athletes…"
                />
              </div>
              <label className="flex items-center gap-3 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={saveToLibrary}
                  onChange={(e) => setSaveToLibrary(e.target.checked)}
                  className="w-4 h-4 text-brand-600 rounded"
                />
                <span className="text-sm text-gray-700">Also save this workout to my library for future use</span>
              </label>
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

        {/* Step 4: Notes + Cross Training */}
        <Section step="4" title="Notes &amp; Cross Training">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Assignment Notes <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <textarea
                rows={2}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any specific notes for this workout on this date…"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">💪 Cross Training</label>
              <CrossTrainingInput value={crossTraining} onChange={setCrossTraining} />
            </div>
          </div>
        </Section>

        {/* Summary */}
        {canAssign && (
          <div className="bg-brand-50 border border-brand-200 rounded-xl p-5">
            <p className="text-sm font-semibold text-brand-800 mb-2">Assignment Summary</p>
            <ul className="text-sm text-brand-700 space-y-1">
              <li><strong>Workout:</strong> {activeWorkout?.title}</li>
              <li><strong>Date:</strong> {date ? format(new Date(date + 'T12:00:00'), 'EEEE, MMMM d, yyyy') : ''}</li>
              <li><strong>Recipients:</strong> {recipients.length} runner{recipients.length !== 1 ? 's' : ''} — {recipients.map((r) => r.name).join(', ')}</li>
              {workoutMode === 'custom' && saveToLibrary && <li><strong>Library:</strong> Will be saved to your workout library</li>}
            </ul>
          </div>
        )}

        <button
          onClick={handleAssign}
          disabled={!canAssign || saving}
          className="w-full bg-brand-600 hover:bg-brand-700 text-white py-3 rounded-xl font-semibold text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving…' : `Assign to ${recipients.length} Runner${recipients.length !== 1 ? 's' : ''}`}
        </button>

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
