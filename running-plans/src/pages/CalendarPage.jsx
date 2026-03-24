import { useState, useMemo } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import {
  collection, updateDoc, deleteDoc, doc, writeBatch,
} from 'firebase/firestore'
import { db } from '../firebase/config'
import { useCollection } from '../hooks/useCollection'
import Modal from '../components/Modal'
import Toast from '../components/Toast'
import CrossTrainingInput, { EMPTY_CT, normaliseCT, ctToText } from '../components/CrossTrainingInput'
import { WORKOUT_TYPES } from '../utils/constants'
import { format, parseISO } from 'date-fns'

// ── Constants ─────────────────────────────────────────────────────────────────

const FORM_WORKOUT_TYPES = WORKOUT_TYPES.filter((t) => t.value !== 'rest')

const DRILL_OPTIONS = ['Cone / Wicket Drills', 'Hurdle Drills', 'Hip Drills']

const EMPTY_FORM = {
  workoutType:      '',
  workoutTitle:     '',
  warmup:           '',
  drills:           '',
  additionalWarmup: '',
  mainWorkout:      '',
  cooldown:         '',
  crossTraining:    EMPTY_CT,
  notes:            '',
}

const CALENDAR_COLORS = {
  run:        '#4f46e5',
  tempo:      '#7c3aed',
  interval:   '#2563eb',
  long_run:   '#0891b2',
  easy:       '#16a34a',
  recovery:   '#9ca3af',
  off_day:    '#64748b',
  rest:       '#9ca3af',
  cross:      '#d97706',
  strength:   '#dc2626',
  other:      '#6b7280',
}

function eventColor(workoutType) {
  return CALENDAR_COLORS[workoutType] || CALENDAR_COLORS.other
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
      <div className="space-y-2">{children}</div>
    </div>
  )
}

// ── Print View ────────────────────────────────────────────────────────────────

function PrintView({ grouped }) {
  const byDate = useMemo(() => {
    const map = {}
    grouped.forEach((g) => {
      if (!map[g.date]) map[g.date] = []
      map[g.date].push(g)
    })
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
              <ul className="ml-4 mt-1">
                {ev.runnerNames.map((name) => (
                  <li key={name} className="text-sm text-gray-600">• {name}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const { docs: assignments } = useCollection('assignments', 'date')

  const [printMode,  setPrintMode]  = useState(false)
  const [toast,      setToast]      = useState(null)
  const [editModal,  setEditModal]  = useState(null) // { assignmentIds, runnerNames, date, form }
  const [form,       setForm]       = useState(EMPTY_FORM)
  const [saving,     setSaving]     = useState(false)
  const [deleting,   setDeleting]   = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)

  // ── Group assignments by date + workout ──────────────────────────────────────

  const { grouped, runnerCountByDay } = useMemo(() => {
    const map = {}         // key → grouped event
    const countMap = {}    // dateStr → Set of runner names

    assignments.forEach((a) => {
      if (!a.date) return

      // Runner count per day
      if (!countMap[a.date]) countMap[a.date] = new Set()
      countMap[a.date].add(a.runnerName || a.runnerId || 'unknown')

      // Group key: date + workoutTitle (or workoutType)
      const key = `${a.date}__${a.workoutTitle || a.workoutType || 'workout'}`

      if (!map[key]) {
        map[key] = {
          key,
          date:             a.date,
          title:            a.workoutTitle || WORKOUT_TYPES.find(t => t.value === a.workoutType)?.label || 'Workout',
          workoutType:      a.workoutType      || '',
          workoutTitle:     a.workoutTitle     || '',
          warmup:           a.warmup           || '',
          drills:           a.drills           || '',
          additionalWarmup: a.additionalWarmup || '',
          mainWorkout:      a.mainWorkout      || '',
          cooldown:         a.cooldown         || '',
          crossTraining:    a.crossTraining    || EMPTY_CT,
          notes:            a.notes            || '',
          assignmentIds:    [a.id],
          runnerNames:      [a.runnerName || 'Runner'],
        }
      } else {
        map[key].assignmentIds.push(a.id)
        if (a.runnerName && !map[key].runnerNames.includes(a.runnerName)) {
          map[key].runnerNames.push(a.runnerName)
        }
      }
    })

    const grouped = Object.values(map)
    const runnerCountByDay = Object.fromEntries(
      Object.entries(countMap).map(([date, s]) => [date, s.size])
    )
    return { grouped, runnerCountByDay }
  }, [assignments])

  // ── FullCalendar events ───────────────────────────────────────────────────────

  const calendarEvents = useMemo(() =>
    grouped.map((g) => ({
      id:              g.key,
      title:           g.runnerNames.length > 1
                         ? `${g.title} · ${g.runnerNames.length}`
                         : g.title,
      date:            g.date,
      backgroundColor: eventColor(g.workoutType),
      borderColor:     eventColor(g.workoutType),
      extendedProps:   { groupKey: g.key },
    })),
  [grouped])

  // ── Edit handlers ─────────────────────────────────────────────────────────────

  function handleEventClick({ event }) {
    const g = grouped.find((x) => x.key === event.extendedProps.groupKey)
    if (!g) return
    setForm({
      workoutType:      g.workoutType,
      workoutTitle:     g.workoutTitle,
      warmup:           g.warmup,
      drills:           g.drills,
      additionalWarmup: g.additionalWarmup,
      mainWorkout:      g.mainWorkout,
      cooldown:         g.cooldown,
      crossTraining:    normaliseCT(g.crossTraining),
      notes:            g.notes,
    })
    setEditModal({
      date:          g.date,
      assignmentIds: g.assignmentIds,
      runnerNames:   g.runnerNames,
    })
    setConfirmDel(false)
  }

  function closeEditModal() {
    setEditModal(null)
    setConfirmDel(false)
  }

  function setField(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function handleEditSave() {
    if (!editModal) return
    setSaving(true)
    const dateStr = format(parseISO(editModal.date + 'T12:00:00'), 'MMMM d, yyyy')
    const patch = {
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
    }
    try {
      const batch = writeBatch(db)
      editModal.assignmentIds.forEach((id) => {
        batch.update(doc(db, 'assignments', id), patch)
      })
      await batch.commit()
      setToast({ message: 'Workout updated!', type: 'success' })
      closeEditModal()
    } catch (err) {
      setToast({ message: err.message, type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  async function handleEditDelete() {
    if (!editModal) return
    setDeleting(true)
    try {
      const batch = writeBatch(db)
      editModal.assignmentIds.forEach((id) => {
        batch.delete(doc(db, 'assignments', id))
      })
      await batch.commit()
      setToast({ message: 'Workout removed.', type: 'info' })
      closeEditModal()
    } catch (err) {
      setToast({ message: err.message, type: 'error' })
    } finally {
      setDeleting(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  if (printMode) {
    return (
      <>
        <style>{`
          @media print {
            body * { visibility: hidden; }
            .print-view, .print-view * { visibility: visible; }
            .print-view { position: fixed; top: 0; left: 0; width: 100%; }
          }
        `}</style>
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4 no-print">
            <button
              onClick={() => setPrintMode(false)}
              className="px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-sm font-medium text-gray-600"
            >
              ← Back to Calendar
            </button>
            <button
              onClick={() => window.print()}
              className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium"
            >
              🖨 Print
            </button>
          </div>
          <PrintView grouped={grouped} />
        </div>
      </>
    )
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Master Calendar</h1>
          <p className="text-sm text-gray-500 mt-0.5">Click any workout to edit it.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPrintMode(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-sm font-medium text-gray-600"
          >
            🖨 Print Schedule
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mb-5">
        {WORKOUT_TYPES.filter(t => t.value !== 'rest').map((t) => (
          <div key={t.value} className="flex items-center gap-1.5">
            <span
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: eventColor(t.value) }}
            />
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
          eventCursor="pointer"
          dayCellContent={(arg) => {
            const dateStr = arg.date.toISOString().split('T')[0]
            const count   = runnerCountByDay[dateStr] || 0
            return (
              <div className="relative w-full h-full min-h-[2rem]">
                <span className="fc-daygrid-day-number">{arg.dayNumberText}</span>
                {count > 0 && (
                  <span
                    className="absolute top-0.5 right-0.5 min-w-[1.15rem] h-[1.15rem] rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center px-1 leading-none"
                    title={`${count} runner${count !== 1 ? 's' : ''}`}
                  >
                    {count}
                  </span>
                )}
              </div>
            )
          }}
          headerToolbar={{
            left:   'prev,next today',
            center: 'title',
            right:  'dayGridMonth,dayGridWeek',
          }}
          height="auto"
        />
      </div>

      {/* Edit Modal */}
      <Modal
        isOpen={!!editModal}
        onClose={closeEditModal}
        title={editModal ? `Edit Workout — ${format(parseISO(editModal.date + 'T12:00:00'), 'MMMM d, yyyy')}` : ''}
        size="lg"
      >
        {editModal && (
          <div className="space-y-3">
            {/* Runners in this group */}
            <div className="flex flex-wrap gap-1.5 pb-1">
              {editModal.runnerNames.map((name) => (
                <span key={name} className="px-2.5 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full text-xs font-medium">
                  {name}
                </span>
              ))}
            </div>
            {editModal.runnerNames.length > 1 && (
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                Saving will update this workout for all {editModal.runnerNames.length} runners above.
              </p>
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
                placeholder="Notes visible to athletes…"
              />
            </Card>

            {/* Actions */}
            <div className="flex items-center justify-between pt-2">
              <div>
                {!confirmDel && (
                  <button onClick={() => setConfirmDel(true)} className="text-sm text-red-500 hover:text-red-700 font-medium">
                    Delete workout
                  </button>
                )}
                {confirmDel && (
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-red-600 font-medium">
                      Delete for all {editModal.runnerNames.length} runner{editModal.runnerNames.length !== 1 ? 's' : ''}?
                    </span>
                    <button onClick={handleEditDelete} disabled={deleting} className="text-sm text-red-600 font-semibold hover:text-red-800">
                      {deleting ? 'Deleting…' : 'Yes, delete'}
                    </button>
                    <button onClick={() => setConfirmDel(false)} className="text-sm text-gray-500 hover:text-gray-700">Cancel</button>
                  </div>
                )}
              </div>
              <div className="flex gap-3">
                <button onClick={closeEditModal} className="border border-gray-200 text-gray-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">
                  Cancel
                </button>
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




