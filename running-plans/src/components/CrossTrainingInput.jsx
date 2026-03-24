/**
 * CrossTrainingInput
 * ──────────────────
 * Reusable cross-training selector used in:
 *   - AssignWorkout (coach side)
 *   - TeamGrid
 *   - Any future form that assigns CT
 *
 * Also exports:
 *   EMPTY_CT       — blank default value for forms
 *   normaliseCT()  — converts legacy CT shapes to current format
 *   ctToText()     — converts a crossTraining object to a readable string
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

// ── Exported constants / helpers ──────────────────────────────────────────────

/** Empty cross-training value — use as form default */
export const EMPTY_CT = { type: '', swimWorkoutId: '', liftOption: '', notes: '' }

/**
 * normaliseCT — converts any legacy crossTraining shape into the current
 * { type, swimWorkoutId, liftOption, notes } format.
 */
export function normaliseCT(ct) {
  if (!ct) return { ...EMPTY_CT }
  // Already new format
  if (ct.type !== undefined) {
    return {
      type:          ct.type          || '',
      swimWorkoutId: ct.swimWorkoutId || '',
      liftOption:    ct.liftOption    || '',
      notes:         ct.notes         || '',
    }
  }
  // Old boolean format: { swim: true, bike: true, ... }
  const type = ct.swim
    ? 'swim'
    : ct.bike
    ? 'bike'
    : ct.walk
    ? 'walk'
    : ct.elliptical
    ? 'elliptical'
    : ''
  return { type, swimWorkoutId: '', liftOption: '', notes: '' }
}

const CT_TYPES = [
  { value: 'swim',       label: 'Swim' },
  { value: 'bike',       label: 'Bike / Cycling' },
  { value: 'walk',       label: 'Walk' },
  { value: 'elliptical', label: 'Elliptical' },
  { value: 'lift',       label: 'Lift' },
]

// ── ctToText ──────────────────────────────────────────────────────────────────

/**
 * ctToText — converts a crossTraining object to a human-readable string.
 * Handles old boolean format and new typed format.
 */
export function ctToText(ct) {
  if (!ct) return ''

  // Old boolean format
  if (ct.type === undefined) {
    if (ct.swim)       return 'Swim'
    if (ct.bike)       return 'Bike / Cycling'
    if (ct.walk)       return 'Walk'
    if (ct.elliptical) return 'Elliptical'
    return ''
  }

  if (!ct.type) return ''

  switch (ct.type) {
    case 'swim': {
      if (ct.swimWorkoutId) {
        const w = SWIM_WORKOUTS.find((s) => s.id === ct.swimWorkoutId)
        return w ? `Swim — ${w.title}` : 'Swim'
      }
      return 'Swim'
    }
    case 'lift': {
      return ct.liftOption ? `Lift — ${ct.liftOption}` : 'Lift'
    }
    case 'bike':       return ct.notes ? `Bike / Cycling — ${ct.notes}` : 'Bike / Cycling'
    case 'walk':       return ct.notes ? `Walk — ${ct.notes}`           : 'Walk'
    case 'elliptical': return ct.notes ? `Elliptical — ${ct.notes}`     : 'Elliptical'
    default:           return ct.type
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * CrossTrainingInput
 *
 * Props:
 *   value    — crossTraining object: { type, swimWorkoutId, liftOption, notes }
 *   onChange — called with new crossTraining object whenever anything changes
 */
export default function CrossTrainingInput({ value, onChange }) {
  const ct = normaliseCT(value)

  function set(patch) {
    onChange({ ...ct, ...patch })
  }

  return (
    <div className="space-y-2">
      {/* Type selector */}
      <select
        value={ct.type}
        onChange={(e) => set({ type: e.target.value, swimWorkoutId: '', liftOption: '', notes: '' })}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
      >
        <option value="">— None —</option>
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
  )
}
