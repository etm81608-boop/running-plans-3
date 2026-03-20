import { useEffect } from 'react'

/**
 * Simple toast notification.
 * Props:
 *   message  {string}
 *   type     {'success'|'error'|'info'}
 *   onClose  {() => void}
 */
export default function Toast({ message, type = 'success', onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000)
    return () => clearTimeout(t)
  }, [onClose])

  const styles = {
    success: 'bg-emerald-600',
    error:   'bg-red-600',
    info:    'bg-brand-600',
  }

  return (
    <div className={`fixed bottom-6 right-6 z-[100] flex items-center gap-3 px-5 py-3 rounded-xl text-white shadow-xl ${styles[type]}`}>
      <span className="text-sm font-medium">{message}</span>
      <button onClick={onClose} className="ml-1 opacity-70 hover:opacity-100">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}
