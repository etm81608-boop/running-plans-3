import { useMemo } from 'react'
import { useCollection } from './useCollection'
import { WORKOUT_TYPES as DEFAULT_TYPES } from '../utils/constants'
 
/**
 * Returns the merged list of workout types: built-in defaults + any custom
 * types saved in the Firestore `workoutTypes` collection.
 *
 * Custom types can override a default by using the same `value` slug.
 */
export function useWorkoutTypes() {
  const { docs: customTypes } = useCollection('workoutTypes', 'createdAt')
 
  const allTypes = useMemo(() => {
    if (!customTypes || customTypes.length === 0) return DEFAULT_TYPES
    const customValues = new Set(customTypes.map((t) => t.value))
    const filteredDefaults = DEFAULT_TYPES.filter((t) => !customValues.has(t.value))
    const mappedCustom = customTypes.map((t) => ({
      value: t.value,
      label: t.label,
      color: t.color || 'bg-gray-100 text-gray-700',
      calendarColor: t.calendarColor || '#6b7280',
      isCustom: true,
    }))
    return [...filteredDefaults, ...mappedCustom]
  }, [customTypes])
 
  return allTypes
}
