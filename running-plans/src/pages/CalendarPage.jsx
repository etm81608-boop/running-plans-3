import { useState, useMemo, useCallback } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import {
  collection, addDoc, updateDoc, doc, writeBatch, serverTimestamp,
} from 'firebase/firestore'
import { db } from '../firebase/config'
import { useCollection } from '../hooks/useCollection'
import Modal from '../components/Modal'
import Toast from '../components/Toast'
import CrossTrainingInput, { normaliseCT, ctToText } from '../components/CrossTrainingInput'
import { WORKOUT_TYPES } from '../utils/constants'
import useWeather from '../hooks/useWeather'
import { format, parseISO } from 'date-fns'

// ── Constants ─────────────────────────────────────────────────────────────────

const FORM_WORKOUT_TYPES = WORKOUT_TYPES.filter((t) => t.value !== 'rest')
const DRILL_OPTIONS = ['Cone / Wicket Drills', 'Hurdle Drills', 'Hip Drills']

const EMPTY_FORM = {
  workoutType: '', workoutTitle: '', warmup: '', drills: '',
  additionalWarmup: '', mainWorkout: '', cooldown: '',
  crossTraining: [], notes: '',
}

const CALENDAR_COLORS = {
  run: '#4f46e5', tempo: '#7c3aed', interval: '#2563eb', long_run: '#0891b2',
  easy: '#16a34a', recovery: '#9ca3af', off_day: '#64748b', rest: '#9ca3af',
  cross: '#d97706', strength: '#dc2626', other: '#6b7280',
}
function eventColor(t) { return CALENDAR_COLORS[t] || CALENDAR_COLORS.other }

// ── Card ──────────────────────────────────────────────────────────────────────

function Card({ step, title, children }) {
  return (
    <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
      <div className="flex items-center gap-2 mb-3">
        <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">{step}</span>
        <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

// ── Print View ────────────────────────────────────────────────────────────────

function PrintView({ grouped }) {
  const byDate = useMemo(() => {
    const map = {}
    grouped.forEach((g) => { if (!map[g.date]) map[g.date] = []; map[g.date].push(g) })
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b))
  }, [grouped])
  return (
    <div className="print-view p-6 font-sans">
      <h1 className="text-2xl font-bold mb-6 text-gray-900">Training Schedule</h1>
      {byDate.map(([date, events]) => (
        <div key={date} className="mb-6">
          <h2 className="text-lg font-bold text-gray-800 border-b border-gray-300 pb-1 mb-3">
            {format(parseISO(date + 'T12:00:00'), 'EEEE, MMMM d, yyyy')}
          </h2>
          {events.map((ev, i) => (
            <div key={i} className="mb-3 ml-4">
              <p className="font-semibold text-gray-800">{ev.title}</p>
              <ul className="ml-4 mt-1">{ev.runnerNames.map((n) => <li key={n} className="text-sm text-gray-600">• {n}</li>)}</ul>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

// ── Shared workout form ───────────────────────────────────────────────────────

function WorkoutFormFields({ form, setField }) {
  return (
    <>
      <Card step="1" title="Workout Type & Title">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
            <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              value={form.workoutType} onChange={(e) => setField('workoutType', e.target.value)}>
              <option value="">— select type —</option>
              {FORM_WORKOUT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Title <span className="text-gray-400 font-normal">(optional)</span></label>
            <input type="text" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              value={form.workoutTitle} onChange={(e) => setField('workoutTitle', e.target.value)} placeholder="e.g. Threshold Tuesday" />
          </div>
        </div>
      </Card>

      <Card step="2" title="Warm-Up">
        <textarea rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
          value={form.warmup} onChange={(e) => setField('warmup', e.target.value)} placeholder="e.g. 10 min easy jog" />
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Drills</label>
          <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            value={form.drills} onChange={(e) => setField('drills', e.target.value)}>
            <option value="">— none —</option>
            {DRILL_OPTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Additional Warm-Up <span className="text-gray-400 font-normal">(optional)</span></label>
          <textarea rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
            value={form.additionalWarmup} onChange={(e) => setField('additionalWarmup', e.target.value)} placeholder="e.g. strides, hurdle mobility" />
        </div>
      </Card>

      <Card step="3" title="Main Workout">
        <textarea rows={4} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
          value={form.mainWorkout} onChange={(e) => setField('mainWorkout', e.target.value)} placeholder="e.g. 6 x 800m @ 5K pace, 90 sec rest" />
      </Card>

      <Card step="4" title="Cool-Down">
        <textarea rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
          value={form.cooldown} onChange={(e) => setField('cooldown', e.target.value)} placeholder="e.g. 10 min easy, stretching" />
      </Card>

      <Card step="5" title="Cross Training">
        <CrossTrainingInput value={form.crossTraining} onChange={(v) => setField('crossTraining', v)} />
      </Card>

      <Card step="6" title="Coach Notes">
        <textarea rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
          value={form.notes} onChange={(e) => setField('notes', e.target.value)} placeholder="Notes visible to athletes…" />
      </Card>
    </>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const { docs: assignments } = useCollection('assignments', 'date')
  const { docs: allRunners }  = useCollection('runners', 'name')

  const [printMode, setPrintMode] = useState(false)
  const [toast, setToast]         = useState(null)

  // Track the visible calendar range for weather fetching
  const [viewRange, setViewRange] = useState({ start: null, end: null })
  const weatherByDate = useWeather(viewRange.start, viewRange.end)

  const handleDatesSet = useCallback(({ startStr, endStr }) => {
    setViewRange({
      start: startStr.split('T')[0],
      end:   endStr.split('T')[0],
    })
  }, [])

  // Create modal
  const [createModal,     setCreateModal]     = useState(null)
  const [createForm,      setCreateForm]      = useState(EMPTY_FORM)
  const [selectedRunners, setSelectedRunners] = useState([])
  const [creating,        setCreating]        = useState(false)

  // Edit modal
  const [editModal,  setEditModal]  = useState(null)
  const [editForm,   setEditForm]   = useState(EMPTY_FORM)
  const [saving,     setSaving]     = useState(false)
  const [deleting,   setDeleting]   = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)

  // Group assignments
  const { grouped, runnerCountByDay } = useMemo(() => {
    const map = {}; const countMap = {}
    assignments.forEach((a) => {
      if (!a.date) return
      if (!countMap[a.date]) countMap[a.date] = new Set()
      countMap[a.date].add(a.runnerName || a.runnerId || 'unknown')
      const key = `${a.date}__${a.workoutTitle || a.workoutType || 'workout'}`
      if (!map[key]) {
        map[key] = {
          key, date: a.date,
          title: a.workoutTitle || WORKOUT_TYPES.find(t => t.value === a.workoutType)?.label || 'Workout',
          workoutType: a.workoutType || '', workoutTitle: a.workoutTitle || '',
          warmup: a.warmup || '', drills: a.drills || '', additionalWarmup: a.additionalWarmup || '',
          mainWorkout: a.mainWorkout || '', cooldown: a.cooldown || '',
          crossTraining: normaliseCT(a.crossTraining), notes: a.notes || '',
          assignmentIds: [a.id], runnerNames: [a.runnerName || 'Runner'],
        }
      } else {
        map[key].assignmentIds.push(a.id)
        if (a.runnerName && !map[key].runnerNames.includes(a.runnerName)) map[key].runnerNames.push(a.runnerName)
      }
    })
    return {
      grouped: Object.values(map),
      runnerCountByDay: Object.fromEntries(Object.entries(countMap).map(([d, s]) => [d, s.size])),
    }
  }, [assignments])

  const calendarEvents = useMemo(() => grouped.map((g) => ({
    id: g.key,
    title: g.runnerNames.length > 1 ? `${g.title} · ${g.runnerNames.length}` : g.title,
    date: g.date,
    backgroundColor: eventColor(g.workoutType),
    borderColor: eventColor(g.workoutType),
    extendedProps: { groupKey: g.key },
  })), [grouped])

  // Create handlers
  function handleDateClick({ dateStr }) {
    setCreateForm(EMPTY_FORM); setSelectedRunners([]); setCreateModal({ date: dateStr })
  }
  function toggleRunner(runner) {
    setSelectedRunners((prev) => prev.find((r) => r.id === runner.id) ? prev.filter((r) => r.id !== runner.id) : [...prev, runner])
  }
  function setCreateField(f, v) { setCreateForm((p) => ({ ...p, [f]: v })) }

  async function handleCreateSave() {
    if (!createModal || selectedRunners.length === 0) return
    setCreating(true)
    const dateStr = format(parseISO(createModal.date + 'T12:00:00'), 'MMMM d, yyyy')
    const base = {
      date: createModal.date, dateStr,
      workoutType: createForm.workoutType,
      workoutTitle: createForm.workoutTitle.trim() || createForm.mainWorkout.trim().slice(0, 60) || 'Workout',
      warmup: createForm.warmup.trim(), drills: createForm.drills,
      additionalWarmup: createForm.additionalWarmup.trim(),
      mainWorkout: createForm.mainWorkout.trim(), cooldown: createForm.cooldown.trim(),
      crossTraining: createForm.crossTraining, notes: createForm.notes.trim(),
    }
    try {
      await Promise.all(selectedRunners.map((r) =>
        addDoc(collection(db, 'assignments'), { ...base, runnerId: r.id, runnerName: r.name, createdAt: serverTimestamp() })
      ))
      setToast({ message: `Assigned to ${selectedRunners.length} runner${selectedRunners.length !== 1 ? 's' : ''}!`, type: 'success' })
      setCreateModal(null)
    } catch (err) { setToast({ message: err.message, type: 'error' }) }
    finally { setCreating(false) }
  }

  // Edit handlers
  function handleEventClick({ event }) {
    const g = grouped.find((x) => x.key === event.extendedProps.groupKey)
    if (!g) return
    setEditForm({
      workoutType: g.workoutType, workoutTitle: g.workoutTitle, warmup: g.warmup,
      drills: g.drills, additionalWarmup: g.additionalWarmup, mainWorkout: g.mainWorkout,
      cooldown: g.cooldown, crossTraining: normaliseCT(g.crossTraining), notes: g.notes,
    })
    setEditModal({ date: g.date, assignmentIds: g.assignmentIds, runnerNames: g.runnerNames })
    setConfirmDel(false)
  }
  function closeEditModal() { setEditModal(null); setConfirmDel(false) }
  function setEditField(f, v) { setEditForm((p) => ({ ...p, [f]: v })) }

  async function handleEditSave() {
    if (!editModal) return
    setSaving(true)
    const dateStr = format(parseISO(editModal.date + 'T12:00:00'), 'MMMM d, yyyy')
    const patch = {
      dateStr, workoutType: editForm.workoutType,
      workoutTitle: editForm.workoutTitle.trim() || editForm.mainWorkout.trim().slice(0, 60) || 'Workout',
      warmup: editForm.warmup.trim(), drills: editForm.drills,
      additionalWarmup: editForm.additionalWarmup.trim(),
      mainWorkout: editForm.mainWorkout.trim(), cooldown: editForm.cooldown.trim(),
      crossTraining: editForm.crossTraining, notes: editForm.notes.trim(),
    }
    try {
      const batch = writeBatch(db)
      editModal.assignmentIds.forEach((id) => batch.update(doc(db, 'assignments', id), patch))
      await batch.commit()
      setToast({ message: 'Workout updated!', type: 'success' })
      closeEditModal()
    } catch (err) { setToast({ message: err.message, type: 'error' }) }
    finally { setSaving(false) }
  }

  async function handleEditDelete() {
    if (!editModal) return
    setDeleting(true)
    try {
      const batch = writeBatch(db)
      editModal.assignmentIds.forEach((id) => batch.delete(doc(db, 'assignments', id)))
      await batch.commit()
      setToast({ message: 'Workout removed.', type: 'info' })
      closeEditModal()
    } catch (err) { setToast({ message: err.message, type: 'error' }) }
    finally { setDeleting(false) }
  }

  if (printMode) return (
    <>
      <style>{`@media print { body * { visibility: hidden; } .print-view, .print-view * { visibility: visible; } .print-view { position: fixed; top: 0; left: 0; width: 100%; } }`}</style>
      <div className="p-6">
        <div className="flex items-center gap-3 mb-4 no-print">
          <button onClick={() => setPrintMode(false)} className="px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-sm font-medium text-gray-600">← Back to Calendar</button>
          <button onClick={() => window.print()} className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium">🖨 Print</button>
        </div>
        <PrintView grouped={grouped} />
      </div>
    </>
  )

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Master Calendar</h1>
          <p className="text-sm text-gray-500 mt-0.5">Click a date to add a workout · Click a workout to edit it.</p>
        </div>
        <button onClick={() => setPrintMode(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-sm font-medium text-gray-600">
          🖨 Print Schedule
        </button>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mb-5">
        {WORKOUT_TYPES.filter(t => t.value !== 'rest').map((t) => (
          <div key={t.value} className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: eventColor(t.value) }} />
            <span className="text-xs text-gray-600">{t.label}</span>
          </div>
        ))}
      </div>

      {/* Calendar */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <FullCalendar
          plugins={[dayGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          events={calendarEvents}
          eventClick={handleEventClick}
          dateClick={handleDateClick}
          datesSet={handleDatesSet}
          eventCursor="pointer"
          dayCellContent={(arg) => {
            const dateStr = arg.date.toISOString().split('T')[0]
            const count   = runnerCountByDay[dateStr] || 0
            const wx      = weatherByDate[dateStr]
            return (
              <div style={{ width: '100%', padding: '2px 4px' }}>
                {/* Date number row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '0.85em', fontWeight: '500', color: '#374151' }}>
                    {arg.dayNumberText}
                  </span>
                  {count > 0 && (
                    <span style={{
                      minWidth: '1.15rem', height: '1.15rem', borderRadius: '50%',
                      backgroundColor: '#4f46e5', color: 'white', fontSize: '10px',
                      fontWeight: 'bold', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', padding: '0 3px', lineHeight: 1,
                    }} title={`${count} runner${count !== 1 ? 's' : ''}`}>
                      {count}
                    </span>
                  )}
                </div>
                {/* Weather row */}
                {wx && (
                  <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '1px', lineHeight: 1.3 }}>
                    {wx.icon} {wx.high}°/{wx.low}°
                    {wx.precipPct != null && wx.precipPct >= 20 && (
                      <span style={{ color: '#3b82f6' }}> · {wx.precipPct}%</span>
                    )}
                  </div>
                )}
              </div>
            )
          }}
          headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,dayGridWeek' }}
          height="auto"
        />
      </div>

      {/* Create Modal */}
      <Modal isOpen={!!createModal} onClose={() => setCreateModal(null)}
        title={createModal ? `Add Workout — ${format(parseISO(createModal.date + 'T12:00:00'), 'MMMM d, yyyy')}` : ''} size="lg">
        {createModal && (
          <div className="space-y-3">
            <Card step="0" title="Assign To">
              <p className="text-xs text-gray-500 mb-2">Select one or more runners for this workout.</p>
              <div className="flex flex-wrap gap-2">
                {allRunners.map((r) => {
                  const isSel = selectedRunners.some((x) => x.id === r.id)
                  return (
                    <button key={r.id} onClick={() => toggleRunner(r)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${isSel ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-gray-200 text-gray-600 hover:border-indigo-400 hover:text-indigo-600'}`}>
                      {r.name}
                    </button>
                  )
                })}
              </div>
              {selectedRunners.length === 0 && <p className="text-xs text-amber-600 mt-2">Select at least one runner to save.</p>}
            </Card>
            <WorkoutFormFields form={createForm} setField={setCreateField} />
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setCreateModal(null)} className="border border-gray-200 text-gray-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
              <button onClick={handleCreateSave} disabled={creating || selectedRunners.length === 0}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
                {creating ? 'Saving…' : `Assign to ${selectedRunners.length || '—'} Runner${selectedRunners.length !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={!!editModal} onClose={closeEditModal}
        title={editModal ? `Edit Workout — ${format(parseISO(editModal.date + 'T12:00:00'), 'MMMM d, yyyy')}` : ''} size="lg">
        {editModal && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-1.5 pb-1">
              {editModal.runnerNames.map((name) => (
                <span key={name} className="px-2.5 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full text-xs font-medium">{name}</span>
              ))}
            </div>
            {editModal.runnerNames.length > 1 && (
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                Saving will update this workout for all {editModal.runnerNames.length} runners above.
              </p>
            )}
            <WorkoutFormFields form={editForm} setField={setEditField} />
            <div className="flex items-center justify-between pt-2">
              <div>
                {!confirmDel && <button onClick={() => setConfirmDel(true)} className="text-sm text-red-500 hover:text-red-700 font-medium">Delete workout</button>}
                {confirmDel && (
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-red-600 font-medium">Delete for all {editModal.runnerNames.length} runner{editModal.runnerNames.length !== 1 ? 's' : ''}?</span>
                    <button onClick={handleEditDelete} disabled={deleting} className="text-sm text-red-600 font-semibold hover:text-red-800">{deleting ? 'Deleting…' : 'Yes, delete'}</button>
                    <button onClick={() => setConfirmDel(false)} className="text-sm text-gray-500 hover:text-gray-700">Cancel</button>
                  </div>
                )}
              </div>
              <div className="flex gap-3">
                <button onClick={closeEditModal} className="border border-gray-200 text-gray-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
                <button onClick={handleEditSave} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
                  {saving ? 'Saving…' : 'Save Changes'}
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




