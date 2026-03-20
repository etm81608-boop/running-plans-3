import emailjs from '@emailjs/browser'

const SERVICE_ID  = import.meta.env.VITE_EMAILJS_SERVICE_ID
const TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID
const PUBLIC_KEY  = import.meta.env.VITE_EMAILJS_PUBLIC_KEY
const APP_URL     = import.meta.env.VITE_APP_URL  || window.location.origin
const COACH_NAME  = import.meta.env.VITE_COACH_NAME || 'Coach'

/**
 * Sends a workout email to a single runner.
 *
 * @param {object} runner        - Runner document from Firestore
 * @param {object} workout       - Workout document
 * @param {string} assignmentId  - Firestore assignment document ID (used as share token)
 * @param {string} dateStr       - Human-readable date string, e.g. "March 25, 2026"
 * @param {string} notes         - Optional assignment notes from coach
 */
export async function sendWorkoutEmail(runner, workout, assignmentId, dateStr, notes = '') {
  if (!SERVICE_ID || !TEMPLATE_ID || !PUBLIC_KEY) {
    throw new Error(
      'EmailJS is not configured. Please add VITE_EMAILJS_* variables to your .env file.'
    )
  }

  const workoutLink = `${APP_URL}/#/workout/${assignmentId}`

  const templateParams = {
    runner_name:      runner.name,
    runner_email:     runner.email,
    coach_name:       COACH_NAME,
    workout_date:     dateStr,
    workout_title:    workout.title,
    workout_type:     workout.type,
    workout_details:  workout.description || '',
    workout_notes:    notes,
    workout_link:     workoutLink,
  }

  return emailjs.send(SERVICE_ID, TEMPLATE_ID, templateParams, PUBLIC_KEY)
}
