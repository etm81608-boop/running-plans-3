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

const VG_OPTIONS = [
  { value: null,  label: 'Off',     bg: 'bg-gray-100',    text: 'text-gray-500'   },
  { value: 1,     label: '1',       bg: 'bg-violet-100',  text: 'text-violet-700' },
  { value: 2,     label: '2',       bg: 'bg-sky-100',     text: 'text-sky-700'    },
  { value: 3,     label: '3',       bg: 'bg-emerald-100', text: 'text-emerald-700'},
  { value: 4,     label: '4',       bg: 'bg-orange-100',  text: 'text-orange-700' },
  { value: 5,     label: '5',       bg: 'bg-rose-100',    text: 'text-rose-700'   },
]

const EMPTY = { name: '', description: '', color: '#6366f1' }

export default function Groups() {
  const { docs: groups }  = useCollection('groups', 'name')
  const { docs: runners } = useCollection('runners', 'name')

  const [modal,   setModal]   = useState(null)
  const [current, setCurrent] = useState(EMPTY)
  const [toast,   setToast]   = useState(null)

  // Track which group cards have "add runners" panel open
  const [addPanelOpen, setAddPanelOpen] = useState({})

  function openAdd()     { setCurrent(EMPTY); setModal('add')    }
  function openEdit(g)   { setCurrent(g);     setModal('edit')   }
  function openDelete(g) { setCurrent(g);     setModal('delete') }
  function close()       { setModal(null)                        }
  function set(f, v)     { setCurrent((c) => ({ ...c, [f]: v })) }

  function toggleAddPanel(groupId) {
    setAddPanelOpen((prev) => ({ ...prev, [groupId]: !prev[groupId] }))
  }

  // ── Firestore helpers ───────────────────────────────────────────────────────

  async function saveGroup() {
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

  // Assign runner to a group (or remove if groupName is '')
  async function assignRunnerToGroup(runner, groupName) {
    try {
      await updateDoc(doc(db, 'runners', runner.id), { group: groupName })
      setToast({ message: groupName ? `${runner.name} added to ${groupName}` : `${runner.name} removed from group`, type: 'success' })
    } catch (err) {
      setToast({ message: err.message, type: 'error' })
    }
  }

  // Set visibility group number for a runner
  async function setVisibilityGroup(runner, value) {
    try {
      await updateDoc(doc(db, 'runners', runner.id), { visibilityGroup: value })
    } catch (err) {
      setToast({ message: err.message, type: 'error' })
    }
  }

  function membersOf(groupName) {
    return runners.filter((r) => r.group === groupName)
  }

  function nonMembersOf(groupName) {
    return runners.filter((r) => r.group !== groupName)
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Training Groups</h1>
          <p className="text-sm text-gray-500 mt-0.5">Assign runners and privacy numbers directly on each card.</p>
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {groups.map((g) => {
            const members    = membersOf(g.name)
            const nonMembers = nonMembersOf(g.name)
            const panelOpen  = !!addPanelOpen[g.id]

            return (
              <div key={g.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

                {/* Card header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                  <div className="flex items-center gap-2.5">
                    <div className="w-3.5 h-3.5 rounded-full shrink-0" style={{ backgroundColor: g.color || '#6366f1' }} />
                    <h3 className="font-semibold text-gray-900">{g.name}</h3>
                    <span className="text-xs text-gray-400 font-medium">{members.length} runner{members.length !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="flex gap-3 text-sm">
                    <button onClick={() => openEdit(g)}   className="text-brand-600 hover:text-brand-800 font-medium">Edit</button>
                    <button onClick={() => openDelete(g)} className="text-red-500 hover:text-red-700 font-medium">Delete</button>
                  </div>
                </div>

                {g.description && (
                  <p className="px-5 pt-3 text-sm text-gray-500">{g.description}</p>
                )}

                {/* Member rows */}
                <div className="px-5 py-3">
                  {members.length === 0 ? (
                    <p className="text-xs text-gray-400 italic py-1">No runners assigned yet.</p>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Members</p>
                      {members.map((r) => (
                        <RunnerRow
                          key={r.id}
                          runner={r}
                          onRemove={() => assignRunnerToGroup(r, '')}
                          onSetVisibility={(val) => setVisibilityGroup(r, val)}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Add runners panel */}
                <div className="border-t border-gray-100">
                  <button
                    onClick={() => toggleAddPanel(g.id)}
                    className="w-full flex items-center justify-between px-5 py-3 text-sm text-brand-600 hover:bg-brand-50 font-medium transition-colors"
                  >
                    <span>+ Add Runners</span>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className={`h-4 w-4 transition-transform ${panelOpen ? 'rotate-180' : ''}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {panelOpen && (
                    <div className="px-5 pb-4 space-y-2">
                      {nonMembers.length === 0 ? (
                        <p className="text-xs text-gray-400 italic">All runners are already in this group.</p>
                      ) : (
                        nonMembers.map((r) => (
                          <div key={r.id} className="flex items-center justify-between py-1.5 px-3 bg-gray-50 rounded-lg">
                            <div>
                              <span className="text-sm font-medium text-gray-700">{r.name}</span>
                              {r.group && (
                                <span className="ml-2 text-xs text-gray-400 italic">currently in {r.group}</span>
                              )}
                            </div>
                            <button
                              onClick={() => assignRunnerToGroup(r, g.name)}
                              className="text-xs bg-brand-600 hover:bg-brand-700 text-white px-3 py-1 rounded-lg font-medium transition-colors"
                            >
                              Add
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Unassigned runners panel */}
      {runners.filter((r) => !r.group).length > 0 && (
        <div className="mt-6 bg-amber-50 border border-amber-200 rounded-2xl p-5">
          <p className="text-sm font-semibold text-amber-800 mb-3">
            ⚠️ Unassigned Runners ({runners.filter((r) => !r.group).length})
          </p>
          <div className="flex flex-wrap gap-2">
            {runners.filter((r) => !r.group).map((r) => (
              <span key={r.id} className="text-xs bg-white border border-amber-200 text-amber-700 px-3 py-1.5 rounded-full font-medium">
                {r.name}
              </span>
            ))}
          </div>
          <p className="text-xs text-amber-600 mt-3">Use the "+ Add Runners" panel on any group card above to assign them.</p>
        </div>
      )}

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
          <button onClick={saveGroup} className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
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

// ── Runner Row ─────────────────────────────────────────────────────────────────
// Shows a member's name, visibility group selector, and remove button

function RunnerRow({ runner, onRemove, onSetVisibility }) {
  const current = runner.visibilityGroup ?? null

  return (
    <div className="flex items-center gap-3 py-2 px-3 bg-gray-50 rounded-xl">
      {/* Name */}
      <span className="flex-1 text-sm font-medium text-gray-800 truncate">{runner.name}</span>

      {/* Privacy # label */}
      <span className="text-xs text-gray-400 shrink-0">Privacy #</span>

      {/* Visibility group buttons */}
      <div className="flex gap-1 shrink-0">
        {VG_OPTIONS.map((opt) => {
          const isSelected = current === opt.value
          return (
            <button
              key={String(opt.value)}
              onClick={() => onSetVisibility(opt.value)}
              title={opt.value === null ? 'Private (no group)' : `Visibility Group ${opt.value}`}
              className={`w-7 h-7 rounded-lg text-xs font-bold transition-all border ${
                isSelected
                  ? `${opt.bg} ${opt.text} border-transparent ring-2 ring-offset-1 ring-gray-300`
                  : 'bg-white border-gray-200 text-gray-400 hover:border-gray-400'
              }`}
            >
              {opt.label}
            </button>
          )
        })}
      </div>

      {/* Remove from group */}
      <button
        onClick={onRemove}
        title="Remove from group"
        className="shrink-0 text-gray-300 hover:text-red-500 transition-colors ml-1"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}
