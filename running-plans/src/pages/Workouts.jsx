import { useState } from 'react'
import {
  collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp,
} from 'firebase/firestore'
import { db } from '../firebase/config'
import { useCollection } from '../hooks/useCollection'
import Modal from '../components/Modal'
import Toast from '../components/Toast'
import { getWorkoutTypeColor, getWorkoutTypeLabel } from '../utils/constants'
import { useWorkoutTypes } from '../hooks/useWorkoutTypes'

const EMPTY = {
  title: '', type: 'easy', description: '',
  warmup: '', mainSet: '', cooldown: '', targetPace: '', notes: '',
}

export default function Workouts() {
  const allWorkoutTypes = useWorkoutTypes()
  const templateTypes   = allWorkoutTypes.filter((t) => t.value !== 'rest')

  const { docs: workouts } = useCollection('workouts', 'createdAt')

  const [modal,   setModal]   = useState(null)
  const [current, setCurrent] = useState(EMPTY)
  const [toast,   setToast]   = useState(null)
  const [search,  setSearch]  = useState('')
  const [filter,  setFilter]  = useState('all')

  function openAdd()     { setCurrent(EMPTY);   setModal('add')    }
  function openEdit(w)   { setCurrent(w);       setModal('edit')   }
  function openView(w)   { setCurrent(w);       setModal('view')   }
  function openDelete(w) { setCurrent(w);       setModal('delete') }
  function close()       { setModal(null)                          }

  function set(f, v) { setCurrent((c) => ({ ...c, [f]: v })) }

  async function save() {
    if (!current.title.trim()) return
    const data = {
      title:       current.title.trim(),
      type:        current.type,
      description: current.description.trim(),
      warmup:      current.warmup.trim(),
      mainSet:     current.mainSet.trim(),
      cooldown:    current.cooldown.trim(),
      targetPace:  current.targetPace.trim(),
      notes:       current.notes.trim(),
    }
    try {
      if (modal === 'add') {
        await addDoc(collection(db, 'workouts'), { ...data, createdAt: serverTimestamp() })
        setToast({ message: 'Workout saved!', type: 'success' })
      } else {
        await updateDoc(doc(db, 'workouts', current.id), data)
        setToast({ message: 'Workout updated!', type: 'success' })
      }
      close()
    } catch (err) {
      setToast({ message: err.message, type: 'error' })
    }
  }

  async function confirmDelete() {
    try {
      await deleteDoc(doc(db, 'workouts', current.id))
      setToast({ message: 'Workout deleted.', type: 'info' })
      close()
    } catch (err) {
      setToast({ message: err.message, type: 'error' })
    }
  }

  const filtered = workouts.filter((w) => {
    const matchType   = filter === 'all' || w.type === filter
    const matchSearch = w.title?.toLowerCase().includes(search.toLowerCase())
    return matchType && matchSearch
  })

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Workout Library</h1>
          <p className="text-sm text-gray-500 mt-0.5">{workouts.length} workout{workouts.length !== 1 ? 's' : ''} saved</p>
        </div>
        <button onClick={openAdd} className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          + New Workout
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <input
          type="text"
          placeholder="Search workouts…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 w-56"
        />
        <div className="flex flex-wrap gap-1">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filter === 'all' ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            All
          </button>
          {templateTypes.map((t) => (
            <button
              key={t.value}
              onClick={() => setFilter(t.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filter === t.value ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Workout cards */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 py-16 text-center text-gray-400 text-sm">
          {workouts.length === 0 ? 'No workouts yet. Build your library by clicking "New Workout".' : 'No workouts match your filters.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((w) => (
            <div key={w.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col">
              <div className="flex items-start justify-between mb-2">
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${getWorkoutTypeColor(w.type)}`}>
                  {getWorkoutTypeLabel(w.type)}
                </span>
                <div className="flex gap-2 text-sm ml-2">
                  <button onClick={() => openEdit(w)}   className="text-brand-600 hover:text-brand-800">Edit</button>
                  <button onClick={() => openDelete(w)} className="text-red-500 hover:text-red-700">Delete</button>
                </div>
              </div>
              <button
                onClick={() => openView(w)}
                className="text-left mt-2 font-semibold text-gray-900 hover:text-brand-700 text-base leading-tight"
              >
                {w.title}
              </button>
              {w.description && (
                <p className="text-sm text-gray-500 mt-1 line-clamp-2">{w.description}</p>
              )}
              {w.mainSet && (
                <div className="mt-3 bg-gray-50 rounded-lg p-3 text-xs text-gray-600 whitespace-pre-wrap line-clamp-3 flex-1">
                  {w.mainSet}
                </div>
              )}
              {w.targetPace && (
                <p className="mt-2 text-xs text-gray-400">Target pace: {w.targetPace}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      <Modal isOpen={modal === 'add' || modal === 'edit'} onClose={close} title={modal === 'add' ? 'New Workout' : 'Edit Workout'} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                value={current.title} onChange={(e) => set('title', e.target.value)}
                placeholder="e.g. Tuesday Tempo 4 miles"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                value={current.type} onChange={(e) => set('type', e.target.value)}
              >
                {templateTypes.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Target Pace / Time</label>
              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                value={current.targetPace} onChange={(e) => set('targetPace', e.target.value)}
                placeholder="e.g. 7:30/mile, 6:00 400m"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Overview / Description</label>
            <textarea rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
              value={current.description} onChange={(e) => set('description', e.target.value)}
              placeholder="Brief overview of the session…" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Warm-Up</label>
            <textarea rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
              value={current.warmup} onChange={(e) => set('warmup', e.target.value)}
              placeholder="e.g. 10 min easy jog, dynamic drills" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Main Set</label>
            <textarea rows={4} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
              value={current.mainSet} onChange={(e) => set('mainSet', e.target.value)}
              placeholder="e.g. 6 x 800m @ 5K pace, 90 sec rest between each" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cool-Down</label>
            <textarea rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
              value={current.cooldown} onChange={(e) => set('cooldown', e.target.value)}
              placeholder="e.g. 10 min easy jog, stretching" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Coach Notes</label>
            <textarea rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
              value={current.notes} onChange={(e) => set('notes', e.target.value)}
              placeholder="Any additional notes for athletes…" />
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button onClick={close} className="border border-gray-200 text-gray-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
          <button onClick={save}  className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
            {modal === 'add' ? 'Save Workout' : 'Save Changes'}
          </button>
        </div>
      </Modal>

      {/* View Modal */}
      <Modal isOpen={modal === 'view'} onClose={close} title={current.title} size="lg">
        <div className="space-y-4 text-sm">
          <span className={`inline-block text-xs px-2.5 py-1 rounded-full font-medium ${getWorkoutTypeColor(current.type)}`}>
            {getWorkoutTypeLabel(current.type)}
          </span>
          {current.description && <p className="text-gray-600">{current.description}</p>}
          {current.targetPace  && <p className="text-gray-500"><span className="font-medium">Target pace:</span> {current.targetPace}</p>}
          {current.warmup  && <Section title="Warm-Up"   content={current.warmup}  />}
          {current.mainSet && <Section title="Main Set"  content={current.mainSet} />}
          {current.cooldown && <Section title="Cool-Down" content={current.cooldown} />}
          {current.notes   && <Section title="Coach Notes" content={current.notes} />}
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button onClick={close}               className="border border-gray-200 text-gray-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">Close</button>
          <button onClick={() => setModal('edit')} className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium">Edit</button>
        </div>
      </Modal>

      {/* Delete Modal */}
      <Modal isOpen={modal === 'delete'} onClose={close} title="Delete Workout" size="sm">
        <p className="text-sm text-gray-600">
          Delete <strong>{current.title}</strong>? This won't affect existing assignments.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button onClick={close}         className="border border-gray-200 text-gray-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
          <button onClick={confirmDelete} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium">Delete</button>
        </div>
      </Modal>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}

function Section({ title, content }) {
  return (
    <div>
      <p className="font-semibold text-gray-700 mb-1">{title}</p>
      <div className="bg-gray-50 rounded-lg p-3 text-gray-600 whitespace-pre-wrap">{content}</div>
    </div>
  )
}

