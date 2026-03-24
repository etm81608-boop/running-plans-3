import { useEffect, useMemo, useState } from 'react'
import { format, parseISO, isPast, isToday } from 'date-fns'
import {
  collection, query, where, getDocs, addDoc, updateDoc, deleteDoc,
  doc, orderBy, writeBatch,
} from 'firebase/firestore'
import { db } from '../firebase/config'

// ── Seed data (written to Firestore on first load if collection is empty) ─────

const SEED_VARSITY = [
  { date: '2026-03-21', time: '10:00 AM', name: 'Upper Darby Relays',         opponents: [],                                                                              location: 'Upper Darby High School',                home: false, championship: false },
  { date: '2026-03-27', time: '',          name: 'Neshaminy Distance Festival', opponents: [],                                                                              location: 'Neshaminy High School',                  home: false, championship: false },
  { date: '2026-04-08', time: '',          name: 'Multi-Team Meet',             opponents: ['William Penn Charter School', 'Germantown Academy', 'The Agnes Irwin School'], location: 'William Penn Charter School',             home: false, championship: false },
  { date: '2026-04-10', time: '',          name: 'Haverford Distance Night',    opponents: [],                                                                              location: 'Haverford High School',                  home: false, championship: false },
  { date: '2026-04-11', time: '',          name: 'DELCO Relays',                opponents: [],                                                                              location: 'Marple Newtown High School',              home: false, championship: false },
  { date: '2026-04-11', time: '11:00 AM',  name: 'Brooks Fords Track Classic',  opponents: [],                                                                              location: 'Haverford High School',                  home: false, championship: false },
  { date: '2026-04-15', time: '',          name: 'Home Multi-Team Meet',        opponents: ['Academy of Notre Dame de Namur', 'Germantown Academy', 'The Baldwin School'], location: 'Greenwood Track',                        home: true,  championship: false },
  { date: '2026-04-18', time: '',          name: 'Kellerman Relays',            opponents: [],                                                                              location: 'Great Valley High School',               home: false, championship: false },
  { date: '2026-04-23', time: '',          name: 'Penn Relays — Day 1',         opponents: [],                                                                              location: 'Franklin Field, Philadelphia',            home: false, championship: false },
  { date: '2026-04-24', time: '',          name: 'Penn Relays — Day 2',         opponents: [],                                                                              location: 'Franklin Field, Philadelphia',            home: false, championship: false },
  { date: '2026-04-29', time: '',          name: 'Away Dual/Tri Meet',          opponents: ['Germantown Academy', 'The Baldwin School'],                                    location: 'Germantown Academy',                     home: false, championship: false },
  { date: '2026-04-30', time: '',          name: 'DELCO Champs — Day 1',        opponents: [],                                                                              location: 'Upper Darby High School',                home: false, championship: true  },
  { date: '2026-05-02', time: '',          name: 'DELCO Champs — Day 2',        opponents: [],                                                                              location: 'Rap Curry Athletic Complex (Penn Wood)',  home: false, championship: true  },
  { date: '2026-05-09', time: '',          name: 'Inter-Ac Track Champs',       opponents: [],                                                                              location: 'Greenwood Track',                        home: true,  championship: true  },
  { date: '2026-05-16', time: '',          name: 'PAISAA Championship',         opponents: [],                                                                              location: 'Malvern Preparatory School',             home: false, championship: true  },
]

const SEED_MS = [
  { date: '2026-04-02', time: '', name: 'EA @ Penn Charter',              opponents: ['Penn Charter'],                     location: 'William Penn Charter School',            home: false, championship: false },
  { date: '2026-04-08', time: '', name: 'Penn Relay Qualifier @ Penn Charter', opponents: [],                              location: 'William Penn Charter School',            home: false, championship: false },
  { date: '2026-04-13', time: '', name: "MP & St. Anne's @ EA",           opponents: ['Malvern Prep', "St. Anne's"],       location: 'Greenwood Track',                        home: true,  championship: false },
  { date: '2026-04-23', time: '', name: 'EA & Notre Dame @ GA',           opponents: ['Notre Dame', 'Germantown Academy'], location: 'Germantown Academy',                     home: false, championship: false },
  { date: '2026-04-24', time: '', name: 'Penn Relays',                    opponents: [],                                   location: 'Franklin Field, Philadelphia',            home: false, championship: false },
  { date: '2026-04-27', time: '', name: 'EA @ Springside Chestnut Hill',  opponents: ['Springside Chestnut Hill'],          location: 'Springside Chestnut Hill Academy',       home: false, championship: false },
  { date: '2026-04-30', time: '', name: 'Haverford School @ EA',          opponents: ['Haverford School'],                  location: 'Greenwood Track',                        home: true,  championship: false },
  { date: '2026-05-04', time: '', name: 'IAAL Championship',              opponents: [],                                   location: 'TBD',                                    home: false, championship: true  },
  { date: '2026-05-20', time: '', name: 'DELCO Champs',                   opponents: [],                                   location: 'Rap Curry Athletic Complex (Penn Wood)', home: false, championship: true  },
]

// ── Blank form ────────────────────────────────────────────────────────────────

const BLANK = {
  name: '', date: '', time: '', location: '',
  opponentsRaw: '', home: false, championship: false,
}

function meetToForm(m) {
  return {
    name: m.name,
    date: m.date,
    time: m.time || '',
    location: m.location,
    opponentsRaw: (m.opponents || []).join(', '),
    home: !!m.home,
    championship: !!m.championship,
  }
}

function formToDoc(f, type) {
  return {
    type,
    name: f.name.trim(),
    date: f.date,
    time: f.time.trim(),
    location: f.location.trim(),
    opponents: f.opponentsRaw.split(',').map((s) => s.trim()).filter(Boolean),
    home: f.home,
    championship: f.championship,
  }
}

// ── Modal ──────────────────────────────────────────────────────────────────────

function MeetModal({ initial, type, onSave, onClose }) {
  const [form, setForm] = useState(initial || BLANK)
  const [saving, setSaving] = useState(false)

  function set(key, val) { setForm((f) => ({ ...f, [key]: val })) }

  async function handleSave(e) {
    e.preventDefault()
    if (!form.name.trim() || !form.date) return
    setSaving(true)
    await onSave(formToDoc(form, type))
    setSaving(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="px-6 pt-5 pb-3 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">{initial ? 'Edit Meet' : 'Add Meet'}</h2>
        </div>
        <form onSubmit={handleSave} className="px-6 py-4 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Meet Name *</label>
            <input
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="e.g. Penn Relays"
              required
            />
          </div>

          {/* Date + Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Date *</label>
              <input
                type="date"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
                value={form.date}
                onChange={(e) => set('date', e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Time</label>
              <input
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
                value={form.time}
                onChange={(e) => set('time', e.target.value)}
                placeholder="e.g. 10:00 AM"
              />
            </div>
          </div>

          {/* Location */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Location</label>
            <input
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
              value={form.location}
              onChange={(e) => set('location', e.target.value)}
              placeholder="e.g. Greenwood Track"
            />
          </div>

          {/* Opponents */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Opponents <span className="font-normal text-gray-400">(comma-separated)</span></label>
            <input
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
              value={form.opponentsRaw}
              onChange={(e) => set('opponentsRaw', e.target.value)}
              placeholder="e.g. Germantown Academy, The Baldwin School"
            />
          </div>

          {/* Toggles */}
          <div className="flex gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="w-4 h-4 rounded text-brand-500"
                checked={form.home}
                onChange={(e) => set('home', e.target.checked)}
              />
              <span className="text-sm text-gray-700">Home meet</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="w-4 h-4 rounded text-amber-500"
                checked={form.championship}
                onChange={(e) => set('championship', e.target.checked)}
              />
              <span className="text-sm text-gray-700">Championship</span>
            </label>
          </div>

          {/* Buttons */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 text-sm rounded-lg bg-brand-500 text-white font-semibold hover:bg-brand-600 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function Meets() {
  const [meets, setMeets]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [modal, setModal]       = useState(null)   // null | { type, meet? }
  const [deleting, setDeleting] = useState(null)   // meet id being confirmed

  // ── Load / seed ────────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const snap = await getDocs(query(collection(db, 'meets'), orderBy('date')))
      if (!snap.empty) {
        setMeets(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
        setLoading(false)
        return
      }
      // First run — seed Firestore from hardcoded data
      const batch = writeBatch(db)
      ;[...SEED_VARSITY.map((m) => ({ ...m, type: 'varsity' })),
        ...SEED_MS.map((m) => ({ ...m, type: 'ms' }))].forEach((m) => {
        batch.set(doc(collection(db, 'meets')), m)
      })
      await batch.commit()
      const snap2 = await getDocs(query(collection(db, 'meets'), orderBy('date')))
      setMeets(snap2.docs.map((d) => ({ id: d.id, ...d.data() })))
      setLoading(false)
    }
    load()
  }, [])

  const varsity = useMemo(() => meets.filter((m) => m.type === 'varsity'), [meets])
  const ms      = useMemo(() => meets.filter((m) => m.type === 'ms'),      [meets])

  // ── CRUD ───────────────────────────────────────────────────────────────────
  async function handleSave(data, existingId) {
    if (existingId) {
      await updateDoc(doc(db, 'meets', existingId), data)
      setMeets((prev) => prev.map((m) => m.id === existingId ? { ...m, ...data } : m))
    } else {
      const ref = await addDoc(collection(db, 'meets'), data)
      setMeets((prev) => [...prev, { id: ref.id, ...data }].sort((a, b) => a.date.localeCompare(b.date)))
    }
  }

  async function handleDelete(id) {
    await deleteDoc(doc(db, 'meets', id))
    setMeets((prev) => prev.filter((m) => m.id !== id))
    setDeleting(null)
  }

  if (loading) {
    return (
      <div className="p-8 text-sm text-gray-400">Loading schedule…</div>
    )
  }

  return (
    <div className="p-8 max-w-6xl">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Meet Schedule</h1>
          <p className="text-sm text-gray-500 mt-0.5">Episcopal Academy · Spring 2026</p>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <MeetColumn
          title="Girls Varsity Track & Field"
          emoji="🏟️"
          accentClass="border-brand-400"
          meets={varsity}
          onAdd={() => setModal({ type: 'varsity' })}
          onEdit={(m) => setModal({ type: m.type, meet: m })}
          onDelete={(m) => setDeleting(m.id)}
        />
        <MeetColumn
          title="Middle School Track"
          emoji="🏃"
          accentClass="border-emerald-400"
          meets={ms}
          onAdd={() => setModal({ type: 'ms' })}
          onEdit={(m) => setModal({ type: m.type, meet: m })}
          onDelete={(m) => setDeleting(m.id)}
        />
      </div>

      {/* Add / Edit modal */}
      {modal && (
        <MeetModal
          initial={modal.meet ? meetToForm(modal.meet) : null}
          type={modal.type}
          onSave={(data) => handleSave(data, modal.meet?.id)}
          onClose={() => setModal(null)}
        />
      )}

      {/* Delete confirmation */}
      {deleting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h2 className="font-bold text-gray-900 mb-2">Delete this meet?</h2>
            <p className="text-sm text-gray-500 mb-5">This can't be undone.</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleting(null)}
                className="px-4 py-2 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleting)}
                className="px-4 py-2 text-sm rounded-lg bg-red-500 text-white font-semibold hover:bg-red-600"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Column ────────────────────────────────────────────────────────────────────

function MeetColumn({ title, emoji, accentClass, meets, onAdd, onEdit, onDelete }) {
  const [showPast, setShowPast] = useState(false)

  const upcoming = useMemo(
    () => meets.filter((m) => !isPast(parseISO(m.date + 'T23:59:59'))),
    [meets]
  )
  const past = useMemo(
    () => [...meets.filter((m) => isPast(parseISO(m.date + 'T23:59:59')))].reverse(),
    [meets]
  )
  const nextMeet = upcoming[0] || null

  return (
    <div>
      {/* Column header */}
      <div className={`flex items-center gap-2 mb-4 pb-2 border-b-2 ${accentClass}`}>
        <span className="text-base">{emoji}</span>
        <h2 className="text-base font-black text-gray-900">{title}</h2>
        <span className="ml-auto text-xs text-gray-400 font-medium">{upcoming.length} remaining</span>
        <button
          onClick={onAdd}
          className="ml-2 flex items-center gap-1 text-xs font-semibold text-brand-500 hover:text-brand-700 bg-brand-50 hover:bg-brand-100 px-2.5 py-1 rounded-full transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add
        </button>
      </div>

      {/* Next meet mini-banner */}
      {nextMeet && (
        <div className="mb-4 bg-brand-50 border border-brand-200 rounded-xl px-4 py-3">
          <p className="text-brand-400 text-xs font-semibold uppercase tracking-widest mb-0.5">Next Up</p>
          <p className="font-bold text-gray-900 text-sm leading-tight">{nextMeet.name}</p>
          <p className="text-xs text-gray-500 mt-1">
            📅 {format(parseISO(nextMeet.date + 'T12:00:00'), 'EEE, MMM d')}
            {nextMeet.time && <span> · 🕐 {nextMeet.time}</span>}
          </p>
          <p className="text-xs text-gray-500">📍 {nextMeet.location}</p>
        </div>
      )}

      {/* Upcoming meets */}
      {upcoming.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Upcoming</p>
          <div className="space-y-2">
            {upcoming.map((meet) => (
              <MeetRow key={meet.id} meet={meet} onEdit={() => onEdit(meet)} onDelete={() => onDelete(meet)} />
            ))}
          </div>
        </div>
      )}

      {/* Past meets (collapsible) */}
      {past.length > 0 && (
        <div>
          <button
            onClick={() => setShowPast((v) => !v)}
            className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 hover:text-gray-600 transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className={`h-3 w-3 transition-transform ${showPast ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
            Completed ({past.length})
          </button>
          {showPast && (
            <div className="space-y-2 opacity-60">
              {past.map((meet) => (
                <MeetRow key={meet.id} meet={meet} past onEdit={() => onEdit(meet)} onDelete={() => onDelete(meet)} />
              ))}
            </div>
          )}
        </div>
      )}

      {upcoming.length === 0 && past.length === 0 && (
        <p className="text-xs text-gray-400 italic">No meets scheduled.</p>
      )}
    </div>
  )
}

// ── Meet Row ──────────────────────────────────────────────────────────────────

function MeetRow({ meet, past = false, onEdit, onDelete }) {
  const d        = parseISO(meet.date + 'T12:00:00')
  const todayMeet = isToday(d)

  return (
    <div className={`group bg-white rounded-2xl border shadow-sm px-5 py-4 flex items-start gap-4 ${
      todayMeet ? 'border-brand-400 ring-2 ring-brand-200' : 'border-gray-100'
    }`}>

      {/* Date tile */}
      <div className={`flex-shrink-0 w-14 text-center rounded-xl py-2 ${
        past ? 'bg-gray-100' : meet.championship ? 'bg-amber-50' : 'bg-brand-50'
      }`}>
        <p className={`text-xs font-semibold uppercase ${past ? 'text-gray-400' : 'text-brand-500'}`}>
          {format(d, 'MMM')}
        </p>
        <p className={`text-2xl font-black leading-none ${past ? 'text-gray-400' : 'text-brand-700'}`}>
          {format(d, 'd')}
        </p>
        <p className={`text-xs ${past ? 'text-gray-400' : 'text-brand-400'}`}>
          {format(d, 'EEE')}
        </p>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-0.5">
          <p className={`font-bold text-base ${past ? 'text-gray-500' : 'text-gray-900'}`}>
            {meet.name}
          </p>
          {meet.championship && (
            <span className="text-xs bg-amber-100 text-amber-700 font-bold px-2 py-0.5 rounded-full">🏆 Championship</span>
          )}
          {todayMeet && (
            <span className="text-xs bg-brand-600 text-white font-bold px-2 py-0.5 rounded-full animate-pulse">TODAY</span>
          )}
        </div>
        {meet.opponents?.length > 0 && (
          <p className="text-xs text-gray-500 mb-1">vs. {meet.opponents.join(' · ')}</p>
        )}
        <div className="flex flex-wrap gap-3 text-xs text-gray-500 mt-1">
          {meet.location && <span>📍 {meet.location}</span>}
          {meet.time && <span>🕐 {meet.time}</span>}
        </div>
      </div>

      {/* Home/Away + edit controls */}
      <div className="flex-shrink-0 flex flex-col items-end gap-2">
        {meet.home ? (
          <span className="text-xs bg-emerald-100 text-emerald-700 font-semibold px-3 py-1 rounded-full">🏠 Home</span>
        ) : (
          <span className="text-xs bg-orange-50 text-orange-600 font-semibold px-3 py-1 rounded-full">✈️ Away</span>
        )}
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onEdit}
            className="text-xs text-gray-400 hover:text-brand-500 px-2 py-0.5 rounded hover:bg-brand-50 transition-colors"
          >
            Edit
          </button>
          <button
            onClick={onDelete}
            className="text-xs text-gray-400 hover:text-red-500 px-2 py-0.5 rounded hover:bg-red-50 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}
