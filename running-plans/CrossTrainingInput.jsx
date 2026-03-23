// Shared cross-training component used in CalendarPage, TeamGrid, and AssignWorkout
// Stores structured data: { swim: {enabled, details}, bike: {...}, walk: {...}, elliptical: {...} }

export const CT_TYPES = [
  { id: 'swim',       label: 'Swim',       emoji: '🏊', placeholder: 'e.g. 45 min easy, drills, kick sets' },
  { id: 'bike',       label: 'Bike',       emoji: '🚴', placeholder: 'e.g. 30 min moderate, spin class' },
  { id: 'walk',       label: 'Walk',       emoji: '🚶', placeholder: 'e.g. 20 min recovery walk' },
  { id: 'elliptical', label: 'Elliptical', emoji: '⚙️', placeholder: 'e.g. 30 min, low resistance' },
]

export const EMPTY_CT = {
  swim:       { enabled: false, details: '' },
  bike:       { enabled: false, details: '' },
  walk:       { enabled: false, details: '' },
  elliptical: { enabled: false, details: '' },
}

// Converts a structured CT object to a readable display string
export function ctToText(ct) {
  if (!ct || typeof ct === 'string') return ct || ''
  return CT_TYPES
    .filter((t) => ct[t.id]?.enabled)
    .map((t) => `${t.emoji} ${t.label}${ct[t.id].details ? ': ' + ct[t.id].details : ''}`)
    .join(' · ')
}

// Normalise a value that might be an old string or a new CT object
export function normaliseCT(val) {
  if (!val) return { ...EMPTY_CT }
  if (typeof val === 'string') return { ...EMPTY_CT } // legacy string — start fresh
  return val
}

export default function CrossTrainingInput({ value, onChange }) {
  const ct = value && typeof value === 'object' ? value : EMPTY_CT

  function toggle(id) {
    onChange({ ...ct, [id]: { ...ct[id], enabled: !ct[id]?.enabled } })
  }

  function setDetails(id, details) {
    onChange({ ...ct, [id]: { ...ct[id], details } })
  }

  const anyChecked = CT_TYPES.some((t) => ct[t.id]?.enabled)

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        {CT_TYPES.map(({ id, label, emoji }) => (
          <label key={id} className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
            ct[id]?.enabled
              ? 'bg-teal-50 border-teal-300 text-teal-800'
              : 'bg-white border-gray-200 text-gray-600 hover:border-teal-200'
          }`}>
            <input
              type="checkbox"
              checked={ct[id]?.enabled || false}
              onChange={() => toggle(id)}
              className="w-4 h-4 text-teal-600 rounded"
            />
            <span className="text-sm font-medium">{emoji} {label}</span>
          </label>
        ))}
      </div>

      {anyChecked && (
        <div className="space-y-2 pt-1">
          {CT_TYPES.filter((t) => ct[t.id]?.enabled).map(({ id, label, emoji, placeholder }) => (
            <div key={id} className="flex items-center gap-2">
              <span className="text-sm text-gray-500 w-24 flex-shrink-0">{emoji} {label}</span>
              <input
                type="text"
                className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                placeholder={placeholder}
                value={ct[id]?.details || ''}
                onChange={(e) => setDetails(id, e.target.value)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
