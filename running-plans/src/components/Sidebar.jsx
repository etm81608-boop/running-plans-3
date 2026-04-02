import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useMessenger } from '../contexts/MessengerContext'

// ── Nav groups ─────────────────────────────────────────────────────────────────

const NAV_GROUPS = [
  {
    id: 'team',
    label: 'Team',
    items: [
      {
        to: '/', label: 'Dashboard', end: true,
        icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7m-9 5v6m4-6v6m5-10l2 2" /></svg>,
      },
      {
        to: '/roster', label: 'Roster',
        icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a4 4 0 00-5-3.87M9 20H4v-2a4 4 0 015-3.87m6-4a4 4 0 11-8 0 4 4 0 018 0zm6 4a2 2 0 100-4 2 2 0 000 4zM3 16a2 2 0 100-4 2 2 0 000 4z" /></svg>,
      },
      {
        to: '/groups', label: 'Groups',
        icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14v6m-3-3h6M6 10h2a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v2a2 2 0 002 2zm10 0h2a2 2 0 002-2V6a2 2 0 00-2-2h-2a2 2 0 00-2 2v2a2 2 0 002 2zM6 20h2a2 2 0 002-2v-2a2 2 0 00-2-2H6a2 2 0 00-2 2v2a2 2 0 002 2z" /></svg>,
      },
    ],
  },
  {
    id: 'planning',
    label: 'Planning',
    items: [
      {
        to: '/calendar', label: 'Master Calendar',
        icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
      },
      {
        to: '/team-grid', label: 'Team Grid',
        icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18M10 3v18M14 3v18" /></svg>,
      },
      {
        to: '/assign', label: 'Bulk Assign',
        icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>,
      },
    ],
  },
  {
    id: 'workouts',
    label: 'Workouts',
    items: [
      {
        to: '/workouts', label: 'Templates',
        icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>,
      },
      {
        to: '/strength-workouts', label: 'Strength',
        icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" /></svg>,
      },
      {
        to: '/swim-workouts', label: 'Swim',
        icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-4.9-6H7a4 4 0 00-4 4z" /></svg>,
      },
    ],
  },
  {
    id: 'reports',
    label: 'Reports',
    items: [
      {
        to: '/meets', label: 'Meet Schedule',
        icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" /></svg>,
      },
      {
        to: '/logs', label: 'Runner Logs',
        icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
      },
      {
        to: '/export', label: 'Data Export',
        icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>,
      },
    ],
  },
  {
    id: 'admin',
    label: 'Admin',
    items: [
      {
        to: '/settings', label: 'Settings',
        icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
      },
    ],
  },
]

// ── Sidebar ─────────────────────────────────────────────────────────────────────

export default function Sidebar() {
  const { logout, currentUser } = useAuth()
  const { setOpen: openMessenger } = useMessenger()
  const [collapsed, setCollapsed] = useState(false)
  const [openGroups, setOpenGroups] = useState({ team: true, planning: true, workouts: true, reports: true, admin: true })

  function toggleGroup(id) {
    if (collapsed) return // groups don't collapse when sidebar is icon-only
    setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <aside
      className="flex-shrink-0 text-white flex flex-col h-screen sticky top-0 transition-all duration-200 border-r border-emerald-900"
      style={{ width: collapsed ? '56px' : '200px', background: 'linear-gradient(180deg, #052e16 0%, #022c22 60%, #083344 100%)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-emerald-900/70 min-h-[56px]">
        {!collapsed && (
          <div className="flex items-center gap-2 min-w-0">
            <img
              src="https://resources.finalsite.net/images/v1752766793/episcopalacademypa/iki09ehlwxicgcugftmq/sheid_full.svg"
              alt="EA"
              className="w-7 h-7 object-contain flex-shrink-0"
              onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex' }}
            />
            <div style={{ display: 'none' }} className="w-7 h-7 bg-white rounded flex items-center justify-center flex-shrink-0">
              <span className="text-gray-900 font-black text-xs">EA</span>
            </div>
            <div className="min-w-0">
              <p className="font-bold text-xs text-white leading-tight truncate">Episcopal Academy</p>
              <p className="text-emerald-400 text-xs leading-tight truncate">Track & Cross Country</p>
            </div>
          </div>
        )}
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="flex-shrink-0 w-7 h-7 flex items-center justify-center text-emerald-500 hover:text-white hover:bg-emerald-900/60 transition-colors"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            {collapsed
              ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            }
          </svg>
        </button>
      </div>

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto py-2">
        {NAV_GROUPS.map((group) => {
          const isOpen = collapsed ? true : openGroups[group.id]

          return (
            <div key={group.id} className="mb-1">

              {/* Group header (hidden when collapsed) */}
              {!collapsed && (
                <button
                  onClick={() => toggleGroup(group.id)}
                  className="w-full flex items-center justify-between px-3 py-1.5 text-left group"
                >
                  <span className="text-xs font-bold text-emerald-500 uppercase tracking-widest group-hover:text-emerald-300 transition-colors">
                    {group.label}
                  </span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className={`h-3 w-3 text-emerald-700 transition-transform ${isOpen ? '' : '-rotate-90'}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              )}

              {/* Nav items */}
              {isOpen && (
                <div className={collapsed ? 'px-1.5 space-y-0.5' : 'px-2 space-y-0.5'}>
                  {group.items.map(({ to, label, icon, end }) => (
                    <NavLink
                      key={to}
                      to={to}
                      end={end}
                      title={collapsed ? label : undefined}
                      className={({ isActive }) =>
                        `flex items-center gap-2.5 text-sm font-medium transition-colors ${
                          collapsed ? 'justify-center px-0 py-2' : 'px-2 py-1.5'
                        } ${
                          isActive
                            ? 'text-white bg-emerald-700/70 border-l-2 border-emerald-400'
                            : 'text-emerald-200/70 hover:text-white hover:bg-emerald-900/50 border-l-2 border-transparent'
                        }`
                      }
                    >
                      <span className="flex-shrink-0">{icon}</span>
                      {!collapsed && <span className="truncate">{label}</span>}
                    </NavLink>
                  ))}
                </div>
              )}

              {/* Divider between groups */}
              {!collapsed && <div className="mx-3 mt-2 border-t border-emerald-900/60" />}
            </div>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-2 py-3 border-t border-emerald-900/70">
        {/* Messages button */}
        <button
          onClick={() => openMessenger(true)}
          title="Messages"
          className={`flex items-center gap-2 text-sm text-emerald-300 hover:text-white transition-colors w-full mb-1 ${collapsed ? 'justify-center py-2' : 'px-2 py-1.5 hover:bg-emerald-900/50'}`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M21 16c0 1.1-.9 2-2 2H7l-4 4V6c0-1.1.9-2 2-2h14c1.1 0 2 .9 2 2v10z" />
          </svg>
          {!collapsed && <span>Messages</span>}
        </button>

        {!collapsed && (
          <p className="text-xs text-emerald-700 truncate px-2 mb-2">{currentUser?.email}</p>
        )}
        <button
          onClick={logout}
          title="Sign out"
          className={`flex items-center gap-2 text-sm text-emerald-400/70 hover:text-white transition-colors w-full ${collapsed ? 'justify-center py-2' : 'px-2 py-1.5 hover:bg-emerald-900/50'}`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6a2 2 0 012 2v1" />
          </svg>
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>
    </aside>
  )
}


