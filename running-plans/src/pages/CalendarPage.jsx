import { useRef, useState } from 'react'
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
import { format } from 'date-fns'
import { Link } from 'react-router-dom'

export default function CalendarPage() {
  const { docs: assignments } = useCollection('assignments', 'date')

  const [selected, setSelected] = useState(null)
  const [toast,    setToast]    = useState(null)
  const calendarRef = useRef(null)

  const events = assignments.map((a) => ({
    id:              a.id,
    title:           a.workoutTitle || 'Workout',
    date:            a.date,
    backgroundColor: getWorkoutCalendarColor(a.workoutType),
    borderColor:     getWorkoutCalendarColor(a.workoutType),
    extendedProps:   a,
  }))

  function handleEventClick(info) {
    setSelected(info.event.extendedProps)
  }

  async function handleDelete() {
    if (!selected) return
    try {
      await deleteDoc(doc(db, 'assignments', selected.id))
      setToast({ message: 'Assignment deleted.', type: 'info' })
      setSelected(null)
    } catch (err) {
      setToast({ message: err.message, type: 'error' })
    }
  }

  function copyLink() {
    const appUrl = import.meta.env.VITE_APP_URL || window.location.origin
    const link   = `${appUrl}/#/workout/${selected.id}`
    navigator.clipboard.writeText(link)
    setToast({ message: 'Share link copied!', type: 'success' })
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Master Calendar</h1>
          <p className="text-sm text-gray-500 mt-0.5">All scheduled workouts across your team.</p>
        </div>
        <Link to="/assign" className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          + Assign Workout
        </Link>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 mb-5">
        {[
          { color: '#22c55e', label: 'Easy Run' },
          { color: '#f97316', label: 'Tempo' },
          { color: '#ef4444', label: 'Interval' },
          { color: '#a855f7', label: 'Long Run' },
          { color: '#eab308', label: 'Race' },
          { color: '#14b8a6', label: 'Strength' },
          { color: '#3b82f6', label: 'Time Trial' },
          { color: '#9ca3af', label: 'Rest' },
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
          eventTimeFormat={{ hour: undefined }}
          displayEventTime={false}
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
              <p className="font-medium text-gray-700 mb-1">Assigned to</p>
              <p className="text-gray-600">
                {Array.isArray(selected.runnerNames) && selected.runnerNames.length > 0
                  ? selected.runnerNames.join(', ')
                  : selected.groupName || 'All runners'}
              </p>
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
                {selected.workoutData.warmup && <WorkoutSection title="Warm-Up"   content={selected.workoutData.warmup} />}
                {selected.workoutData.mainSet && <WorkoutSection title="Main Set"  content={selected.workoutData.mainSet} />}
                {selected.workoutData.cooldown && <WorkoutSection title="Cool-Down" content={selected.workoutData.cooldown} />}
                {selected.workoutData.targetPace && (
                  <p className="text-gray-500"><span className="font-medium">Target pace:</span> {selected.workoutData.targetPace}</p>
                )}
              </>
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
                Delete Assignment
              </button>
            </div>
          </div>
        )}
      </Modal>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}

function WorkoutSection({ title, content }) {
  return (
    <div>
      <p className="font-medium text-gray-700 mb-1">{title}</p>
      <div className="bg-gray-50 rounded-lg p-3 text-gray-600 whitespace-pre-wrap">{content}</div>
    </div>
  )
}
