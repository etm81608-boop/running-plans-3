// Shared helpers for season buckets and school-year grade advancement.

export const SEASONS = [
  { key: 'xc',     label: 'Cross Country', short: 'XC',     dot: '#ea580c' },
  { key: 'winter', label: 'Winter Track',  short: 'Winter', dot: '#2563eb' },
  { key: 'spring', label: 'Spring Track',  short: 'Spring', dot: '#16a34a' },
]

/** Guess the "current" season from the calendar date.
 *  XC:     Aug–Nov
 *  Winter: Dec–Mar
 *  Spring: Apr–Jul
 */
export function getCurrentSeason(date = new Date()) {
  const m = date.getMonth() // 0 = Jan
  if (m >= 7 && m <= 10) return 'xc'      // Aug–Nov
  if (m === 11 || m <= 2) return 'winter' // Dec–Mar
  return 'spring'                          // Apr–Jul
}

/** Return the starting calendar year of the current school year.
 *  2026-2027 school year → 2026. Flips over August 1.
 */
export function currentSchoolYear(date = new Date()) {
  return date.getMonth() >= 7 ? date.getFullYear() : date.getFullYear() - 1
}

/** What grade is a runner *now*, given when the grade was last entered?
 *  Advances the stored grade by one per school year that has passed.
 *  Caps at 12.
 */
export function effectiveGrade(runner) {
  if (!runner || runner.grade === '' || runner.grade == null) return ''
  const base = parseInt(runner.grade, 10)
  if (isNaN(base)) return runner.grade
  const setYear = runner.gradeSetYear ?? currentSchoolYear()
  const advance = currentSchoolYear() - setYear
  return Math.min(12, base + advance)
}

/** Has this runner's effective grade surpassed 12? (= should be archived) */
export function hasGraduated(runner) {
  if (!runner || runner.grade === '' || runner.grade == null) return false
  const base = parseInt(runner.grade, 10)
  if (isNaN(base)) return false
  const setYear = runner.gradeSetYear ?? currentSchoolYear()
  return base + (currentSchoolYear() - setYear) > 12
}

/** Filter a runners list to one season bucket, excluding archived. */
export function filterBySeason(runners, season) {
  if (!season || season === 'all') return runners.filter((r) => !r.archived)
  return runners.filter((r) => !r.archived && r.seasons?.[season])
}
