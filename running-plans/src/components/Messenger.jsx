import { useState, useRef, useEffect } from 'react'
import {
  collection, addDoc, serverTimestamp, query, orderBy, onSnapshot,
} from 'firebase/firestore'
import { db } from '../firebase/config'
import { useCollection } from '../hooks/useCollection'

// ── helpers ─────────────────────────────────────────────────────────────────

function formatTime(ts) {
  if (!ts) return ''
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  return d.toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
  })
}

function recipientLabel(msg, runners) {
  if (msg.recipientType === 'all') return 'All Runners'
  if (!msg.recipientIds || msg.recipientIds.length === 0) return 'Unknown'
  const names = msg.recipientIds.map((id) => {
    const r = runners.find((r) => r.id === id)
    return r ? r.name : id
  })
  if (names.length === 1) return names[0]
  if (names.length === 2) return names.join(' & ')
  return `${names[0]} +${names.length - 1} more`
}

// ── sub-components ───────────────────────────────────────────────────────────

function RunnerChip({ runner, onRemove }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-brand-600/20 text-brand-700 text-xs rounded-full font-medium">
      {runner.name}
      <button
        onClick={() => onRemove(runner.id)}
        className="text-brand-500 hover:text-brand-800 leading-none"
        aria-label={`Remove ${runner.name}`}
      >
        ×
      </button>
    </span>
  )
}

function RunnerDropdown({ runners, selected, onToggle, onClose }) {
  const ref = useRef(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  const filtered = runners.filter((r) =>
    r.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div
      ref={ref}
      className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-44 flex flex-col"
    >
      <div className="p-2 border-b border-gray-100">
        <input
          autoFocus
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search runners…"
          className="w-full text-sm px-2 py-1 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </div>
      <ul className="overflow-y-auto flex-1">
        {filtered.length === 0 && (
          <li className="px-3 py-2 text-xs text-gray-400">No runners found</li>
        )}
        {filtered.map((r) => {
          const checked = selected.includes(r.id)
          return (
            <li key={r.id}>
              <button
                onClick={() => onToggle(r.id)}
                className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 text-sm text-left"
              >
                <span
                  className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center ${
                    checked ? 'bg-brand-600 border-brand-600' : 'border-gray-300'
                  }`}
                >
                  {checked && (
                    <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </span>
                <span className="truncate">{r.name}</span>
                {r.grade && <span className="ml-auto text-xs text-gray-400 flex-shrink-0">Gr {r.grade}</span>}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// ── main component ───────────────────────────────────────────────────────────

export default function Messenger() {
  const [open, setOpen]           = useState(false)
  const [view, setView]           = useState('inbox') // 'inbox' | 'compose'
  const [recipientType, setRecipientType] = useState('all') // 'all' | 'select'
  const [selectedIds, setSelectedIds]     = useState([])
  const [showDropdown, setShowDropdown]   = useState(false)
  const [messageText, setMessageText]     = useState('')
  const [sending, setSending]             = useState(false)
  const [toast, setToast]                 = useState(null)
  const [sentMessages, setSentMessages]   = useState([])
  const [expandedId, setExpandedId]       = useState(null)

  const { docs: runners } = useCollection('runners', 'name')

  // Live messages feed
  useEffect(() => {
    const q = query(collection(db, 'coachMessages'), orderBy('sentAt', 'desc'))
    const unsub = onSnapshot(q, (snap) => {
      setSentMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    })
    return unsub
  }, [])

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  function toggleRunner(id) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  function removeRunner(id) {
    setSelectedIds((prev) => prev.filter((x) => x !== id))
  }

  function resetCompose() {
    setRecipientType('all')
    setSelectedIds([])
    setMessageText('')
    setShowDropdown(false)
  }

  async function handleSend() {
    if (!messageText.trim()) return
    if (recipientType === 'select' && selectedIds.length === 0) {
      showToast('Please select at least one runner.', 'error')
      return
    }

    setSending(true)
    try {
      await addDoc(collection(db, 'coachMessages'), {
        recipientType,
        recipientIds: recipientType === 'all' ? [] : selectedIds,
        text: messageText.trim(),
        sentAt: serverTimestamp(),
      })
      resetCompose()
      setView('inbox')
      showToast('Message sent!')
    } catch (err) {
      showToast('Failed to send: ' + err.message, 'error')
    } finally {
      setSending(false)
    }
  }

  const selectedRunners = runners.filter((r) => selectedIds.includes(r.id))

  return (
    <>
      {/* ── Floating toggle button ── */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-5 right-5 z-40 w-12 h-12 rounded-full bg-brand-600 text-white shadow-lg hover:bg-brand-700 active:scale-95 transition-all flex items-center justify-center"
        title="Coach Messenger"
      >
        {open ? (
          // X icon
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          // Chat bubble icon
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M21 16c0 1.1-.9 2-2 2H7l-4 4V6c0-1.1.9-2 2-2h14c1.1 0 2 .9 2 2v10z" />
          </svg>
        )}
        {/* Unread badge (count of messages today) */}
        {!open && sentMessages.length > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center font-bold leading-none">
            {sentMessages.length > 99 ? '99+' : sentMessages.length}
          </span>
        )}
      </button>

      {/* ── Panel ── */}
      {open && (
        <div className="fixed bottom-20 right-5 z-40 w-80 bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden"
          style={{ maxHeight: '520px' }}
        >
          {/* Header */}
          <div className="bg-gray-950 px-4 py-3 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M21 16c0 1.1-.9 2-2 2H7l-4 4V6c0-1.1.9-2 2-2h14c1.1 0 2 .9 2 2v10z" />
              </svg>
              <span className="text-white font-semibold text-sm">Coach Messenger</span>
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => { setView('inbox'); resetCompose() }}
                className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${
                  view === 'inbox' ? 'bg-brand-600 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                Sent
              </button>
              <button
                onClick={() => setView('compose')}
                className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${
                  view === 'compose' ? 'bg-brand-600 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                + New
              </button>
            </div>
          </div>

          {/* ── COMPOSE VIEW ── */}
          {view === 'compose' && (
            <div className="flex flex-col flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto p-4 space-y-4">

                {/* Recipient selector */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">To</label>
                  <div className="flex gap-2 mb-2">
                    <button
                      onClick={() => { setRecipientType('all'); setSelectedIds([]) }}
                      className={`flex-1 text-xs py-1.5 rounded-lg border font-medium transition-colors ${
                        recipientType === 'all'
                          ? 'bg-brand-600 border-brand-600 text-white'
                          : 'border-gray-200 text-gray-600 hover:border-brand-400'
                      }`}
                    >
                      All Runners
                    </button>
                    <button
                      onClick={() => setRecipientType('select')}
                      className={`flex-1 text-xs py-1.5 rounded-lg border font-medium transition-colors ${
                        recipientType === 'select'
                          ? 'bg-brand-600 border-brand-600 text-white'
                          : 'border-gray-200 text-gray-600 hover:border-brand-400'
                      }`}
                    >
                      Choose Runners
                    </button>
                  </div>

                  {/* Runner picker */}
                  {recipientType === 'select' && (
                    <div className="relative">
                      {/* Selected chips */}
                      <div className="min-h-[32px] flex flex-wrap gap-1 mb-1">
                        {selectedRunners.map((r) => (
                          <RunnerChip key={r.id} runner={r} onRemove={removeRunner} />
                        ))}
                      </div>
                      <button
                        onClick={() => setShowDropdown((v) => !v)}
                        className="w-full text-left text-xs px-3 py-1.5 border border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-brand-400 hover:text-brand-600 transition-colors"
                      >
                        {selectedIds.length === 0
                          ? '+ Select runners…'
                          : `+ Add more (${runners.length - selectedIds.length} remaining)`}
                      </button>
                      {showDropdown && (
                        <RunnerDropdown
                          runners={runners}
                          selected={selectedIds}
                          onToggle={toggleRunner}
                          onClose={() => setShowDropdown(false)}
                        />
                      )}
                    </div>
                  )}
                </div>

                {/* Message body */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Message</label>
                  <textarea
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    placeholder="Write your note to the team…"
                    rows={5}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  />
                  <p className="text-right text-xs text-gray-400 mt-0.5">{messageText.length} chars</p>
                </div>
              </div>

              {/* Send button */}
              <div className="px-4 py-3 border-t border-gray-100 flex-shrink-0">
                <button
                  onClick={handleSend}
                  disabled={sending || !messageText.trim() || (recipientType === 'select' && selectedIds.length === 0)}
                  className="w-full py-2 rounded-xl bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {sending ? (
                    <>
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
                      </svg>
                      Sending…
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                      Send Message
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* ── INBOX / SENT VIEW ── */}
          {view === 'inbox' && (
            <div className="flex-1 overflow-y-auto">
              {sentMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center p-6 text-gray-400">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mb-2 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M21 16c0 1.1-.9 2-2 2H7l-4 4V6c0-1.1.9-2 2-2h14c1.1 0 2 .9 2 2v10z" />
                  </svg>
                  <p className="text-sm font-medium">No messages yet</p>
                  <p className="text-xs mt-1">Tap "+ New" to send your first note.</p>
                </div>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {sentMessages.map((msg) => {
                    const isExpanded = expandedId === msg.id
                    return (
                      <li key={msg.id}>
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : msg.id)}
                          className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              {/* icon */}
                              {msg.recipientType === 'all' ? (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-brand-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a4 4 0 00-5-3.87M9 20H4v-2a4 4 0 015-3.87m6-4a4 4 0 11-8 0 4 4 0 018 0zm6 4a2 2 0 100-4 2 2 0 000 4zM3 16a2 2 0 100-4 2 2 0 000 4z" />
                                </svg>
                              ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                              )}
                              <span className="text-xs font-semibold text-gray-700 truncate">
                                {recipientLabel(msg, runners)}
                              </span>
                            </div>
                            <span className="text-xs text-gray-400 flex-shrink-0">{formatTime(msg.sentAt)}</span>
                          </div>
                          <p className={`text-xs text-gray-500 mt-1 leading-relaxed ${isExpanded ? '' : 'line-clamp-2'}`}>
                            {msg.text}
                          </p>
                          {!isExpanded && msg.text.length > 80 && (
                            <span className="text-xs text-brand-600 font-medium mt-0.5 inline-block">Read more</span>
                          )}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Toast ── */}
      {toast && (
        <div className={`fixed bottom-20 right-5 z-50 px-4 py-2.5 rounded-xl text-sm font-medium shadow-lg pointer-events-none transition-all ${
          toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-green-600 text-white'
        }`}>
          {toast.msg}
        </div>
      )}
    </>
  )
}
