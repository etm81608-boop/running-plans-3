/**
 * CrossTrainingInput
 * ──────────────────
 * Reusable cross-training selector used in:
 *   - AssignWorkout (bulk assign)
 *   - TeamGrid
 *   - CalendarPage
 *
 * v2: supports multiple cross-training items per workout.
 * The value prop is now an ARRAY of CT objects:
 *   [{ type, swimWorkoutId, liftOption, notes }, ...]
 *
 * Exported helpers:
 *   EMPTY_CT       — blank single-item object (for internal + legacy use)
 *   normaliseCT()  — converts any legacy CT shape to an array
 *   ctToText()     — converts a CT value (array or old object) to a readable string
 */

import { SWIM_WORKOUTS }     from '../data/swimWorkouts'
import { STRENGTH_WORKOUTS } from '../data/strengthWorkouts'

// ── Lift options ──────────────────────────────────────────────────────────────
const LIFT_OPTIONS = [
  'Mobility',
  'Heavy Lift',
  'Light Lift',
  'Body Weight',
  ...STRENGTH_WORKOUTS.map((w) => w.title),
]

const CT_TYPES = [
  { value: 'swim',       label: 'Swim' },
  { value: 'bike',       label: 'Bike / Cycling' },
  { value: 'walk',       label: 'Walk' },
  { value: 'elliptical', label: 'Elliptical' },
  { value: 'lift',       label: 'Lift' },
]

// ── Exported constants ────────────────────────────────────────────────────────

/** Blank single CT item — used as default when adding a new entry */
export const EMPTY_CT = { type: '', swimWorkoutId: '', liftOption: '', notes: '' }

// ── Internal helpers ──────────────────────────────────────────────────────────

function normaliseSingle(ct) {
  if (!ct) return { ...EMPTY_CT }
  return {
    type:          ct.type          || '',
    swimWorkoutId: ct.swimWorkoutId || '',
    liftOption:    ct.liftOption    || '',
    notes:         ct.notes         || '',
  }
}

function ctItemToText(ct) {
  if (!ct || !ct.type) return ''
  switch (ct.type) {
    case 'swim': {
      if (ct.swimWorkoutId) {
        const w = SWIM_WORKOUTS.find((s) => s.id === ct.swimWorkoutId)
        return w ? `Swim — ${w.title}` : 'Swim'
      }
      return 'Swim'
    }
    case 'lift':       return ct.liftOption ? `Lift — ${ct.liftOption}` : 'Lift'
    case 'bike':       return ct.notes ? `Bike / Cycling — ${ct.notes}` : 'Bike / Cycling'
    case 'walk':       return ct.notes ? `Walk — ${ct.notes}`           : 'Walk'
    case 'elliptical': return ct.notes ? `Elliptical — ${ct.notes}`     : 'Elliptical'
    default:           return ct.type
  }
}

// ── Exported helpers ──────────────────────────────────────────────────────────

/**
 * normaliseCT — converts any CT value to an array of normalised items.
 * Handles: array (new), single object (legacy typed), boolean object (old legacy).
 */
export function normaliseCT(ct) {
  if (!ct) return []
  // New format — already an array
  if (Array.isArray(ct)) return ct.map(normaliseSingle).filter((item) => item.type)
  // Legacy typed format — single object { type, ... }
  if (ct.type !== undefined) {
    const item = normaliseSingle(ct)
    return item.type ? [item] : []
  }
  // Old boolean format: { swim: true, bike: true, ... }
  const type = ct.swim ? 'swim' : ct.bike ? 'bike' : ct.walk ? 'walk' : ct.elliptical ? 'elliptical' : ''
  return type ? [{ type, swimWorkoutId: '', liftOption: '', notes: '' }] : []
}

/**
 * ctToText — converts any CT value to a human-readable string.
 * Multiple items are joined with " · ".
 */
export function ctToText(ct) {
  if (!ct) return ''
  // Old boolean format
  if (!Array.isArray(ct) && ct.type === undefined) {
    if (ct.swim)       return 'Swim'
    if (ct.bike)       return 'Bike / Cycling'
    if (ct.walk)       return 'Walk'
    if (ct.elliptical) return 'Elliptical'
    return ''
  }
  const items = Array.isArray(ct) ? ct : [ct]
  return items.map(ctItemToText).filter(Boolean).join(' · ')
}

// ── Single-item row ───────────────────────────────────────────────────────────

function CTItem({ ct, onChange, onRemove, showRemove }) {
  function set(patch) {
    onChange({ ...ct, ...patch })
  }

  return (
    <div className="flex gap-2 items-start">
      <div className="flex-1 space-y-2">
        {/* Type selector */}
        <select
          value={ct.type}
          onChange={(e) => set({ type: e.target.value, swimWorkoutId: '', liftOption: '', notes: '' })}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
        >
          <option value="">— Select type —</option>
          {CT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>

        {/* Swim sub-selector */}
        {ct.type === 'swim' && (
          <select
            value={ct.swimWorkoutId}
            onChange={(e) => set({ swimWorkoutId: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          >
            <option value="">— Select swim workout —</option>
            {SWIM_WORKOUTS.map((w) => (
              <option key={w.id} value={w.id}>
                {w.title}{w.subtitle ? ` · ${w.subtitle}` : ''}
              </option>
            ))}
          </select>
        )}

        {/* Lift sub-selector */}
        {ct.type === 'lift' && (
          <select
            value={ct.liftOption}
            onChange={(e) => set({ liftOption: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          >
            <option value="">— Select lift option —</option>
            {LIFT_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        )}

        {/* Notes / duration for bike, walk, elliptical */}
        {(ct.type === 'bike' || ct.type === 'walk' || ct.type === 'elliptical') && (
          <input
            type="text"
            placeholder="Duration or notes (optional)"
            value={ct.notes}
            onChange={(e) => set({ notes: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        )}
      </div>

      {/* Remove button */}
      {showRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="mt-2 w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0"
          title="Remove"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

/**
 * CrossTrainingInput
 *
 * Props:
 *   value    — array of CT objects: [{ type, swimWorkoutId, liftOption, notes }, ...]
 *   onChange — called with the updated array whenever anything changes
 */
export default function CrossTrainingInput({ value, onChange }) {
  // Always work with an array internally
  const items = Array.isArray(value) ? value : normaliseCT(value)

  function updateItem(idx, patch) {
    const next = items.map((item, i) => i === idx ? { ...item, ...patch } : item)
    onChange(next)
  }

  function removeItem(idx) {
    onChange(items.filter((_, i) => i !== idx))
  }

  function addItem() {
    onChange([...items, { ...EMPTY_CT }])
  }

  return (
    <div className="space-y-3">
      {items.length === 0 && (
        <p className="text-xs text-gray-400 italic">No cross training selected.</p>
      )}

      {items.map((ct, idx) => (
        <CTItem
          key={idx}
          ct={normaliseSingle(ct)}
          onChange={(patch) => updateItem(idx, patch)}
          onRemove={() => removeItem(idx)}
          showRemove={true}
        />
      ))}

      <button
        type="button"
        onClick={addItem}
        className="flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Add Cross Training
      </button>
    </div>
  )
}
