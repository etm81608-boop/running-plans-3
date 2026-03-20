import { useState } from 'react'
import {
  collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp,
} from 'firebase/firestore'
import { db } from '../firebase/config'
import { useCollection } from '../hooks/useCollection'
import Modal from '../components/Modal'
import Toast from '../components/Toast'

const COLORS = [
  { label: 'Indigo',  value: '#6366f1' },
  { label: 'Emerald', value: '#10b981' },
  { label: 'Amber',   value: '#f59e0b' },
  { label: 'Rose',    value: '#f43f5e' },
  { label: 'Sky',     value: '#0ea5e9' },
  { label: 'Violet',  value: '#8b5cf6' },
  { label: 'Teal',    value: '#14b8a6' },
  { label: 'Orange',  value: '#f97316' },
]

const EMPTY = { name: '', description: '', color: '#6366f1' }

export default function Groups() {
  const { docs: groups }  = useCollection('groups', 'name')
  const { docs: runners } = useCollection('runners', 'name')

  const [modal,   setModal]   = useState(null)
  const [current, setCurrent] = useState(EMPTY)
  const [toast,   setToast]   = useState(null)

  function openAdd()     { setCurrent(EMPTY);   setModal('add')    }
  function openEdit(g)   { setCurrent(g);       setModal('edit')   }
  function openDelete(g) { setCurrent(g);       setModal('delete') }
  function close()       { setModal(null)                          }

  function set(f, v) { setCurrent((c) => ({ ...c, [f]: v })) }

  async function save() {
    if (!current.name.trim()) return
    const data = { name: current.name.trim(), description: current.description.trim(), color: current.color }
    try {
      if (modal === 'add') {
        await addDoc(collection(db, 'groups'), { ...data, createdAt: serverTimestamp() })
        setToast({ message: 'Group created!', type: 'success' })
      } else {
        await updateDoc(doc(db, 'groups', current.id), data)
        setToast({ message: 'Group updated!', type: 'success' })
      }
      close()
    } catch (err) {
      setToast({ message: err.message, type: 'error' })
    }
  }

  async function confirmDelete() {
    try {
      await deleteDoc(doc(db, 'groups', current.id))
      setToast({ message: 'Group deleted.', type: 'info' })
      close()
    } catch (err) {
      setToast({ message: err.message, type: 'error' })
    }
  }

  function membersOf(groupName) {
    return runners.filter((r) => r.group === groupName)
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Training Groups</h1>
          <p className="text-sm text-gray-500 mt-0.5">Organize runners into groups for easy workout assignment.</p>
        </div>
        <button onClick={openAdd} className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          + New Group
        </button>
      </div>

      {groups.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 py-16 text-center text-gray-400 text-sm">
          No groups yet. Create one to organize your roster.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {groups.map((g) => {
            const members = membersOf(g.name)
            return (
              <div key={g.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: g.color || '#6366f1' }} />
                    <h3 className="font-semibold text-gray-900">{g.name}</h3>
                  </div>
                  <div className="flex gap-2 text-sm">
                    <button onClick={() => openEdit(g)}   className="text-brand-600 hover:text-brand-800 font-medium">Edit</button>
                    <button onClick={() => openDelete(g)} className="text-red-500 hover:text-red-700 font-medium">Delete</button>
                  </div>
                </div>
                {g.description && (
                  <p className="text-sm text-gray-500 mb-3">{g.description}</p>
                )}
                <p className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wider">
                  {members.length} Member{members.length !== 1 ? 's' : ''}
                </p>
                {members.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {members.slice(0, 8).map((r) => (
                      <span key={r.id} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                        {r.name}
                      </span>
                    ))}
                    {members.length > 8 && (
                      <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                        +{members.length - 8} more
                      </span>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 italic">No runners assigned yet.</p>
                )}
              </div>
            )
          })}
        </div>
      )}

      <p className="mt-4 text-xs text-gray-400">
        Tip: Assign runners to groups from the Roster page.
      </p>

      {/* Add / Edit Modal */}
      <Modal isOpen={modal === 'add' || modal === 'edit'} onClose={close} title={modal === 'add' ? 'New Group' : 'Edit Group'}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Group Name *</label>
            <input
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
              value={current.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="e.g. Varsity Distance, JV Sprints…"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
              value={current.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="Optional description…"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Color</label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button
                  key={c.value}
                  onClick={() => set('color', c.value)}
                  className={`w-7 h-7 rounded-full border-2 transition-transform ${current.color === c.value ? 'border-gray-900 scale-110' : 'border-transparent'}`}
                  style={{ backgroundColor: c.value }}
                  title={c.label}
                />
              ))}
            </div>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button onClick={close} className="border border-gray-200 text-gray-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
          <button onClick={save} className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
            {modal === 'add' ? 'Create Group' : 'Save Changes'}
          </button>
        </div>
      </Modal>

      {/* Delete Modal */}
      <Modal isOpen={modal === 'delete'} onClose={close} title="Delete Group" size="sm">
        <p className="text-sm text-gray-600">
          Delete <strong>{current.name}</strong>? Runners in this group won't be deleted, but they'll no longer have a group assigned.
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
