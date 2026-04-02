import { useState } from 'react'
import { collection, addDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useCollection } from '../hooks/useCollection'
import { WORKOUT_TYPES as DEFAULT_TYPES } from '../utils/constants'
import Toast from '../components/Toast'

// ── Color palette ─────────────────────────────────────────────────────────────

const BADGE_COLORS = [
  { label: 'Green',   color: 'bg-green-100 text-green-800',   calendarColor: '#16a34a' },
  { label: 'Blue',    color: 'bg-blue-100 text-blue-800',     calendarColor: '#2563eb' },
  { label: 'Indigo',  color: 'bg-indigo-100 text-indigo-800', calendarColor: '#4f46e5' },
  { label: 'Purple',  color: 'bg-purple-100 text-purple-800', calendarColor: '#7c3aed' },
  { label: 'Red',     color: 'bg-red-100 text-red-800',       calendarColor: '#dc2626' },
  { label: 'Orange',  color: 'bg-orange-100 text-orange-800', calendarColor: '#ea580c' },
  { label: 'Yellow',  color: 'bg-yellow-100 text-yellow-800', calendarColor: '#ca8a04' },
  { label: 'Teal',    color: 'bg-teal-100 text-teal-800',     calendarColor: '#0d9488' },
  { label: 'Slate',   color: 'bg-slate-100 text-slate-600',   calendarColor: '#475569' },
  { label: 'Gray',    color: 'bg-gray-100 text-gray-700',     calendarColor: '#6b7280' },
]

function slugify(str) {
  return str.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}

const EMPTY = {
  label: '',
  color: BADGE_COLORS[0].color,
  calendarColor: BADGE_COLORS[0].calendarColor,
}

// ── Settings page ─────────────────────────────────────────────────────────────

export default function Settings() {
  const { docs: customTypes } = useCollection('workoutTypes', 'createdAt')
  const [form, setForm]       = useState(EMPTY)
  const [toast, setToast]     = useState(null)
  const [saving, setSaving]   = useState(false)
  const [toDelete, setToDelete] = useState(null)   // id awaiting confirm

  function set(f, v) { setForm((p) => ({ ...p, [f]: v })) }

  function pickColor(badge) {
    setForm((p) => ({ ...p, color: badge.color, calendarColor: badge.calendarColor }))
  }

  async function handleAdd() {
    const label = form.label.trim()
    if (!label) return
    const value = slugify(label)
    if (!value) {
      setToast({ message: 'Name must contain at least one letter or number.', type: 'error' })
      return
    }
    const taken = new Set([
      ...DEFAULT_TYPES.map((t) => t.value),
      ...customTypes.map((t) => t.value),
    ])
    if (taken.has(value)) {
      setToast({ message: `A workout type called "${value}" already exists.`, type: 'error' })
      return
    }
    setSaving(true)
    try {
      await addDoc(collection(db, 'workoutTypes'), {
        value,
        label,
        color:         form.color,
        calendarColor: form.calendarColor,
        createdAt:     serverTimestamp(),
      })
      setToast({ message: `"${label}" added!`, type: 'success' })
      setForm(EMPTY)
    } catch (err) {
      setToast({ message: err.message, type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id, label) {
    try {
      await deleteDoc(doc(db, 'workoutTypes', id))
      setToast({ message: `"${label}" removed.`, type: 'info' })
    } catch (err) {
      setToast({ message: err.message, type: 'error' })
    } finally {
      setToDelete(null)
    }
  }

  const selectedBadge = BADGE_COLORS.find((b) => b.color === form.color) || BADGE_COLORS[0]
  const slugPreview   = slugify(form.label)

  return (
    <div className="p-8 max-w-3xl">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-0.5">Manage custom workout types and other app settings.</p>
      </div>

      {/* ── Workout Types ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
        <h2 className="text-base font-bold text-gray-800 mb-1">Workout Types</h2>
        <p className="text-sm text-gray-500 mb-5">
          Add custom workout types. They'll appear in all dropdowns alongside the built-in types.
        </p>

        {/* Add form */}
        <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Add New Type</h3>
          <div className="space-y-3">

            {/* Name */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Name</label>
              <input
                type="text"
                placeholder="e.g. Hill Repeats"
                value={form.label}
                onChange={(e) => set('label', e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
              {slugPreview && (
                <p className="text-xs text-gray-400 mt-1">
                  Internal ID: <code className="bg-gray-100 px-1 py-0.5 rounded font-mono">{slugPreview}</code>
                </p>
              )}
            </div>

            {/* Color picker */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-2">Color</label>
              <div className="flex flex-wrap gap-2">
                {BADGE_COLORS.map((b) => (
                  <button
                    key={b.color}
                    type="button"
                    onClick={() => pickColor(b)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                      form.color === b.color
                        ? 'border-indigo-500 ring-2 ring-indigo-300 bg-white'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <span
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: b.calendarColor }}
                    />
                    {b.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Live preview */}
            {form.label && (
              <div className="flex items-center gap-2 py-1">
                <span className="text-xs text-gray-500">Preview:</span>
                <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${form.color}`}>
                  {form.label}
                </span>
                <span className="flex items-center gap-1 text-xs text-gray-500">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: selectedBadge.calendarColor }} />
                  calendar dot
                </span>
              </div>
            )}

            <button
              type="button"
              onClick={handleAdd}
              disabled={!form.label.trim() || saving}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              {saving ? 'Adding…' : 'Add Workout Type'}
            </button>
          </div>
        </div>

        {/* Custom types list */}
        {customTypes.length > 0 && (
          <div className="mb-6">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">
              Custom Types ({customTypes.length})
            </h3>
            <div className="space-y-2">
              {customTypes.map((t) => (
                <div key={t.id} className="flex items-center justify-between p-3 bg-white border border-gray-100 rounded-xl">
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: t.calendarColor || '#6b7280' }}
                    />
                    <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full flex-shrink-0 ${t.color || 'bg-gray-100 text-gray-700'}`}>
                      {t.label}
                    </span>
                    <code className="text-xs text-gray-400 font-mono truncate">{t.value}</code>
                  </div>

                  {toDelete === t.id ? (
                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      <span className="text-xs text-red-600">Remove?</span>
                      <button
                        onClick={() => handleDelete(t.id, t.label)}
                        className="text-xs text-red-600 font-semibold hover:text-red-800"
                      >
                        Yes
                      </button>
                      <button
                        onClick={() => setToDelete(null)}
                        className="text-xs text-gray-400 hover:text-gray-600"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setToDelete(t.id)}
                      className="text-xs text-red-400 hover:text-red-600 font-medium transition-colors flex-shrink-0 ml-2"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Built-in types (read-only reference) */}
        <div>
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">
            Built-in Types (read-only)
          </h3>
          <div className="grid grid-cols-2 gap-1.5">
            {DEFAULT_TYPES.filter((t) => t.value !== 'rest').map((t) => (
              <div key={t.value} className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${t.color}`}>
                  {t.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
