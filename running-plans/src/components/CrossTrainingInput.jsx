/**
 * CrossTrainingInput
 * ──────────────────
 * Reusable cross-training selector used in:
 *   - AssignWorkout (coach side)
 *   - Any future form that assigns CT
 *
 * Also exports `ctToText(ct)` — converts a crossTraining object
 * to a human-readable string, used by RunnerPage and RunnerLogs.
 */

import { SWIM_WORKOUTS }   from '../data/swimWorkouts'
import { STRENGTH_WORKOUTS } from '../data/strengthWorkouts'

// ── Lift options ──────────────────────────────────────────────────────────────
// General categories come first, then the named strength workouts from the
// strength page so the two stay in sync automatically.
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
  const type = ct.swim ? 'swim' : ct.bike ? 'bike' : ct.walk ? 'walk' : ct.elliptical ? 'elliptical' : ''
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
// Accepts the crossTraining field from a Firestore assignment doc.
// Handles both the old object format and the new { type, ... } format.
export function ctToText(ct) {
  if (!ct) return ''

  // Very old format: { swim: true/false, bike: true/false, ... }
  if (ct.swim === true || ct.bike === true || ct.walk === true || ct.elliptical === true) {
    return [ct.swim && 'Swim', ct.bike && 'Bike', ct.walk && 'Walk', ct.elliptical && 'Elliptical']
      .filter(Boolean).join(', ')
  }

  // Old string format: { type: 'lift', liftOption: '...' } (no swimWorkoutId)
  // New format: { type: 'swim', swimWorkoutId: '...', liftOption: '...', notes: '...' }
  if (!ct.type) return ''

  switch (ct.type) {
    case 'swim': {
      const wo = SWIM_WORKOUTS.find((w) => w.id === ct.swimWorkoutId)
      return wo ? `Swim — ${wo.title}` : 'Swim'
    }
    case 'lift':
      return ct.liftOption ? `Lift — ${ct.liftOption}` : 'Lift'
    case 'bike':
      return ct.notes ? `Bike / Cycling · ${ct.notes}` : 'Bike / Cycling'
    case 'walk':
      return ct.notes ? `Walk · ${ct.notes}` : 'Walk'
    case 'elliptical':
      return ct.notes ? `Elliptical · ${ct.notes}` : 'Elliptical'
    default:
      return ct.type || ''
  }
}

// ── Component ─────────────────────────────────────────────────────────────────
// value shape: { type, swimWorkoutId, liftOption, notes }
// onChange: (newValue) => void
export default function CrossTrainingInput({ value = {}, onChange }) {
  function set(field, val) {
    onChange({ ...value, [field]: val })
  }

  function changeType(newType) {
    onChange({ type: newType, swimWorkoutId: '', liftOption: '', notes: '' })
  }

  return (
    <div className="space-y-3">

      {/* Type */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
        <select
          value={value.type || ''}
          onChange={(e) => changeType(e.target.value)}
          className="w-full sm:w-72 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white"
        >
          <option value="">— none —</option>
          {CT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      {/* Swim workout sub-dropdown */}
      {value.type === 'swim' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Swim Workout</label>
          <select
            value={value.swimWorkoutId || ''}
            onChange={(e) => set('swimWorkoutId', e.target.value)}
            className="w-full sm:w-72 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white"
          >
            <option value="">— choose swim workout —</option>
            {SWIM_WORKOUTS.map((w) => (
              <option key={w.id} value={w.id}>{w.title} · {w.subtitle}</option>
            ))}
          </select>
        </div>
      )}

      {/* Lift sub-dropdown */}
      {value.type === 'lift' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Lift Type</label>
          <select
            value={value.liftOption || ''}
            onChange={(e) => set('liftOption', e.target.value)}
            className="w-full sm:w-72 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white"
          >
            <option value="">— choose lift —</option>
            {LIFT_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>
      )}

      {/* Duration / notes for all other types */}
      {value.type && value.type !== 'swim' && value.type !== 'lift' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Duration / Notes</label>
          <input
            type="text"
            value={value.notes || ''}
            onChange={(e) => set('notes', e.target.value)}
            placeholder="e.g. 30 min easy"
            className="w-full sm:w-72 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
          />
        </div>
      )}
    </div>
  )
}
