import { useState, useMemo } from 'react'
import {
  collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp,
} from 'firebase/firestore'
import { db } from '../firebase/config'
import { useCollection } from '../hooks/useCollection'
import Modal from '../components/Modal'
import Toast from '../components/Toast'
import { format, addDays, startOfWeek, parseISO } from 'date-fns'
import CrossTrainingInput, { ctToText, normaliseCT } from '../components/CrossTrainingInput'
import { WORKOUT_TYPES } from '../utils/constants'
import useWeather from '../hooks/useWeather'

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_RUNNERS = 6

// Hide legacy 'rest' type from the selector
const FORM_WORKOUT_TYPES = WORKOUT_TYPES.filter((t) => t.value !== 'rest')

const DRILL_OPTIONS = ['Cone / Wicket Drills', 'Hurdle Drills', 'Hip Drills']

const VG_OPTIONS = [
  { value: '',  label: 'Off — private' },
  { value: '1', label: 'Group 1' },
  { value: '2', label: 'Group 2' },
  { value: '3', label: 'Group 3' },
  { value: '4', label: 'Group 4' },
  { value: '5', label: 'Group 5' },
]

const RUNNER_COLORS = [
  { bg: 'bg-indigo-500',  light: 'bg-indigo-50',  border: 'border-indigo-200',  text: 'text-indigo-700',  dot: '#4f46e5' },
  { bg: 'bg-emerald-500', light: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', dot: '#10b981' },
  { bg: 'bg-orange-500',  light: 'bg-orange-50',  border: 'border-orange-200',  text: 'text-orange-700',  dot: '#f97316' },
  { bg: 'bg-pink-500',    light: 'bg-pink-50',    border: 'border-pink-200',    text: 'text-pink-700',    dot: '#ec4899' },
  { bg: 'bg-violet-500',  light: 'bg-violet-50',  border: 'border-violet-200',  text: 'text-violet-700',  dot: '#7c3aed' },
  { bg: 'bg-teal-500',    light: 'bg-teal-50',    border: 'border-teal-200',    text: 'text-teal-700',    dot: '#14b8a6' },
]

const EMPTY_FORM = {
  workoutType:      '',
  workoutTitle:     '',
  warmup:           '',
  drills:           '',
  additionalWarmup: '',
  mainWorkout:      '',
  cooldown:         '',
  crossTraining:    [],
  notes:            '',
  visibilityGroup:  '',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getMondayOf(date) {
  return startOfWeek(date, { weekStartsOn: 1 })
}

function getInitials(name = '') {
  return name.trim().split(/\s+/).map((w) => w[0]?.toUpperCase() ?? '').join('')
}

// ── Card sub-component ────────────────────────────────────────────────────────

function Card({ step, title, children }) {
  return (
    <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
      <div className="flex items-center gap-2 mb-3">
        <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
          {step}
        </span>
        <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
      </div>
      <div className="space-y-2">
        {children}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function TeamGrid() {
  const { docs: allRunners } = useCollection('runners',  'name')
  const { docs: assignments } = useCollection('assignments', 'date')
  const { docs: templates }   = useCollection('workouts',    'createdAt')

  const [weekAnchor, setWeekAnchor] = useState(() => getMondayOf(new Date()))

  const weekDays = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => addDays(weekAnchor, i)),
    [weekAnchor]
  )

  const prevWeek = () => setWeekAnchor((d) => addDays(d, -7))
  const nextWeek = () => setWeekAnchor((d) => addDays(d,  7))
  const goToday  = () => setWeekAnchor(getMondayOf(new Date()))

  // Weather for the visible week
  const wxStart = weekDays[0]?.toISOString().split('T')[0] ?? null
  const wxEnd   = weekDays[6]?.toISOString().split('T')[0] ?? null
  const weatherByDate = useWeather(wxStart, wxEnd)

  const [selectedIds, setSelectedIds] = useState([])
  const [expandedRunners, setExpandedRunners] = useState(new Set())

  function toggleRunner(id) {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id)
      if (prev.length >= MAX_RUNNERS) return prev
      return [...prev, id]
    })
  }

  function toggleExpand(id) {
    setExpandedRunners((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectedRunners = useMemo(
    () => selectedIds.map((id) => allRunners.find((r) => r.id === id)).filter(Boolean),
    [selectedIds, allRunners]
  )

  const assignmentsByRunnerDate = useMemo(() => {
    const map = {}
    assignments.forEach((a) => {
      if (!a.runnerId || !a.date) return
      if (!map[a.runnerId]) map[a.runnerId] = {}
      map[a.runnerId][a.date] = a
    })
    return map
  }, [assignments])

  const [modal,      setModal]      = useState(null)
  const [form,       setForm]       = useState(EMPTY_FORM)
  const [saving,     setSaving]     = useState(false)
  const [deleting,   setDeleting]   = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const [toast,      setToast]      = useState(null)
  const [templateId, setTemplateId] = useState('')

  function openCell(runner, dateStr) {
    const existing = assignmentsByRunnerDate[runner.id]?.[dateStr] || null
    setModal({ runnerId: runner.id, runnerName: runner.name, date: dateStr, existing })
    setForm(existing ? {
      workoutType:      existing.workoutType      || '',
      workoutTitle:     existing.workoutTitle     || '',
      warmup:           existing.warmup           || '',
      drills:           existing.drills           || '',
      additionalWarmup: existing.additionalWarmup || '',
      mainWorkout:      existing.mainWorkout      || '',
      cooldown:         existing.cooldown         || '',
      crossTraining:    normaliseCT(existing.crossTraining),
      notes:            existing.notes            || '',
      visibilityGroup:  existing.visibilityGroup ? String(existing.visibilityGroup) : '',
    } : EMPTY_FORM)
    setTemplateId('')
    setConfirmDel(false)
  }

  function closeModal() {
    setModal(null)
    setConfirmDel(false)
    setTemplateId('')
  }

  function applyTemplate(tid) {
    setTemplateId(tid)
    if (!tid) return
    const t = templates.find((x) => x.id === tid)
    if (!t) return
    const parts = [t.description?.trim(), t.mainSet?.trim(), t.targetPace?.trim() ? `Target pace: ${t.targetPace}` : ''].filter(Boolean)
    setForm((f) => ({
      ...f,
      workoutType:  t.workoutType?.trim()  || f.workoutType,
      workoutTitle: t.title?.trim()        || f.workoutTitle,
      warmup:       t.warmup?.trim()       || f.warmup,
      mainWorkout:  parts.join('\n')       || f.mainWorkout,
      cooldown:     t.cooldown?.trim()     || f.cooldown,
      notes:        t.notes?.trim()        || f.notes,
    }))
  }

  function setField(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function handleSave() {
    if (!modal) return
    setSaving(true)
    const dateStr = format(parseISO(modal.date + 'T12:00:00'), 'MMMM d, yyyy')
    const data = {
      runnerId:         modal.runnerId,
      runnerName:       modal.runnerName,
      date:             modal.date,
      dateStr,
      workoutType:      form.workoutType,
      workoutTitle:     form.workoutTitle.trim() || form.mainWorkout.trim().slice(0, 60) || 'Workout',
      warmup:           form.warmup.trim(),
      drills:           form.drills,
      additionalWarmup: form.additionalWarmup.trim(),
      mainWorkout:      form.mainWorkout.trim(),
      cooldown:         form.cooldown.trim(),
      crossTraining:    form.crossTraining,
      notes:            form.notes.trim(),
      visibilityGroup:  form.visibilityGroup ? parseInt(form.visibilityGroup, 10) : null,
    }
    try {
      if (modal.existing) {
        await updateDoc(doc(db, 'assignments', modal.existing.id), data)
        setToast({ message: 'Workout updated!', type: 'success' })
      } else {
        await addDoc(collection(db, 'assignments'), { ...data, createdAt: serverTimestamp() })
        setToast({ message: 'Workout saved!', type: 'success' })
      }
      closeModal()
    } catch (err) {
      setToast({ message: err.message, type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!modal?.existing) return
    setDeleting(true)
    try {
      await deleteDoc(doc(db, 'assignments', modal.existing.id))
      setToast({ message: 'Workout removed.', type: 'info' })
      closeModal()
    } catch (err) {
      setToast({ message: err.message, type: 'error' })
    } finally {
      setDeleting(false)
    }
  }

  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="p-6">

      {/* Page header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Team Grid</h1>
          <p className="text-sm text-gray-500 mt-0.5">Plan the week for up to {MAX_RUNNERS} runners at once. Click any cell to add or edit a workout.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={prevWeek} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button onClick={goToday} className="px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-sm font-medium text-gray-600">
            Today
          </button>
          <span className="text-sm font-semibold text-gray-700 min-w-[200px] text-center">
            {format(weekDays[0], 'MMM d')} — {format(weekDays[6], 'MMM d, yyyy')}
          </span>
          <button onClick={nextWeek} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Runner picker */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-5">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">
          Select Runners ({selectedIds.length}/{MAX_RUNNERS})
        </p>
        <div className="flex flex-wrap gap-2">
          {allRunners.map((r) => {
            const isSelected = selectedIds.includes(r.id)
            const colorIdx   = selectedIds.indexOf(r.id)
            const color      = isSelected ? RUNNER_COLORS[colorIdx] : null
            const atMax      = !isSelected && selectedIds.length >= MAX_RUNNERS
            return (
              <button
                key={r.id}
                onClick={() => toggleRunner(r.id)}
                disabled={atMax}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                  isSelected
                    ? `${color.light} ${color.border} ${color.text}`
                    : atMax
                      ? 'bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed'
                      : 'bg-white border-gray-200 text-gray-600 hover:border-brand-300 hover:text-brand-700'
                }`}
              >
                {isSelected && <span className={`w-2 h-2 rounded-full ${color.bg}`} />}
                {r.name}
                {r.group && <span className="text-xs opacity-60">· {r.group}</span>}
              </button>
            )
          })}
        </div>
        {selectedIds.length === 0 && (
          <p className="text-sm text-gray-400 mt-2">Select runners above to build the grid.</p>
        )}
      </div>

      {/* Grid */}
      {selectedRunners.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse">
              <thead>
                <tr>
                  <th className="w-40 min-w-[10rem] bg-gray-50 border-b border-r border-gray-100 px-4 py-3 text-left">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Runner</span>
                  </th>
                  {weekDays.map((day) => {
                    const dateStr = day.toISOString().split('T')[0]
                    const isToday = dateStr === today
                    return (
                      <th key={dateStr} className={`border-b border-r border-gray-100 last:border-r-0 px-2 py-3 text-center ${isToday ? 'bg-brand-600' : 'bg-gray-50'}`}>
                        <p className={`text-xs font-bold uppercase tracking-wide ${isToday ? 'text-white/80' : 'text-gray-400'}`}>{format(day, 'EEE')}</p>
                        <p className={`text-lg font-bold leading-none mt-0.5 ${isToday ? 'text-white' : 'text-gray-700'}`}>{format(day, 'd')}</p>
                        <p className={`text-xs mt-0.5 ${isToday ? 'text-white/70' : 'text-gray-400'}`}>{format(day, 'MMM')}</p>
                        {weatherByDate[dateStr] && (
                          <p className={`text-[10px] mt-1 leading-tight ${isToday ? 'text-white/80' : 'text-gray-500'}`}>
                            {weatherByDate[dateStr].icon} {weatherByDate[dateStr].high}°/{weatherByDate[dateStr].low}°
                            {weatherByDate[dateStr].precipPct != null && weatherByDate[dateStr].precipPct >= 20 && (
                              <span className={isToday ? 'text-blue-200' : 'text-blue-500'}> · {weatherByDate[dateStr].precipPct}%</span>
                            )}
                          </p>
                        )}
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {selectedRunners.map((runner, runnerIdx) => {
                  const color      = RUNNER_COLORS[runnerIdx % RUNNER_COLORS.length]
                  const isExpanded = expandedRunners.has(runner.id)
                  return (
                    <tr key={runner.id} className="group">
                      <td className={`border-b border-r border-gray-100 px-3 py-3 align-top ${color.light}`}>
                        <div className="flex items-center gap-2">
                          <div className={`w-7 h-7 rounded-full ${color.bg} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                            {getInitials(runner.name)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-semibold ${color.text} leading-tight truncate`}>{runner.name}</p>
                            {runner.group && <p className="text-xs text-gray-400">{runner.group}</p>}
                          </div>
                          <button
                            onClick={() => toggleExpand(runner.id)}
                            title={isExpanded ? 'Collapse details' : 'Expand full details'}
                            className={`flex-shrink-0 w-6 h-6 rounded flex items-center justify-center transition-colors ${
                              isExpanded
                                ? `${color.bg} text-white`
                                : `text-gray-400 hover:${color.bg} hover:text-white`
                            }`}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className={`h-3.5 w-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                        </div>
                      </td>
                      {weekDays.map((day) => {
                        const dateStr  = day.toISOString().split('T')[0]
                        const existing = assignmentsByRunnerDate[runner.id]?.[dateStr]
                        const isPast   = dateStr < today
                        const isToday  = dateStr === today
                        const ctText   = existing ? ctToText(existing.crossTraining) : ''
                        return (
                          <td
                            key={dateStr}
                            onClick={() => openCell(runner, dateStr)}
                            className={`border-b border-r border-gray-100 last:border-r-0 p-2 align-top cursor-pointer transition-colors ${
                              isToday ? 'bg-brand-50/40 hover:bg-brand-50'
                              : isPast ? 'bg-gray-50/60 hover:bg-gray-100/60'
                              : 'bg-white hover:bg-gray-50'
                            }`}
                            style={isExpanded ? {} : { minHeight: '80px', height: '80px' }}
                          >
                            {existing ? (
                              <div className={`border-l-2 ${color.border} pl-2 pr-1 py-1 flex flex-col gap-1 bg-white h-full`}>
                                {/* Compact view */}
                                {!isExpanded && (
                                  <>
                                    {existing.mainWorkout ? (
                                      <p className={`text-xs font-semibold leading-snug line-clamp-3 ${color.text}`}>
                                        {existing.mainWorkout.split('\n')[0]}
                                      </p>
                                    ) : existing.workoutType ? (
                                      <p className={`text-xs font-semibold leading-snug ${color.text}`}>
                                        {WORKOUT_TYPES.find(t => t.value === existing.workoutType)?.label || existing.workoutType}
                                      </p>
                                    ) : (
                                      <p className="text-xs text-gray-400 italic">Rest</p>
                                    )}
                                    <div className="mt-auto"><span className="text-xs text-gray-300">✏️</span></div>
                                  </>
                                )}
                                {/* Expanded detail view */}
                                {isExpanded && (
                                  <div className="space-y-1.5 py-1">
                                    {existing.workoutType && (
                                      <span className={`inline-block text-xs font-bold px-2 py-0.5 rounded-full ${color.light} ${color.text}`}>
                                        {WORKOUT_TYPES.find(t => t.value === existing.workoutType)?.label || existing.workoutType}
                                      </span>
                                    )}
                                    {existing.workoutTitle && (
                                      <p className={`text-xs font-semibold ${color.text}`}>{existing.workoutTitle}</p>
                                    )}
                                    {existing.warmup && (
                                      <div>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Warm-Up</p>
                                        <p className="text-xs text-gray-600 leading-snug">{existing.warmup}</p>
                                      </div>
                                    )}
                                    {existing.drills && (
                                      <div>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Drills</p>
                                        <p className="text-xs text-gray-600">{existing.drills}</p>
                                      </div>
                                    )}
                                    {existing.additionalWarmup && (
                                      <div>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Add'l Warm-Up</p>
                                        <p className="text-xs text-gray-600 leading-snug">{existing.additionalWarmup}</p>
                                      </div>
                                    )}
                                    {existing.mainWorkout && (
                                      <div>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Main Workout</p>
                                        <p className={`text-xs font-medium leading-snug ${color.text}`}>{existing.mainWorkout}</p>
                                      </div>
                                    )}
                                    {existing.cooldown && (
                                      <div>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Cool-Down</p>
                                        <p className="text-xs text-gray-600 leading-snug">{existing.cooldown}</p>
                                      </div>
                                    )}
                                    {ctText && (
                                      <div>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Cross Training</p>
                                        <p className="text-xs text-teal-600">{ctText}</p>
                                      </div>
                                    )}
                                    {existing.notes && (
                                      <div>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Notes</p>
                                        <p className="text-xs text-gray-500 leading-snug italic">{existing.notes}</p>
                                      </div>
                                    )}
                                    {!existing.warmup && !existing.mainWorkout && !existing.cooldown && !ctText && !existing.notes && (
                                      <p className="text-xs text-gray-400 italic">No details yet</p>
                                    )}
                                    <p className="text-[10px] text-gray-300 pt-1">tap to edit ✏️</p>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="h-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" style={isExpanded ? { minHeight: '60px' } : {}}>
                                <span className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-bold text-base">+</span>
                              </div>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit Modal */}
      <Modal
        isOpen={!!modal}
        onClose={closeModal}
        title={modal ? `${modal.existing ? 'Edit' : 'Add'} Workout — ${modal.runnerName}` : ''}
        size="lg"
      >
        {modal && (
          <div className="space-y-3">
            <p className="text-sm text-gray-500 font-medium">
              {modal.date ? format(parseISO(modal.date + 'T12:00:00'), 'EEEE, MMMM d, yyyy') : ''}
            </p>

            {/* Template picker */}
            {templates.length > 0 && (
              <div className="bg-indigo-50 rounded-xl p-3 border border-indigo-100">
                <label className="block text-xs font-bold text-indigo-700 uppercase tracking-widest mb-1.5">
                  Load from Template <span className="normal-case font-normal text-indigo-500">(optional)</span>
                </label>
                <select
                  className="w-full border border-indigo-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                  value={templateId}
                  onChange={(e) => applyTemplate(e.target.value)}
                >
                  <option value="">— choose a template —</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>{t.title}</option>
                  ))}
                </select>
              </div>
            )}

            {/* 1 — Workout Type & Title */}
            <Card step="1" title="Workout Type & Title">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
                  <select
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    value={form.workoutType}
                    onChange={(e) => setField('workoutType', e.target.value)}
                  >
                    <option value="">— select type —</option>
                    {FORM_WORKOUT_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Title <span className="text-gray-400 font-normal">(optional)</span></label>
                  <input
                    type="text"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    value={form.workoutTitle}
                    onChange={(e) => setField('workoutTitle', e.target.value)}
                    placeholder="e.g. Threshold Tuesday"
                  />
                </div>
              </div>
            </Card>

            {/* 2 — Warm-Up */}
            <Card step="2" title="Warm-Up">
              <textarea rows={2}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
                value={form.warmup}
                onChange={(e) => setField('warmup', e.target.value)}
                placeholder="e.g. 10 min easy jog"
              />
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Drills</label>
                <select
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  value={form.drills}
                  onChange={(e) => setField('drills', e.target.value)}
                >
                  <option value="">— none —</option>
                  {DRILL_OPTIONS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Additional Warm-Up <span className="text-gray-400 font-normal">(optional)</span></label>
                <textarea rows={2}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
                  value={form.additionalWarmup}
                  onChange={(e) => setField('additionalWarmup', e.target.value)}
                  placeholder="e.g. strides, hurdle mobility"
                />
              </div>
            </Card>

            {/* 3 — Main Workout */}
            <Card step="3" title="Main Workout">
              <textarea rows={4}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
                value={form.mainWorkout}
                onChange={(e) => setField('mainWorkout', e.target.value)}
                placeholder="e.g. 6 x 800m @ 5K pace, 90 sec rest"
              />
            </Card>

            {/* 4 — Cool-Down */}
            <Card step="4" title="Cool-Down">
              <textarea rows={2}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
                value={form.cooldown}
                onChange={(e) => setField('cooldown', e.target.value)}
                placeholder="e.g. 10 min easy, stretching"
              />
            </Card>

            {/* 5 — Cross Training */}
            <Card step="5" title="Cross Training">
              <CrossTrainingInput
                value={form.crossTraining}
                onChange={(v) => setField('crossTraining', v)}
              />
            </Card>

            {/* 6 — Coach Notes */}
            <Card step="6" title="Coach Notes">
              <textarea rows={2}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
                value={form.notes}
                onChange={(e) => setField('notes', e.target.value)}
                placeholder="Notes visible to this athlete…"
              />
            </Card>

            {/* Peer Visibility Group */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Peer Visibility Group</label>
              <select
                className="w-full sm:w-64 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                value={form.visibilityGroup}
                onChange={(e) => setField('visibilityGroup', e.target.value)}
              >
                {VG_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-2">
              <div>
                {modal.existing && !confirmDel && (
                  <button onClick={() => setConfirmDel(true)} className="text-sm text-red-500 hover:text-red-700 font-medium">
                    Delete workout
                  </button>
                )}
                {confirmDel && (
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-red-600 font-medium">Remove this workout?</span>
                    <button onClick={handleDelete} disabled={deleting} className="text-sm text-red-600 font-semibold hover:text-red-800">
                      {deleting ? 'Deleting…' : 'Yes, delete'}
                    </button>
                    <button onClick={() => setConfirmDel(false)} className="text-sm text-gray-500 hover:text-gray-700">Cancel</button>
                  </div>
                )}
              </div>
              <div className="flex gap-3">
                <button onClick={closeModal} className="border border-gray-200 text-gray-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">
                  Cancel
                </button>
                <button onClick={handleSave} disabled={saving} className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
                  {saving ? 'Saving…' : modal.existing ? 'Save Changes' : 'Add Workout'}
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
