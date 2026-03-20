import { useState } from 'react'
import {
  collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp,
} from 'firebase/firestore'
import { db } from '../firebase/config'
import { useCollection } from '../hooks/useCollection'
import Modal from '../components/Modal'
import Toast from '../components/Toast'
import { EVENTS, GRADES } from '../utils/constants'

const EMPTY_RUNNER = {
  name: '', grade: '', email: '', phone: '',
  primaryEvent: '', group: '', yearsRunning: '',
  prs: {},
}

const PR_EVENTS = [
  '100m','200m','400m','800m','1500m','1 Mile','3000m','5K','2 Mile',
  '100m Hurdles','400m Hurdles','Cross Country 5K',
]

export default function Roster() {
  const { docs: runners } = useCollection('runners', 'name')
  const { docs: groups }  = useCollection('groups', 'name')

  const [modal,   setModal]   = useState(null) // 'add'|'edit'|'view'|'delete'
  const [current, setCurrent] = useState(EMPTY_RUNNER)
  const [toast,   setToast]   = useState(null)
  const [search,  setSearch]  = useState('')
  const [prEvent, setPrEvent] = useState(PR_EVENTS[0])
  const [prTime,  setPrTime]  = useState('')

  function openAdd()       { setCurrent(EMPTY_RUNNER); setModal('add')  }
  function openEdit(r)     { setCurrent(r);             setModal('edit') }
  function openView(r)     { setCurrent(r);             setModal('view') }
  function openDelete(r)   { setCurrent(r);             setModal('delete') }
  function close()         { setModal(null)  }

  function set(field, val) {
    setCurrent((c) => ({ ...c, [field]: val }))
  }

  function addPR() {
    if (!prTime.trim()) return
    setCurrent((c) => ({ ...c, prs: { ...c.prs, [prEvent]: prTime.trim() } }))
    setPrTime('')
  }

  function removePR(event) {
    setCurrent((c) => {
      const prs = { ...c.prs }
      delete prs[event]
      return { ...c, prs }
    })
  }

  async function save() {
    const data = {
      name:         current.name.trim(),
      grade:        current.grade,
      email:        current.email.trim(),
      phone:        current.phone.trim(),
      primaryEvent: current.primaryEvent,
      group:        current.group,
      yearsRunning: current.yearsRunning,
      prs:          current.prs || {},
    }
    if (!data.name) return

    try {
      if (modal === 'add') {
        await addDoc(collection(db, 'runners'), { ...data, createdAt: serverTimestamp() })
        setToast({ message: 'Runner added!', type: 'success' })
      } else {
        await updateDoc(doc(db, 'runners', current.id), data)
        setToast({ message: 'Runner updated!', type: 'success' })
      }
      close()
    } catch (err) {
      setToast({ message: 'Error saving runner: ' + err.message, type: 'error' })
    }
  }

  async function confirmDelete() {
    try {
      await deleteDoc(doc(db, 'runners', current.id))
      setToast({ message: 'Runner removed.', type: 'info' })
      close()
    } catch (err) {
      setToast({ message: 'Error: ' + err.message, type: 'error' })
    }
  }

  const filtered = runners.filter((r) =>
    r.name?.toLowerCase().includes(search.toLowerCase()) ||
    r.group?.toLowerCase().includes(search.toLowerCase()) ||
    r.primaryEvent?.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Roster</h1>
          <p className="text-sm text-gray-500 mt-0.5">{runners.length} runner{runners.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={openAdd} className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          + Add Runner
        </button>
      </div>

      {/* Search */}
      <div className="mb-5">
        <input
          type="text"
          placeholder="Search by name, group, or event…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:w-80 border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 text-center text-gray-400 text-sm">
            {runners.length === 0 ? 'No runners yet. Click "Add Runner" to get started.' : 'No runners match your search.'}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3 text-left">Name</th>
                <th className="px-5 py-3 text-left">Grade</th>
                <th className="px-5 py-3 text-left">Primary Event</th>
                <th className="px-5 py-3 text-left">Group</th>
                <th className="px-5 py-3 text-left">Yrs Running</th>
                <th className="px-5 py-3 text-left">Email</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3 font-medium text-gray-900">
                    <button onClick={() => openView(r)} className="hover:text-brand-600 hover:underline text-left">
                      {r.name}
                    </button>
                  </td>
                  <td className="px-5 py-3 text-gray-600">{r.grade ? `Grade ${r.grade}` : '—'}</td>
                  <td className="px-5 py-3 text-gray-600">{r.primaryEvent || '—'}</td>
                  <td className="px-5 py-3 text-gray-600">{r.group || '—'}</td>
                  <td className="px-5 py-3 text-gray-600">{r.yearsRunning || '—'}</td>
                  <td className="px-5 py-3 text-gray-600">{r.email || '—'}</td>
                  <td className="px-5 py-3 text-right">
                    <button onClick={() => openEdit(r)} className="text-brand-600 hover:text-brand-800 mr-3 font-medium">Edit</button>
                    <button onClick={() => openDelete(r)} className="text-red-500 hover:text-red-700 font-medium">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add / Edit Modal */}
      <Modal
        isOpen={modal === 'add' || modal === 'edit'}
        onClose={close}
        title={modal === 'add' ? 'Add Runner' : 'Edit Runner'}
        size="lg"
      >
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="label">Full Name *</label>
            <input className="input" value={current.name} onChange={(e) => set('name', e.target.value)} placeholder="Jane Smith" />
          </div>
          <div>
            <label className="label">Grade</label>
            <select className="input" value={current.grade} onChange={(e) => set('grade', e.target.value)}>
              <option value="">— select —</option>
              {GRADES.map((g) => <option key={g} value={g}>{g}th Grade</option>)}
            </select>
          </div>
          <div>
            <label className="label">Years Running</label>
            <input className="input" type="number" min="0" max="20" value={current.yearsRunning}
              onChange={(e) => set('yearsRunning', e.target.value)} placeholder="e.g. 3" />
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" value={current.email} onChange={(e) => set('email', e.target.value)} placeholder="jane@school.edu" />
          </div>
          <div>
            <label className="label">Phone</label>
            <input className="input" type="tel" value={current.phone} onChange={(e) => set('phone', e.target.value)} placeholder="(555) 000-0000" />
          </div>
          <div>
            <label className="label">Primary Event</label>
            <select className="input" value={current.primaryEvent} onChange={(e) => set('primaryEvent', e.target.value)}>
              <option value="">— select —</option>
              {EVENTS.map((ev) => <option key={ev}>{ev}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Training Group</label>
            <select className="input" value={current.group} onChange={(e) => set('group', e.target.value)}>
              <option value="">— none —</option>
              {groups.map((g) => <option key={g.id} value={g.name}>{g.name}</option>)}
            </select>
          </div>

          {/* PRs */}
          <div className="col-span-2 mt-2">
            <p className="text-sm font-semibold text-gray-700 mb-2">Personal Records</p>
            {Object.entries(current.prs || {}).length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {Object.entries(current.prs).map(([ev, time]) => (
                  <span key={ev} className="inline-flex items-center gap-1 bg-brand-50 text-brand-700 text-xs px-3 py-1 rounded-full">
                    <strong>{ev}</strong>: {time}
                    <button onClick={() => removePR(ev)} className="ml-1 text-brand-400 hover:text-red-500">×</button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <select className="input flex-1" value={prEvent} onChange={(e) => setPrEvent(e.target.value)}>
                {PR_EVENTS.map((ev) => <option key={ev}>{ev}</option>)}
              </select>
              <input
                className="input w-28" value={prTime} onChange={(e) => setPrTime(e.target.value)}
                placeholder="e.g. 4:55"
              />
              <button onClick={addPR} className="bg-brand-600 hover:bg-brand-700 text-white px-3 rounded-lg text-sm">
                Add
              </button>
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button onClick={close} className="btn-secondary">Cancel</button>
          <button onClick={save}  className="btn-primary">{modal === 'add' ? 'Add Runner' : 'Save Changes'}</button>
        </div>
      </Modal>

      {/* View Modal */}
      <Modal isOpen={modal === 'view'} onClose={close} title={current.name} size="md">
        <dl className="space-y-3 text-sm">
          {[
            ['Grade',        current.grade ? `Grade ${current.grade}` : '—'],
            ['Years Running',current.yearsRunning || '—'],
            ['Primary Event',current.primaryEvent || '—'],
            ['Group',        current.group || '—'],
            ['Email',        current.email || '—'],
            ['Phone',        current.phone || '—'],
          ].map(([label, val]) => (
            <div key={label} className="flex gap-4">
              <dt className="w-32 font-medium text-gray-500 shrink-0">{label}</dt>
              <dd className="text-gray-900">{val}</dd>
            </div>
          ))}
          {Object.entries(current.prs || {}).length > 0 && (
            <div className="pt-2">
              <p className="font-medium text-gray-500 mb-1">Personal Records</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(current.prs).map(([ev, time]) => (
                  <span key={ev} className="bg-brand-50 text-brand-700 text-xs px-3 py-1 rounded-full">
                    <strong>{ev}</strong>: {time}
                  </span>
                ))}
              </div>
            </div>
          )}
        </dl>
        <div className="mt-6 flex justify-end gap-3">
          <button onClick={close} className="btn-secondary">Close</button>
          <button onClick={() => setModal('edit')} className="btn-primary">Edit</button>
        </div>
      </Modal>

      {/* Delete Modal */}
      <Modal isOpen={modal === 'delete'} onClose={close} title="Remove Runner" size="sm">
        <p className="text-sm text-gray-600">
          Are you sure you want to remove <strong>{current.name}</strong> from the roster? This cannot be undone.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button onClick={close}         className="btn-secondary">Cancel</button>
          <button onClick={confirmDelete} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
            Remove
          </button>
        </div>
      </Modal>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Utility classes via Tailwind – kept here as inline style so Tailwind includes them */}
      <style>{`
        .label { display: block; font-size: .875rem; font-weight: 500; color: #374151; margin-bottom: 4px; }
        .input { width: 100%; border: 1px solid #d1d5db; border-radius: .5rem; padding: .5rem .75rem; font-size: .875rem; outline: none; }
        .input:focus { ring: 2px solid #6366f1; border-color: #6366f1; }
        .btn-primary { background: #4f46e5; color: white; padding: .5rem 1rem; border-radius: .5rem; font-size: .875rem; font-weight: 500; }
        .btn-primary:hover { background: #4338ca; }
        .btn-secondary { background: white; border: 1px solid #d1d5db; color: #374151; padding: .5rem 1rem; border-radius: .5rem; font-size: .875rem; font-weight: 500; }
        .btn-secondary:hover { background: #f9fafb; }
      `}</style>
    </div>
  )
}
