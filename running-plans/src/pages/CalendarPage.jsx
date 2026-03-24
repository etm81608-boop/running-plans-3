import { useRef, useState, useMemo } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin  from '@fullcalendar/daygrid'
import listPlugin     from '@fullcalendar/list'
import interactionPlugin from '@fullcalendar/interaction'
import { deleteDoc, doc } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useCollection } from '../hooks/useCollection'
import Modal from '../components/Modal'
import Toast from '../components/Toast'
import { getWorkoutTypeLabel, getWorkoutTypeColor, getWorkoutCalendarColor } from '../utils/constants'
import { format, parseISO } from 'date-fns'
import { Link } from 'react-router-dom'

// ── Helpers ──────────────────────────────────────────────────────────────────

function getRunners(a) {
  if (Array.isArray(a.runnerNames) && a.runnerNames.length) return a.runnerNames
  if (a.runnerName) return [a.runnerName]
  return []
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const { docs: assignments } = useCollection('assignments', 'date')

  const [selected,   setSelected]   = useState(null)
  const [toast,      setToast]      = useState(null)
  const [printMode,  setPrintMode]  = useState(false)
  const calendarRef = useRef(null)

  // ── Group assignments with identical workouts on the same day ──────────────
  const groupedAssignments = useMemo(() => {
    const map = {}
    assignments.forEach((a) => {
      const key = `${a.date}__${a.workoutId || a.workoutTitle || 'custom'}`
      if (!map[key]) {
        map[key] = {
          ...a,
          runnerNames: [...getRunners(a)],
          assignmentIds: [a.id],
          _groupKey: key,
        }
      } else {
        const existing = map[key]
        const newRunners = getRunners(a)
        existing.runnerNames = [...new Set([...existing.runnerNames, ...newRunners])]
        existing.assignmentIds.push(a.id)
      }
    })
    return Object.values(map)
  }, [assignments])

  // ── Runner count per day (unique runners across all workouts that day) ─────
  const runnerCountByDay = useMemo(() => {
    const map = {}
    assignments.forEach((a) => {
      if (!map[a.date]) map[a.date] = new Set()
      getRunners(a).forEach((r) => map[a.date].add(r))
    })
    const counts = {}
    Object.entries(map).forEach(([date, set]) => { counts[date] = set.size })
    return counts
  }, [assignments])

  // ── Build FullCalendar events from grouped assignments ─────────────────────
  const events = useMemo(() =>
    groupedAssignments.map((a) => ({
      id:              a._groupKey,
      title:           a.workoutTitle || 'Workout',
      date:            a.date,
      backgroundColor: getWorkoutCalendarColor(a.workoutType),
      borderColor:     getWorkoutCalendarColor(a.workoutType),
      extendedProps:   a,
    })),
  [groupedAssignments])

  // ── Print data: sorted dates → workouts within each date ──────────────────
  const printData = useMemo(() => {
    const dateMap = {}
    groupedAssignments.forEach((a) => {
      if (!dateMap[a.date]) dateMap[a.date] = []
      dateMap[a.date].push(a)
    })
    return Object.entries(dateMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, workouts]) => ({ date, workouts }))
  }, [groupedAssignments])

  // ── Handlers ──────────────────────────────────────────────────────────────
  function handleEventClick(info) {
    setSelected(info.event.extendedProps)
  }

  async function handleDelete() {
    if (!selected) return
    try {
      const ids = selected.assignmentIds || [selected.id]
      for (const id of ids) {
        await deleteDoc(doc(db, 'assignments', id))
      }
      setToast({ message: `Assignment${ids.length > 1 ? 's' : ''} deleted.`, type: 'info' })
      setSelected(null)
    } catch (err) {
      setToast({ message: err.message, type: 'error' })
    }
  }

  function copyLink() {
    const appUrl = import.meta.env.VITE_APP_URL || window.location.origin
    const id     = selected?.assignmentIds?.[0] ?? selected?.id
    const link   = `${appUrl}/#/workout/${id}`
    navigator.clipboard.writeText(link)
    setToast({ message: 'Share link copied!', type: 'success' })
  }

  // ── Print Mode ─────────────────────────────────────────────────────────────
  if (printMode) {
    return <PrintView data={printData} onClose={() => setPrintMode(false)} />
  }

  // ── Calendar View ──────────────────────────────────────────────────────────
  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Master Calendar</h1>
          <p className="text-sm text-gray-500 mt-0.5">All scheduled workouts across your team.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setPrintMode(true)}
            className="flex items-center gap-1.5 border border-gray-300 text-gray-700 hover:bg-gray-50 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Print Schedule
          </button>
          <Link
            to="/assign"
            className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            + Assign Workout
          </Link>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 mb-5">
        {[
          { color: '#22c55e', label: 'Easy Run' },
          { color: '#f97316', label: 'Tempo' },
          { color: '#ef4444', label: 'Interval' },
          { color: '#a855f7', label: 'Long Run' },
          { color: '#eab308', label: 'Race' },
          { color: '#14b8a6', label: 'Strength / XT' },
          { color: '#3b82f6', label: 'Time Trial' },
          { color: '#94a3b8', label: 'Off Day' },
          { color: '#9ca3af', label: 'Rest & Recovery' },
        ].map(({ color, label }) => (
          <span key={label} className="flex items-center gap-1.5 text-xs text-gray-600">
            <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: color }} />
            {label}
          </span>
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, listPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          headerToolbar={{
            left:   'prev,next today',
            center: 'title',
            right:  'dayGridMonth,listMonth',
          }}
          buttonText={{ listMonth: 'List' }}
          events={events}
          eventClick={handleEventClick}
          height="auto"
          displayEventTime={false}

          // Day cell: show runner count badge in upper-right corner
          dayCellContent={(arg) => {
            const dateStr = format(arg.date, 'yyyy-MM-dd')
            const count   = runnerCountByDay[dateStr]
            return (
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', width: '100%', gap: '4px' }}>
                <span style={{ fontSize: '0.85em', fontWeight: arg.isToday ? '700' : '400' }}>
                  {arg.dayNumberText}
                </span>
                {count > 0 && (
                  <span style={{
                    background: '#4f46e5',
                    color: 'white',
                    fontSize: '0.6rem',
                    fontWeight: '700',
                    borderRadius: '9999px',
                    minWidth: '17px',
                    height: '17px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0 3px',
                    flexShrink: 0,
                    marginTop: '1px',
                  }}>
                    {count}
                  </span>
                )}
              </div>
            )
          }}

          // Event pill: show title + runner count
          eventContent={(arg) => {
            const runners = arg.event.extendedProps.runnerNames || []
            return (
              <div style={{ padding: '1px 5px', overflow: 'hidden', width: '100%', cursor: 'pointer' }}>
                <div style={{
                  fontWeight: '600',
                  fontSize: '0.72rem',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  lineHeight: '1.4',
                }}>
                  {arg.event.title}
                  {runners.length > 0 && (
                    <span style={{ fontWeight: '400', opacity: 0.85 }}>
                      {' '}· {runners.length}
                    </span>
                  )}
                </div>
              </div>
            )
          }}
        />
      </div>

      {/* Assignment Detail Modal */}
      <Modal
        isOpen={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.workoutTitle || 'Workout'}
        size="md"
      >
        {selected && (
          <div className="space-y-4 text-sm">
            <div className="flex flex-wrap gap-3">
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${getWorkoutTypeColor(selected.workoutType)}`}>
                {getWorkoutTypeLabel(selected.workoutType)}
              </span>
              <span className="text-xs text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">
                {selected.date ? format(new Date(selected.date + 'T12:00:00'), 'EEEE, MMMM d, yyyy') : ''}
              </span>
            </div>

            {/* Runners */}
            <div>
              <p className="font-medium text-gray-700 mb-1">
                Assigned to ({selected.runnerNames?.length || 0} runner{selected.runnerNames?.length !== 1 ? 's' : ''})
              </p>
              {selected.runnerNames && selected.runnerNames.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {[...selected.runnerNames].sort().map((name) => (
                    <span key={name} className="text-xs bg-brand-50 text-brand-700 px-2 py-0.5 rounded-full font-medium">
                      {name}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500">{selected.groupName || 'All runners'}</p>
              )}
            </div>

            {/* Workout detail */}
            {selected.workoutData && (
              <>
                {selected.workoutData.description && (
                  <div>
                    <p className="font-medium text-gray-700 mb-1">Overview</p>
                    <p className="text-gray-600">{selected.workoutData.description}</p>
                  </div>
                )}
                {selected.workoutData.warmup   && <WorkoutSection title="Warm-Up"   content={selected.workoutData.warmup} />}
                {selected.workoutData.mainSet  && <WorkoutSection title="Main Set"  content={selected.workoutData.mainSet} />}
                {selected.workoutData.cooldown && <WorkoutSection title="Cool-Down" content={selected.workoutData.cooldown} />}
                {selected.workoutData.targetPace && (
                  <p className="text-gray-500">
                    <span className="font-medium">Target pace:</span> {selected.workoutData.targetPace}
                  </p>
                )}
              </>
            )}

            {/* Cross training */}
            {selected.crossTraining?.type && (
              <div>
                <p className="font-medium text-gray-700 mb-1">Cross Training</p>
                <p className="text-gray-600 capitalize">
                  {selected.crossTraining.type === 'lift' && selected.crossTraining.liftOption
                    ? `Lift — ${selected.crossTraining.liftOption}`
                    : selected.crossTraining.type}
                  {selected.crossTraining.notes && ` · ${selected.crossTraining.notes}`}
                </p>
              </div>
            )}

            {selected.notes && (
              <div>
                <p className="font-medium text-gray-700 mb-1">Coach Notes</p>
                <p className="text-gray-600 whitespace-pre-wrap">{selected.notes}</p>
              </div>
            )}

            <div className="pt-4 flex flex-wrap gap-3 border-t border-gray-100">
              <button
                onClick={copyLink}
                className="flex items-center gap-1.5 text-sm text-brand-600 hover:text-brand-800 font-medium"
              >
                Copy Share Link
              </button>
              <button
                onClick={handleDelete}
                className="ml-auto text-sm text-red-500 hover:text-red-700 font-medium"
              >
                Delete Assignment{selected.assignmentIds?.length > 1 ? 's' : ''}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}

// ── Print View ─────────────────────────────────────────────────────────────────

function PrintView({ data, onClose }) {
  return (
    <div className="p-8 max-w-4xl">

      {/* Controls (screen only) */}
      <div className="flex items-center justify-between mb-6 print:hidden">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Print Schedule</h1>
          <p className="text-sm text-gray-500">Grouped by workout · runner names listed under each</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => window.print()}
            className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Print
          </button>
          <button
            onClick={onClose}
            className="border border-gray-300 text-gray-700 hover:bg-gray-50 px-4 py-2 rounded-lg text-sm font-medium"
          >
            ← Back to Calendar
          </button>
        </div>
      </div>

      {/* Printable content */}
      <div className="print-content">

        {/* Header (visible in print) */}
        <div className="mb-8 pb-4 border-b-2 border-gray-900">
          <h1 className="text-2xl font-bold">Episcopal Academy Track &amp; Field</h1>
          <p className="text-gray-600 text-sm mt-0.5">Workout Schedule — printed {format(new Date(), 'MMMM d, yyyy')}</p>
        </div>

        {data.length === 0 ? (
          <p className="text-gray-400 italic">No workouts scheduled.</p>
        ) : (
          <div className="space-y-10">
            {data.map(({ date, workouts }) => (
              <div key={date} className="break-inside-avoid">

                {/* Date header */}
                <h2 className="text-base font-black uppercase tracking-wide text-gray-800 border-b border-gray-300 pb-1 mb-4">
                  {format(parseISO(date + 'T12:00:00'), 'EEEE, MMMM d, yyyy')}
                </h2>

                <div className="space-y-5 pl-2">
                  {workouts.map((workout, i) => {
                    const runners = [...(workout.runnerNames || [])].sort()
                    return (
                      <div key={i} className="break-inside-avoid">

                        {/* Workout title + type badge */}
                        <div className="flex items-center gap-3 mb-1">
                          <span className="font-bold text-gray-900 text-sm">
                            {workout.workoutTitle || 'Workout'}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${getWorkoutTypeColor(workout.workoutType)}`}>
                            {getWorkoutTypeLabel(workout.workoutType)}
                          </span>
                        </div>

                        {/* Main workout description */}
                        {workout.workoutData?.mainSet && (
                          <p className="text-xs text-gray-600 mb-2 whitespace-pre-wrap pl-2 border-l-2 border-gray-200">
                            {workout.workoutData.mainSet}
                          </p>
                        )}

                        {/* Cross training */}
                        {workout.crossTraining?.type && (
                          <p className="text-xs text-teal-700 mb-2 pl-2">
                            <span className="font-semibold">Cross Training:</span>{' '}
                            {workout.crossTraining.type === 'lift' && workout.crossTraining.liftOption
                              ? `Lift — ${workout.crossTraining.liftOption}`
                              : workout.crossTraining.type}
                            {workout.crossTraining.notes && ` · ${workout.crossTraining.notes}`}
                          </p>
                        )}

                        {/* Coach notes */}
                        {workout.notes && (
                          <p className="text-xs text-amber-700 mb-2 pl-2">
                            <span className="font-semibold">Note:</span> {workout.notes}
                          </p>
                        )}

                        {/* Runner names */}
                        {runners.length > 0 && (
                          <div className="pl-2">
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-0.5">
                              Runners ({runners.length})
                            </p>
                            <p className="text-sm text-gray-800">{runners.join(', ')}</p>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        @media print {
          .print\\:hidden { display: none !important; }
          body { font-size: 11pt; }
          .print-content { padding: 0; }
          .break-inside-avoid { break-inside: avoid; }
        }
      `}</style>
    </div>
  )
}

// ── Helper Components ──────────────────────────────────────────────────────────

function WorkoutSection({ title, content }) {
  return (
    <div>
      <p className="font-medium text-gray-700 mb-1">{title}</p>
      <div className="bg-gray-50 rounded-lg p-3 text-gray-600 whitespace-pre-wrap">{content}</div>
    </div>
  )
}




