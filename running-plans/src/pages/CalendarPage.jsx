import { useMemo, useState, useRef } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin      from '@fullcalendar/daygrid'
import listPlugin         from '@fullcalendar/list'
import interactionPlugin  from '@fullcalendar/interaction'
import {
  collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp,
} from 'firebase/firestore'
import { db } from '../firebase/config'
import { useCollection } from '../hooks/useCollection'
import Modal from '../components/Modal'
import Toast from '../components/Toast'
import { format } from 'date-fns'

// Turn "Ava Thompson" → "AT"
function getInitials(name = '') {
  return name.trim().split(/\s+/).map((w) => w[0]?.toUpperCase() ?? '').join('')
}

// ── Meet data (shown as calendar events) ─────────────────────────────────────

const ALL_MEETS = [
  // Varsity
  { id: 'v1',  date: '2026-03-21', name: 'Upper Darby Relays',            location: 'Upper Darby High School',            home: false, level: 'Varsity' },
  { id: 'v2',  date: '2026-03-27', name: 'Neshaminy Distance Festival',    location: 'Neshaminy High School',              home: false, level: 'Varsity' },
  { id: 'v3',  date: '2026-04-08', name: 'Multi-Team Meet',                location: 'William Penn Charter School',        home: false, level: 'Varsity' },
  { id: 'v4',  date: '2026-04-10', name: 'Haverford Distance Night',       location: 'Haverford High School',              home: false, level: 'Varsity' },
  { id: 'v5',  date: '2026-04-11', name: 'DELCO Relays',                   location: 'Marple Newtown High School',         home: false, level: 'Varsity' },
  { id: 'v6',  date: '2026-04-11', name: 'Brooks Fords Track Classic',     location: 'Haverford High School',              home: false, level: 'Varsity' },
  { id: 'v7',  date: '2026-04-15', name: 'Home Multi-Team Meet',           location: 'Greenwood Track',                    home: true,  level: 'Varsity' },
  { id: 'v8',  date: '2026-04-18', name: 'Kellerman Relays',               location: 'Great Valley High School',           home: false, level: 'Varsity' },
  { id: 'v9',  date: '2026-04-23', name: 'Penn Relays — Day 1',            location: 'Franklin Field, Philadelphia',        home: false, level: 'Varsity' },
  { id: 'v10', date: '2026-04-24', name: 'Penn Relays — Day 2',            location: 'Franklin Field, Philadelphia',        home: false, level: 'Varsity' },
  { id: 'v11', date: '2026-04-29', name: 'Away Dual/Tri Meet',             location: 'Germantown Academy',                 home: false, level: 'Varsity' },
  { id: 'v12', date: '2026-04-30', name: 'DELCO Champs — Day 1',           location: 'Upper Darby High School',            home: false, level: 'Varsity', championship: true },
  { id: 'v13', date: '2026-05-02', name: 'DELCO Champs — Day 2',           location: 'Rap Curry Athletic Complex',         home: false, level: 'Varsity', championship: true },
  { id: 'v14', date: '2026-05-09', name: 'Inter-Ac Track Champs',          location: 'Greenwood Track',                    home: true,  level: 'Varsity', championship: true },
  { id: 'v15', date: '2026-05-16', name: 'PAISAA Championship',            location: 'Malvern Preparatory School',         home: false, level: 'Varsity', championship: true },
  // Middle School
  { id: 'm1',  date: '2026-04-02', name: 'EA @ Penn Charter',              location: 'William Penn Charter School',        home: false, level: 'MS' },
  { id: 'm2',  date: '2026-04-08', name: 'Penn Relay Qualifier',           location: 'William Penn Charter School',        home: false, level: 'MS' },
  { id: 'm3',  date: '2026-04-13', name: 'MP & St. Anne\'s @ EA',          location: 'Greenwood Track',                    home: true,  level: 'MS' },
  { id: 'm4',  date: '2026-04-23', name: 'EA & Notre Dame @ GA',           location: 'Germantown Academy',                 home: false, level: 'MS' },
  { id: 'm5',  date: '2026-04-24', name: 'Penn Relays',                    location: 'Franklin Field, Philadelphia',        home: false, level: 'MS' },
  { id: 'm6',  date: '2026-04-27', name: 'EA @ Springside Chestnut Hill',  location: 'Springside Chestnut Hill Academy',   home: false, level: 'MS' },
  { id: 'm7',  date: '2026-04-30', name: 'Haverford School @ EA',          location: 'Greenwood Track',                    home: true,  level: 'MS' },
  { id: 'm8',  date: '2026-05-04', name: 'IAAL Championship',              location: 'TBD',                                home: false, level: 'MS',      championship: true },
  { id: 'm9',  date: '2026-05-20', name: 'DELCO Champs',                   location: 'Rap Curry Athletic Complex',         home: false, level: 'MS',      championship: true },
]

// Palette — each runner gets a consistent color
const PALETTE = [
  '#4f46e5','#10b981','#f97316','#ef4444','#a855f7',
  '#0ea5e9','#f59e0b','#14b8a6','#ec4899','#84cc16',
  '#6366f1','#e11d48','#0891b2','#7c3aed','#16a34a',
]

const EMPTY_FORM = {
  runnerId: '', date: '',
  warmup: '', mainWorkout: '', cooldown: '', crossTraining: '', notes: '',
  visibilityGroup: '',
}

const VG_OPTIONS = [
  { value: '',  label: 'Off — private' },
  { value: '1', label: 'Group 1' },
  { value: '2', label: 'Group 2' },
  { value: '3', label: 'Group 3' },
  { value: '4', label: 'Group 4' },
  { value: '5', label: 'Group 5' },
]

export default function CalendarPage() {
  const { docs: assignments } = useCollection('assignments', 'date')
  const { docs: runners }     = useCollection('runners',     'name')
  const { docs: templates }   = useCollection('workouts',    'createdAt')

  const [modalOpen,        setModalOpen]        = useState(false)
  const [isEditing,        setIsEditing]        = useState(false)
  const [currentId,        setCurrentId]        = useState(null)
  const [form,             setForm]             = useState(EMPTY_FORM)
  const [toast,            setToast]            = useState(null)
  const [saving,           setSaving]           = useState(false)
  const [shareLink,        setShareLink]        = useState('')
  const [showShareLink,    setShowShareLink]    = useState(false)
  const [confirmDelete,    setConfirmDelete]    = useState(false)
  const [showHistory,      setShowHistory]      = useState(false)
  const [hoveredDate,      setHoveredDate]      = useState(null)
  const [popoverPos,       setPopoverPos]       = useState({ x: 0, y: 0 })
  const hideTimer = useRef(null)

  // Print schedule state
  const [printModal,  setPrintModal]  = useState(false)
  const [printStart,  setPrintStart]  = useState('')
  const [printEnd,    setPrintEnd]    = useState('')

  // Assign each runner a consistent color
  const runnerColorMap = useMemo(() => {
    const map = {}
    runners.forEach((r, i) => { map[r.id] = PALETTE[i % PALETTE.length] })
    return map
  }, [runners])

  // FullCalendar events — workout assignments + meets
  const [meetModal, setMeetModal] = useState(null) // holds the meet object when clicked

  const workoutEvents = assignments.map((a) => ({
    id:              a.id,
    title:           getInitials(a.runnerName) || '?',
    date:            a.date,
    backgroundColor: runnerColorMap[a.runnerId] || '#4f46e5',
    borderColor:     runnerColorMap[a.runnerId] || '#4f46e5',
    extendedProps:   { ...a, id: a.id, _type: 'workout' },
  }))

  const meetEvents = ALL_MEETS.map((m) => ({
    id:              m.id,
    title:           `${m.level === 'MS' ? '🏃 MS' : '🏟️'} ${m.name}`,
    date:            m.date,
    backgroundColor: m.championship ? '#b45309' : '#be123c',
    borderColor:     m.championship ? '#92400e' : '#9f1239',
    textColor:       '#ffffff',
    extendedProps:   { ...m, _type: 'meet' },
    display:         'block',
  }))

  const events = [...workoutEvents, ...meetEvents]

  // Group assignments by date for the hover popover
  const assignmentsByDate = useMemo(() => {
    const map = {}
    assignments.forEach((a) => {
      if (!a.date) return
      if (!map[a.date]) map[a.date] = []
      map[a.date].push(a)
    })
    return map
  }, [assignments])

  // dayCellDidMount — attach hover listeners to every day cell
  function handleDayCellMount(arg) {
    const dateStr = arg.date.toISOString().split('T')[0]
    arg.el.addEventListener('mouseenter', () => {
      clearTimeout(hideTimer.current)
      const rect = arg.el.getBoundingClientRect()
      // Position popover to the right, or left if too close to the edge
      const x = rect.right + 8 + 280 > window.innerWidth
        ? rect.left - 288
        : rect.right + 8
      setPopoverPos({ x, y: rect.top })
      setHoveredDate(dateStr)
    })
    arg.el.addEventListener('mouseleave', () => {
      hideTimer.current = setTimeout(() => setHoveredDate(null), 200)
    })
  }

  // Click empty date → new workout
  function handleDateClick(info) {
    setForm({ ...EMPTY_FORM, date: info.dateStr })
    setIsEditing(false)
    setCurrentId(null)
    setShowShareLink(false)
    setConfirmDelete(false)
    setModalOpen(true)
  }

  // Click existing event → edit workout or show meet detail
  function handleEventClick(info) {
    const a = info.event.extendedProps
    if (a._type === 'meet') {
      setMeetModal(a)
      return
    }
    setForm({
      runnerId:        a.runnerId        || '',
      date:            a.date            || '',
      warmup:          a.warmup          || '',
      mainWorkout:     a.mainWorkout     || '',
      cooldown:        a.cooldown        || '',
      crossTraining:   a.crossTraining   || '',
      notes:           a.notes           || '',
      visibilityGroup: a.visibilityGroup ? String(a.visibilityGroup) : '',
    })
    setCurrentId(a.id)
    setIsEditing(true)
    setShowShareLink(false)
    setConfirmDelete(false)
    // Pre-compute share link for this existing assignment
    const appUrl = import.meta.env.VITE_APP_URL || window.location.origin
    setShareLink(`${appUrl}/#/workout/${a.id}`)
    setModalOpen(true)
  }

  function set(field, val) {
    setForm((f) => ({ ...f, [field]: val }))
  }

  // Load a saved template into the form
  function loadTemplate(templateId) {
    if (!templateId) return
    const t = templates.find((x) => x.id === templateId)
    if (t) {
      setForm((f) => ({
        ...f,
        warmup:        t.warmup        || '',
        mainWorkout:   t.mainWorkout   || t.mainSet || '',
        cooldown:      t.cooldown      || '',
        crossTraining: t.crossTraining || '',
      }))
    }
  }

  async function handleSave() {
    if (!form.runnerId || !form.date) return
    setSaving(true)
    const runner = runners.find((r) => r.id === form.runnerId)

    const data = {
      runnerId:        form.runnerId,
      runnerName:      runner?.name || '',
      date:            form.date,
      warmup:          form.warmup.trim(),
      mainWorkout:     form.mainWorkout.trim(),
      cooldown:        form.cooldown.trim(),
      crossTraining:   form.crossTraining.trim(),
      notes:           form.notes.trim(),
      // Keep for share-link / public page compatibility
      workoutTitle:    form.mainWorkout.trim().slice(0, 60) || 'Workout',
      runnerIds:       [form.runnerId],
      runnerNames:     [runner?.name || ''],
      // Visibility group — determines which peers can see this workout
      visibilityGroup: form.visibilityGroup ? parseInt(form.visibilityGroup, 10) : null,
    }

    try {
      if (isEditing && currentId) {
        await updateDoc(doc(db, 'assignments', currentId), data)
        setToast({ message: 'Workout updated!', type: 'success' })
        setModalOpen(false)
      } else {
        const docRef = await addDoc(collection(db, 'assignments'), {
          ...data, createdAt: serverTimestamp(),
        })
        const appUrl = import.meta.env.VITE_APP_URL || window.location.origin
        setShareLink(`${appUrl}/#/workout/${docRef.id}`)
        setShowShareLink(true)
        setToast({ message: 'Workout saved!', type: 'success' })
        setModalOpen(false)
      }
    } catch (err) {
      setToast({ message: err.message, type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!currentId) return
    try {
      await deleteDoc(doc(db, 'assignments', currentId))
      setToast({ message: 'Workout removed.', type: 'info' })
      setModalOpen(false)
      setConfirmDelete(false)
    } catch (err) {
      setToast({ message: err.message, type: 'error' })
    }
  }

  function copyLink() {
    navigator.clipboard.writeText(shareLink)
    setToast({ message: 'Link copied!', type: 'success' })
  }

  function generatePrint() {
    if (!printStart || !printEnd || printStart > printEnd) return

    // Build list of every date in range
    const dates = []
    let cur = new Date(printStart + 'T12:00:00')
    const end = new Date(printEnd   + 'T12:00:00')
    while (cur <= end) {
      dates.push(cur.toISOString().split('T')[0])
      cur = new Date(cur.getTime() + 86400000)
    }

    // Filter assignments to the range
    const rangeAssignments = assignments.filter(
      (a) => a.date >= printStart && a.date <= printEnd
    )

    // Build lookup: runnerId → date → assignment
    const lookup = {}
    rangeAssignments.forEach((a) => {
      if (!lookup[a.runnerId]) lookup[a.runnerId] = {}
      lookup[a.runnerId][a.date] = a
    })

    // Unique runners who appear in this range, sorted by name
    const runnerIds = [...new Set(rangeAssignments.map((a) => a.runnerId))]
    const printRunners = runners
      .filter((r) => runnerIds.includes(r.id))
      .sort((a, b) => a.name.localeCompare(b.name))

    const dateHeaders = dates.map((d) =>
      `<th>${format(new Date(d + 'T12:00:00'), 'EEE')}<br/><span style="font-weight:400">${format(new Date(d + 'T12:00:00'), 'M/d')}</span></th>`
    ).join('')

    const rows = printRunners.map((r) => {
      const cells = dates.map((d) => {
        const a = lookup[r.id]?.[d]
        if (!a) return '<td style="color:#ccc;text-align:center;vertical-align:middle;">—</td>'
        const parts = []
        if (a.warmup)        parts.push(`<div><b style="color:#166534">WU:</b> ${a.warmup}</div>`)
        if (a.mainWorkout)   parts.push(`<div><b style="color:#3730a3">Main:</b> ${a.mainWorkout}</div>`)
        if (a.cooldown)      parts.push(`<div><b style="color:#1e40af">CD:</b> ${a.cooldown}</div>`)
        if (a.crossTraining) parts.push(`<div><b style="color:#115e59">XT:</b> ${a.crossTraining}</div>`)
        if (a.notes)         parts.push(`<div style="color:#92400e;font-style:italic">${a.notes}</div>`)
        return `<td style="vertical-align:top">${parts.join('')}</td>`
      }).join('')
      return `<tr><td style="font-weight:700;white-space:nowrap;background:#f5f5f5;padding:6px 10px">${r.name}</td>${cells}</tr>`
    }).join('')

    const html = `<!DOCTYPE html><html><head><title>Team Workout Schedule</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 9px; margin: 0; padding: 16px; }
  h1  { font-size: 15px; margin: 0 0 2px; color: #1e1b4b; }
  .sub { font-size: 11px; color: #6b7280; margin-bottom: 14px; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  th { background: #3730a3; color: white; padding: 7px 5px; text-align: center;
       font-size: 9px; border: 1px solid #c7d2fe; line-height: 1.3; }
  th.name-col { text-align: left; width: 110px; }
  td { padding: 5px; border: 1px solid #e5e7eb; font-size: 8.5px; line-height: 1.5; }
  div { margin-bottom: 2px; }
  @page { size: landscape; margin: 1cm; }
  @media print { body { padding: 0; } }
</style></head><body>
<h1>Team Workout Schedule</h1>
<p class="sub">${format(new Date(printStart + 'T12:00:00'), 'MMMM d')} – ${format(new Date(printEnd + 'T12:00:00'), 'MMMM d, yyyy')}</p>
<table>
  <thead><tr><th class="name-col">Runner</th>${dateHeaders}</tr></thead>
  <tbody>${rows}</tbody>
</table>
</body></html>`

    const win = window.open('', '_blank')
    win.document.write(html)
    win.document.close()
    win.focus()
    setTimeout(() => win.print(), 600)
    setPrintModal(false)
  }

  const selectedRunner = runners.find((r) => r.id === form.runnerId)
  const dateLabel = form.date
    ? format(new Date(form.date + 'T12:00:00'), 'EEEE, MMMM d, yyyy')
    : ''

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Master Calendar</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Click any date to add a workout. Click an existing workout to edit it.
          </p>
        </div>
        <button
          onClick={() => setPrintModal(true)}
          className="flex items-center gap-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          Print Schedule
        </button>
      </div>

      {/* Runner color legend */}
      {runners.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 mb-5">
          {runners.map((r) => (
            <span key={r.id} className="flex items-center gap-1.5 text-xs text-gray-600">
              <span
                className="w-3 h-3 rounded-full inline-block flex-shrink-0"
                style={{ backgroundColor: runnerColorMap[r.id] }}
              />
              {r.name}
            </span>
          ))}
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <FullCalendar
          plugins={[dayGridPlugin, listPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          headerToolbar={{
            left:   'prev,next today',
            center: 'title',
            right:  'dayGridMonth,listMonth',
          }}
          buttonText={{ listMonth: 'List' }}
          events={events}
          dateClick={handleDateClick}
          eventClick={handleEventClick}
          dayCellDidMount={handleDayCellMount}
          height="auto"
          displayEventTime={false}
          eventDisplay="block"
        />
      </div>

      {/* Share link banner (after saving new workout) */}
      {showShareLink && shareLink && (
        <div className="mt-4 bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3">
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-700 mb-1">Shareable link for last workout:</p>
            <p className="text-xs font-mono text-gray-500 truncate">{shareLink}</p>
          </div>
          <button
            onClick={copyLink}
            className="bg-brand-600 hover:bg-brand-700 text-white px-3 py-2 rounded-lg text-xs font-medium flex-shrink-0"
          >
            Copy Link
          </button>
          <button onClick={() => setShowShareLink(false)} className="text-gray-400 hover:text-gray-600 text-xs">✕</button>
        </div>
      )}

      {/* Day hover popover */}
      {hoveredDate && assignmentsByDate[hoveredDate]?.length > 0 && (
        <div
          style={{ position: 'fixed', left: popoverPos.x, top: popoverPos.y, zIndex: 9999, width: 280 }}
          className="bg-white rounded-2xl shadow-2xl border border-gray-200 p-4"
          onMouseEnter={() => clearTimeout(hideTimer.current)}
          onMouseLeave={() => setHoveredDate(null)}
        >
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">
            {format(new Date(hoveredDate + 'T12:00:00'), 'EEEE, MMMM d')}
          </p>
          <div className="space-y-3">
            {assignmentsByDate[hoveredDate].map((a) => (
              <div key={a.id} className="flex items-start gap-2.5">
                <div
                  className="w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0"
                  style={{ backgroundColor: runnerColorMap[a.runnerId] || '#4f46e5' }}
                />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{a.runnerName}</p>
                  {(a.mainWorkout || a.workoutTitle) && (
                    <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">
                      ⚡ {a.mainWorkout || a.workoutTitle}
                    </p>
                  )}
                  {a.warmup && (
                    <p className="text-xs text-gray-400 line-clamp-1">🔥 {a.warmup}</p>
                  )}
                  {a.cooldown && (
                    <p className="text-xs text-gray-400 line-clamp-1">❄️ {a.cooldown}</p>
                  )}
                  {a.crossTraining && (
                    <p className="text-xs text-gray-400 line-clamp-1">💪 {a.crossTraining}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-brand-500 mt-3 font-medium">Click a workout to edit it</p>
        </div>
      )}

      {/* Create / Edit Workout Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setConfirmDelete(false) }}
        title={isEditing ? `Edit Workout — ${selectedRunner?.name || ''}` : 'New Workout'}
        size="xl"
      >
        {/* Two-column layout: form on left, history on right */}
        <div className="flex gap-6">

          {/* ── LEFT: Workout form ── */}
          <div className="flex-1 min-w-0 space-y-4">

            {/* Runner selector */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Runner <span className="text-red-400">*</span>
              </label>
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                value={form.runnerId}
                onChange={(e) => {
                  const r = runners.find((r) => r.id === e.target.value)
                  setForm((f) => ({
                    ...f,
                    runnerId: e.target.value,
                    visibilityGroup: f.visibilityGroup || (r?.visibilityGroup ? String(r.visibilityGroup) : ''),
                  }))
                }}
              >
                <option value="">— select a runner —</option>
                {runners.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}{r.group ? ` (${r.group})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Date */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Date <span className="text-red-400">*</span>
              </label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => set('date', e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
              />
              {dateLabel && <p className="text-xs text-gray-400 mt-1">{dateLabel}</p>}
            </div>

            {/* Load from template */}
            {templates.length > 0 && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Load template <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <select
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                  onChange={(e) => loadTemplate(e.target.value)}
                  defaultValue=""
                >
                  <option value="">— choose a template —</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>{t.name || t.title}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Visibility group */}
            <div className="flex items-center gap-3">
              <label className="text-sm font-semibold text-gray-700 whitespace-nowrap">
                👥 Visibility
              </label>
              <select
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                value={form.visibilityGroup}
                onChange={(e) => set('visibilityGroup', e.target.value)}
              >
                {VG_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <span className="text-xs text-gray-400">Runners in the same group can see each other's workouts</span>
            </div>

            <div className="border-t border-gray-100 pt-1" />

            {/* Warm-Up */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">🔥 Warm-Up</label>
              <textarea rows={2}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
                placeholder="e.g. 10 min easy jog, drills, strides"
                value={form.warmup} onChange={(e) => set('warmup', e.target.value)} />
            </div>

            {/* Main Workout */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">⚡ Main Workout</label>
              <textarea rows={4}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
                placeholder="e.g. 6 × 800m at 5K pace, 2 min rest"
                value={form.mainWorkout} onChange={(e) => set('mainWorkout', e.target.value)} />
            </div>

            {/* Cool-Down */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">❄️ Cool-Down</label>
              <textarea rows={2}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
                placeholder="e.g. 10 min easy, stretching"
                value={form.cooldown} onChange={(e) => set('cooldown', e.target.value)} />
            </div>

            {/* Cross Training */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">💪 Cross Training</label>
              <textarea rows={2}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
                placeholder="e.g. Core circuit, hip strength"
                value={form.crossTraining} onChange={(e) => set('crossTraining', e.target.value)} />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Coach Notes <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <textarea rows={2}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
                placeholder="Any notes for this athlete on this day…"
                value={form.notes} onChange={(e) => set('notes', e.target.value)} />
            </div>
          </div>

          {/* ── RIGHT: Runner history ── */}
          <div className="w-64 flex-shrink-0 border-l border-gray-100 pl-5">
            <p className="text-sm font-semibold text-gray-700 mb-3 sticky top-0 bg-white pt-1">
              {selectedRunner ? `${selectedRunner.name}'s recent workouts` : 'Select a runner to see history'}
            </p>
            {!form.runnerId ? (
              <p className="text-xs text-gray-400 italic">Past workouts will appear here once you select a runner.</p>
            ) : (
              <RunnerHistory
                runnerId={form.runnerId}
                currentDate={form.date}
                assignments={assignments}
              />
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 flex items-center justify-between gap-3 flex-wrap">
          {/* Delete (edit mode only) */}
          {isEditing && (
            <div>
              {!confirmDelete ? (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="text-sm text-red-500 hover:text-red-700 font-medium"
                >
                  Delete workout
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-red-600 font-medium">Are you sure?</span>
                  <button onClick={handleDelete} className="text-sm bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded-lg font-medium">Yes, delete</button>
                  <button onClick={() => setConfirmDelete(false)} className="text-sm text-gray-500 hover:text-gray-700">Cancel</button>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3 ml-auto">
            {/* Copy link — shows for existing workouts */}
            {isEditing && shareLink && (
              <button
                onClick={copyLink}
                title={shareLink}
                className="flex items-center gap-1.5 border border-gray-200 text-gray-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                Copy Link
              </button>
            )}
            <button
              onClick={() => { setModalOpen(false); setConfirmDelete(false) }}
              className="border border-gray-200 text-gray-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !form.runnerId || !form.date}
              className="bg-brand-600 hover:bg-brand-700 text-white px-5 py-2 rounded-lg text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving…' : isEditing ? 'Save Changes' : 'Save Workout'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Print Schedule Modal */}
      <Modal isOpen={printModal} onClose={() => setPrintModal(false)} title="Print Workout Schedule" size="sm">
        <p className="text-sm text-gray-500 mb-4">
          Choose a date range. A printable table will open in a new tab with every runner's workouts across the selected days. Use your browser's <strong>Save as PDF</strong> option in the print dialog.
        </p>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Start Date</label>
            <input
              type="date"
              value={printStart}
              onChange={(e) => setPrintStart(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">End Date</label>
            <input
              type="date"
              value={printEnd}
              min={printStart}
              onChange={(e) => setPrintEnd(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={() => setPrintModal(false)}
            className="border border-gray-200 text-gray-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={generatePrint}
            disabled={!printStart || !printEnd || printStart > printEnd}
            className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Generate &amp; Print
          </button>
        </div>
      </Modal>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Meet detail modal */}
      {meetModal && (
        <Modal
          isOpen={!!meetModal}
          onClose={() => setMeetModal(null)}
          title={meetModal.championship ? `🏆 ${meetModal.name}` : `🏟️ ${meetModal.name}`}
          size="sm"
        >
          <div className="space-y-3 text-sm">
            <div className="flex gap-2 flex-wrap">
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                meetModal.level === 'MS' ? 'bg-purple-100 text-purple-700' : 'bg-red-100 text-red-700'
              }`}>
                {meetModal.level === 'MS' ? '🏃 Middle School' : '🏟️ Girls Varsity'}
              </span>
              {meetModal.championship && (
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700">🏆 Championship</span>
              )}
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                meetModal.home ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'
              }`}>
                {meetModal.home ? '🏠 Home' : '✈️ Away'}
              </span>
            </div>
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-0.5">Date</p>
              <p className="text-gray-800 font-medium">{format(new Date(meetModal.date + 'T12:00:00'), 'EEEE, MMMM d, yyyy')}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-0.5">Location</p>
              <p className="text-gray-800">{meetModal.location}</p>
            </div>
          </div>
          <div className="mt-5 flex justify-end">
            <button
              onClick={() => setMeetModal(null)}
              className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-semibold"
            >
              Close
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ── Runner History Panel ──────────────────────────────────────────────────────
function RunnerHistory({ runnerId, currentDate, assignments }) {
  // Get all past workouts for this runner, sorted newest first
  const history = useMemo(() => {
    return assignments
      .filter((a) => {
        if (a.runnerId !== runnerId) return false
        if (!a.date) return false
        // Only show workouts before (or on the same day as) the current date
        if (currentDate && a.date > currentDate) return false
        return true
      })
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .slice(0, 12) // show up to 12 recent workouts
  }, [assignments, runnerId, currentDate])

  if (history.length === 0) {
    return (
      <p className="text-xs text-gray-400 italic">No previous workouts found for this runner.</p>
    )
  }

  return (
    <div className="space-y-3 overflow-y-auto max-h-[480px] pr-1">
      {history.map((a) => (
        <div key={a.id} className="border border-gray-100 rounded-xl p-3 bg-gray-50">
          <p className="text-xs font-bold text-brand-700 mb-1">
            {a.date ? format(new Date(a.date + 'T12:00:00'), 'EEE, MMM d') : ''}
          </p>
          {(a.mainWorkout || a.workoutTitle) && (
            <p className="text-xs font-semibold text-gray-800 mb-1 line-clamp-2">
              ⚡ {a.mainWorkout || a.workoutTitle}
            </p>
          )}
          {a.warmup && (
            <p className="text-xs text-gray-500 line-clamp-1">🔥 {a.warmup}</p>
          )}
          {a.cooldown && (
            <p className="text-xs text-gray-500 line-clamp-1">❄️ {a.cooldown}</p>
          )}
          {a.crossTraining && (
            <p className="text-xs text-gray-500 line-clamp-1">💪 {a.crossTraining}</p>
          )}
          {a.notes && (
            <p className="text-xs text-gray-400 italic mt-1 line-clamp-1">📝 {a.notes}</p>
          )}
        </div>
      ))}
    </div>
  )
}



