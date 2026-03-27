import { useState, useEffect } from 'react'
import {
  collection, query, orderBy, onSnapshot,
} from 'firebase/firestore'
import { db } from '../firebase/config'

function formatTime(ts) {
  if (!ts) return ''
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  return d.toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
  })
}

export default function RunnerMessenger({ runnerId }) {
  const [open, setOpen]       = useState(false)
  const [messages, setMessages] = useState([])
  const [expandedId, setExpandedId] = useState(null)

  // Live feed filtered to this runner
  useEffect(() => {
    const q = query(collection(db, 'coachMessages'), orderBy('sentAt', 'desc'))
    const unsub = onSnapshot(q, (snap) => {
      const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      const relevant = all.filter((m) =>
        m.recipientType === 'all' ||
        (Array.isArray(m.recipientIds) && m.recipientIds.includes(runnerId))
      )
      setMessages(relevant)
    })
    return unsub
  }, [runnerId])

  const unread = messages.length

  return (
    <>
      {/* ── Floating toggle button ── */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-5 right-5 z-40 w-12 h-12 rounded-full bg-rose-700 text-white shadow-lg hover:bg-rose-800 active:scale-95 transition-all flex items-center justify-center"
        title="Messages from Coach"
      >
        {open ? (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M21 16c0 1.1-.9 2-2 2H7l-4 4V6c0-1.1.9-2 2-2h14c1.1 0 2 .9 2 2v10z" />
          </svg>
        )}
        {!open && unread > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center font-bold leading-none">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {/* ── Panel ── */}
      {open && (
        <div
          className="fixed bottom-20 right-5 z-40 w-80 bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden"
          style={{ maxHeight: '480px' }}
        >
          {/* Header */}
          <div className="bg-rose-900 px-4 py-3 flex items-center gap-2 flex-shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-rose-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M21 16c0 1.1-.9 2-2 2H7l-4 4V6c0-1.1.9-2 2-2h14c1.1 0 2 .9 2 2v10z" />
            </svg>
            <span className="text-white font-semibold text-sm">Messages from Coach</span>
          </div>

          {/* Message list */}
          <div className="flex-1 overflow-y-auto">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-6 text-gray-400" style={{ minHeight: '160px' }}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mb-2 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M21 16c0 1.1-.9 2-2 2H7l-4 4V6c0-1.1.9-2 2-2h14c1.1 0 2 .9 2 2v10z" />
                </svg>
                <p className="text-sm font-medium">No messages yet</p>
                <p className="text-xs mt-1">Your coach hasn't sent any notes.</p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {messages.map((msg) => {
                  const isExpanded = expandedId === msg.id
                  return (
                    <li key={msg.id}>
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : msg.id)}
                        className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-xs font-semibold text-rose-800">
                            {msg.recipientType === 'all' ? 'To: All Runners' : 'To: You'}
                          </span>
                          <span className="text-xs text-gray-400 flex-shrink-0">{formatTime(msg.sentAt)}</span>
                        </div>
                        <p className={`text-xs text-gray-600 leading-relaxed ${isExpanded ? '' : 'line-clamp-2'}`}>
                          {msg.text}
                        </p>
                        {!isExpanded && msg.text.length > 80 && (
                          <span className="text-xs text-rose-700 font-medium mt-0.5 inline-block">Read more</span>
                        )}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </>
  )
}
