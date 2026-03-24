export const EVENTS = [
  '100m', '200m', '400m', '800m', '1500m / 1 Mile',
  '3000m / 2 Mile', '5K / 3 Mile', 'Steeplechase',
  '100m Hurdles', '400m Hurdles', 'Long Jump', 'High Jump',
  'Triple Jump', 'Pole Vault', 'Shot Put', 'Discus',
  'Javelin', 'Hammer', 'Pentathlon / Heptathlon',
  'Cross Country 5K', 'Multi-Event', 'Distance (General)',
]

export const GRADES = ['9', '10', '11', '12']

export const WORKOUT_TYPES = [
  { value: 'easy',       label: 'Easy Run',          color: 'bg-green-100 text-green-800'   },
  { value: 'tempo',      label: 'Tempo / Threshold',  color: 'bg-orange-100 text-orange-800' },
  { value: 'interval',   label: 'Interval / Track',   color: 'bg-red-100 text-red-800'       },
  { value: 'long',       label: 'Long Run',           color: 'bg-purple-100 text-purple-800' },
  { value: 'race',       label: 'Race',               color: 'bg-yellow-100 text-yellow-800' },
  { value: 'strength',   label: 'Strength / XT',      color: 'bg-teal-100 text-teal-800'     },
  { value: 'time_trial', label: 'Time Trial',         color: 'bg-blue-100 text-blue-800'     },
  { value: 'off_day',    label: 'Off Day',            color: 'bg-slate-100 text-slate-600'   },
  { value: 'recovery',   label: 'Rest & Recovery',    color: 'bg-gray-100 text-gray-700'     },
  // legacy — kept so existing assignments still display correctly
  { value: 'rest',       label: 'Rest / Recovery',    color: 'bg-gray-100 text-gray-700'     },
]

export const WORKOUT_TYPE_CALENDAR_COLORS = {
  easy:       '#22c55e',
  tempo:      '#f97316',
  interval:   '#ef4444',
  long:       '#a855f7',
  race:       '#eab308',
  strength:   '#14b8a6',
  rest:       '#9ca3af',
  time_trial: '#3b82f6',
  off_day:    '#94a3b8',
  recovery:   '#9ca3af',
}

// Cross-training options for the Lift category
export const LIFT_OPTIONS = [
  'Mobility',
  'Heavy Lift',
  'Body Weight',
]

export function getWorkoutTypeLabel(value) {
  return WORKOUT_TYPES.find((t) => t.value === value)?.label ?? value
}

export function getWorkoutTypeColor(value) {
  return WORKOUT_TYPES.find((t) => t.value === value)?.color ?? 'bg-gray-100 text-gray-700'
}

export function getWorkoutCalendarColor(value) {
  return WORKOUT_TYPE_CALENDAR_COLORS[value] ?? '#6366f1'
}
