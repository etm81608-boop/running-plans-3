import { useState } from 'react'
import {
  collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp,
} from 'firebase/firestore'
import { db } from '../firebase/config'
import { useCollection } from '../hooks/useCollection'
import Modal from '../components/Modal'
import Toast from '../components/Toast'

const EMPTY = {
  name: '', warmup: '', mainWorkout: '', cooldown: '', crossTraining: '', notes: '',
}

export default function Workouts() {
  const { docs: templates } = useCollection('workouts', 'createdAt')

  const [modal,   setModal]   = useState(null) // 'add'|'edit'|'view'|'delete'
  const [current, setCurrent] = useState(EMPTY)
  const [toast,   setToast]   = useState(null)
  const [search,  setSearch]  = useState('')

  function openAdd()     { setCurrent(EMPTY);   setModal('add')    }
  function openEdit(t)   { setCurrent(t);       setModal('edit')   }
  function openView(t)   { setCurrent(t);       setModal('view')   }
  function openDelete(t) { setCurrent(t);       setModal('delete') }
  function close()       { setModal(null)                          }

  function set(f, v) { setCurrent((c) => ({ ...c, [f]: v })) }

  async function save() {
    if (!current.name?.trim()) return
    const data = {
      name:          current.name.trim(),
      warmup:        current.warmup.trim(),
      mainWorkout:   current.mainWorkout.trim(),
      cooldown:      current.cooldown.trim(),
      crossTraining: current.crossTraining.trim(),
      notes:         current.notes.trim(),
      // Keep title for backward compat
      title:         current.name.trim(),
    }
    try {
      if (modal === 'add') {
        await addDoc(collection(db, 'workouts'), { ...data, createdAt: serverTimestamp() })
        setToast({ message: 'Template saved!', type: 'success' })
      } else {
        await updateDoc(doc(db, 'workouts', current.id), data)
        setToast({ message: 'Template updated!', type: 'success' })
      }
      close()
    } catch (err) {
      setToast({ message: err.message, type: 'error' })
    }
  }

  async function confirmDelete() {
    try {
      await deleteDoc(doc(db, 'workouts', current.id))
      setToast({ message: 'Template deleted.', type: 'info' })
      close()
    } catch (err) {
      setToast({ message: err.message, type: 'error' })
    }
  }

  const filtered = templates.filter((t) =>
    (t.name || t.title || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Workout Templates</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Save reusable workouts here. Load them from the calendar when creating a workout.
          </p>
        </div>
        <button
          onClick={openAdd}
          className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          + New Template
        </button>
      </div>

      <p className="text-xs text-brand-600 bg-brand-50 px-3 py-2 rounded-lg mb-5 inline-block">
        💡 Tip: To assign a workout to a runner, click any date on the <strong>Master Calendar</strong>.
      </p>

      {/* Search */}
      <div className="mb-5">
        <input
          type="text"
          placeholder="Search templates…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 w-64"
        />
      </div>

      {/* Template cards */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 py-16 text-center text-gray-400 text-sm">
          {templates.length === 0
            ? 'No templates yet. Save a workout you use often by clicking "New Template".'
            : 'No templates match your search.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((t) => (
            <div key={t.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col">
              <div className="flex items-start justify-between mb-3">
                <button
                  onClick={() => openView(t)}
                  className="text-left font-semibold text-gray-900 hover:text-brand-700 text-base leading-tight"
                >
                  {t.name || t.title}
                </button>
                <div className="flex gap-2 text-sm ml-2 flex-shrink-0">
                  <button onClick={() => openEdit(t)}   className="text-brand-600 hover:text-brand-800">Edit</button>
                  <button onClick={() => openDelete(t)} className="text-red-500 hover:text-red-700">Delete</button>
                </div>
              </div>

              <div className="space-y-2 flex-1">
                {t.warmup && (
                  <div className="text-xs bg-green-50 text-green-800 rounded-lg p-2">
                    <span className="font-semibold">🔥 Warm-Up:</span> <span className="line-clamp-1">{t.warmup}</span>
                  </div>
                )}
                {(t.mainWorkout || t.mainSet) && (
                  <div className="text-xs bg-brand-50 text-brand-800 rounded-lg p-2">
                    <span className="font-semibold">⚡ Main:</span> <span className="line-clamp-2">{t.mainWorkout || t.mainSet}</span>
                  </div>
                )}
                {t.cooldown && (
                  <div className="text-xs bg-blue-50 text-blue-800 rounded-lg p-2">
                    <span className="font-semibold">❄️ Cool-Down:</span> <span className="line-clamp-1">{t.cooldown}</span>
                  </div>
                )}
                {t.crossTraining && (
                  <div className="text-xs bg-teal-50 text-teal-800 rounded-lg p-2">
                    <span className="font-semibold">💪 Cross Training:</span> <span className="line-clamp-1">{t.crossTraining}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      <Modal
        isOpen={modal === 'add' || modal === 'edit'}
        onClose={close}
        title={modal === 'add' ? 'New Template' : 'Edit Template'}
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Template Name *</label>
            <input
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
              value={current.name || current.title || ''}
              onChange={(e) => set('name', e.target.value)}
              placeholder="e.g. Tuesday Tempo, 6×800m Intervals…"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">🔥 Warm-Up</label>
            <textarea rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
              value={current.warmup} onChange={(e) => set('warmup', e.target.value)}
              placeholder="e.g. 10 min easy jog, dynamic drills, 4 strides" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">⚡ Main Workout</label>
            <textarea rows={4}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
              value={current.mainWorkout || current.mainSet || ''} onChange={(e) => set('mainWorkout', e.target.value)}
              placeholder="e.g. 6 × 800m at 5K pace, 2 min rest between each" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">❄️ Cool-Down</label>
            <textarea rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
              value={current.cooldown} onChange={(e) => set('cooldown', e.target.value)}
              placeholder="e.g. 10 min easy, static stretching" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">💪 Cross Training</label>
            <textarea rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
              value={current.crossTraining} onChange={(e) => set('crossTraining', e.target.value)}
              placeholder="e.g. Core circuit, hip strengthening" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Notes <span className="text-gray-400 font-normal">(optional)</span></label>
            <textarea rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
              value={current.notes} onChange={(e) => set('notes', e.target.value)}
              placeholder="Any default notes for this template…" />
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button onClick={close} className="border border-gray-200 text-gray-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
          <button onClick={save}  className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
            {modal === 'add' ? 'Save Template' : 'Save Changes'}
          </button>
        </div>
      </Modal>

      {/* View Modal */}
      <Modal isOpen={modal === 'view'} onClose={close} title={current.name || current.title} size="lg">
        <div className="space-y-4 text-sm">
          {current.warmup       && <Block emoji="🔥" title="Warm-Up"       content={current.warmup}       bg="bg-green-50" />}
          {(current.mainWorkout || current.mainSet) && <Block emoji="⚡" title="Main Workout"  content={current.mainWorkout || current.mainSet} bg="bg-brand-50" />}
          {current.cooldown     && <Block emoji="❄️" title="Cool-Down"     content={current.cooldown}     bg="bg-blue-50"  />}
          {current.crossTraining && <Block emoji="💪" title="Cross Training" content={current.crossTraining} bg="bg-teal-50"  />}
          {current.notes        && <Block emoji="📝" title="Notes"         content={current.notes}        bg="bg-amber-50" />}
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button onClick={close}               className="border border-gray-200 text-gray-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">Close</button>
          <button onClick={() => setModal('edit')} className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium">Edit</button>
        </div>
      </Modal>

      {/* Delete Modal */}
      <Modal isOpen={modal === 'delete'} onClose={close} title="Delete Template" size="sm">
        <p className="text-sm text-gray-600">
          Delete <strong>{current.name || current.title}</strong>? This won't affect any workouts already on the calendar.
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

function Block({ emoji, title, content, bg = 'bg-gray-50' }) {
  return (
    <div className={`rounded-xl p-3 ${bg}`}>
      <p className="font-semibold text-gray-800 mb-1">{emoji} {title}</p>
      <p className="text-gray-700 whitespace-pre-wrap">{content}</p>
    </div>
  )
}

