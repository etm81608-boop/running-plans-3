import { useMemo, useState } from 'react'
import { format, parseISO, isPast, isToday } from 'date-fns'

// ── Varsity Schedule ──────────────────────────────────────────────────────────

const VARSITY_MEETS = [
  { id: 1,  date: '2026-03-21', time: '10:00 AM', name: 'Upper Darby Relays',         opponents: [],                                                                              location: 'Upper Darby High School',            home: false },
  { id: 2,  date: '2026-03-27', time: null,        name: 'Neshaminy Distance Festival', opponents: [],                                                                              location: 'Neshaminy High School',              home: false },
  { id: 3,  date: '2026-04-08', time: null,        name: 'Multi-Team Meet',             opponents: ['William Penn Charter School', 'Germantown Academy', 'The Agnes Irwin School'], location: 'William Penn Charter School',         home: false },
  { id: 4,  date: '2026-04-10', time: null,        name: 'Haverford Distance Night',    opponents: [],                                                                              location: 'Haverford High School',              home: false },
  { id: 5,  date: '2026-04-11', time: null,        name: 'DELCO Relays',                opponents: [],                                                                              location: 'Marple Newtown High School',          home: false },
  { id: 6,  date: '2026-04-11', time: '11:00 AM',  name: 'Brooks Fords Track Classic',  opponents: [],                                                                              location: 'Haverford High School',              home: false },
  { id: 7,  date: '2026-04-15', time: null,        name: 'Home Multi-Team Meet',        opponents: ['Academy of Notre Dame de Namur', 'Germantown Academy', 'The Baldwin School'], location: 'Greenwood Track',                    home: true  },
  { id: 8,  date: '2026-04-18', time: null,        name: 'Kellerman Relays',            opponents: [],                                                                              location: 'Great Valley High School',           home: false },
  { id: 9,  date: '2026-04-23', time: null,        name: 'Penn Relays — Day 1',         opponents: [],                                                                              location: 'Franklin Field, Philadelphia',        home: false },
  { id: 10, date: '2026-04-24', time: null,        name: 'Penn Relays — Day 2',         opponents: [],                                                                              location: 'Franklin Field, Philadelphia',        home: false },
  { id: 11, date: '2026-04-29', time: null,        name: 'Away Dual/Tri Meet',          opponents: ['Germantown Academy', 'The Baldwin School'],                                    location: 'Germantown Academy',                 home: false },
  { id: 12, date: '2026-04-30', time: null,        name: 'DELCO Champs — Day 1',        opponents: [],                                                                              location: 'Upper Darby High School',            home: false, championship: true },
  { id: 13, date: '2026-05-02', time: null,        name: 'DELCO Champs — Day 2',        opponents: [],                                                                              location: 'Rap Curry Athletic Complex (Penn Wood)', home: false, championship: true },
  { id: 14, date: '2026-05-09', time: null,        name: 'Inter-Ac Track Champs',       opponents: [],                                                                              location: 'Greenwood Track',                    home: true,  championship: true },
  { id: 15, date: '2026-05-16', time: null,        name: 'PAISAA Championship',         opponents: [],                                                                              location: 'Malvern Preparatory School',         home: false, championship: true },
]

// ── Middle School Schedule ────────────────────────────────────────────────────

const MS_MEETS = [
  { id: 1,  date: '2026-04-02', time: null, name: 'EA @ Penn Charter',              opponents: ['Penn Charter'],                    location: 'William Penn Charter School',         home: false },
  { id: 2,  date: '2026-04-08', time: null, name: 'Penn Relay Qualifier @ Penn Charter', opponents: [],                             location: 'William Penn Charter School',         home: false },
  { id: 3,  date: '2026-04-13', time: null, name: 'MP & St. Anne\'s @ EA',          opponents: ['Malvern Prep', 'St. Anne\'s'],     location: 'Greenwood Track',                    home: true  },
  { id: 4,  date: '2026-04-23', time: null, name: 'EA & Notre Dame @ GA',           opponents: ['Notre Dame', 'Germantown Academy'], location: 'Germantown Academy',                 home: false },
  { id: 5,  date: '2026-04-24', time: null, name: 'Penn Relays',                    opponents: [],                                  location: 'Franklin Field, Philadelphia',        home: false },
  { id: 6,  date: '2026-04-27', time: null, name: 'EA @ Springside Chestnut Hill',  opponents: ['Springside Chestnut Hill'],         location: 'Springside Chestnut Hill Academy',   home: false },
  { id: 7,  date: '2026-04-30', time: null, name: 'Haverford School @ EA',          opponents: ['Haverford School'],                 location: 'Greenwood Track',                    home: true  },
  { id: 8,  date: '2026-05-04', time: null, name: 'IAAL Championship',              opponents: [],                                  location: 'TBD',                                home: false, championship: true },
  { id: 9,  date: '2026-05-20', time: null, name: 'DELCO Champs',                   opponents: [],                                  location: 'Rap Curry Athletic Complex (Penn Wood)', home: false, championship: true },
]

// ── Main Component ────────────────────────────────────────────────────────────

function MeetColumn({ title, emoji, accentClass, meets }) {
  const [showPast, setShowPast] = useState(false)

  const upcoming = useMemo(
    () => meets.filter((m) => !isPast(parseISO(m.date + 'T23:59:59'))),
    [meets]
  )
  const past = useMemo(
    () => [...meets.filter((m) => isPast(parseISO(m.date + 'T23:59:59')))].reverse(),
    [meets]
  )
  const nextMeet = upcoming[0] || null

  return (
    <div>
      {/* Column header */}
      <div className={`flex items-center gap-2 mb-4 pb-2 border-b-2 ${accentClass}`}>
        <span className="text-base">{emoji}</span>
        <h2 className="text-base font-black text-gray-900">{title}</h2>
        <span className="ml-auto text-xs text-gray-400 font-medium">{upcoming.length} remaining</span>
      </div>

      {/* Next meet mini-banner */}
      {nextMeet && (
        <div className="mb-4 bg-brand-50 border border-brand-200 rounded-xl px-4 py-3">
          <p className="text-brand-400 text-xs font-semibold uppercase tracking-widest mb-0.5">Next Up</p>
          <p className="font-bold text-gray-900 text-sm leading-tight">{nextMeet.name}</p>
          <p className="text-xs text-gray-500 mt-1">
            📅 {format(parseISO(nextMeet.date + 'T12:00:00'), 'EEE, MMM d')}
            {nextMeet.time && <span> · 🕐 {nextMeet.time}</span>}
          </p>
          <p className="text-xs text-gray-500">📍 {nextMeet.location}</p>
        </div>
      )}

      {/* Upcoming meets */}
      {upcoming.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Upcoming</p>
          <div className="space-y-2">
            {upcoming.map((meet) => <MeetRow key={meet.id} meet={meet} />)}
          </div>
        </div>
      )}

      {/* Past meets (collapsible) */}
      {past.length > 0 && (
        <div>
          <button
            onClick={() => setShowPast((v) => !v)}
            className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 hover:text-gray-600 transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className={`h-3 w-3 transition-transform ${showPast ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
            Completed ({past.length})
          </button>
          {showPast && (
            <div className="space-y-2 opacity-60">
              {past.map((meet) => <MeetRow key={meet.id} meet={meet} past />)}
            </div>
          )}
        </div>
      )}

      {upcoming.length === 0 && past.length === 0 && (
        <p className="text-xs text-gray-400 italic">No meets scheduled.</p>
      )}
    </div>
  )
}

export default function Meets() {
  return (
    <div className="p-8 max-w-6xl">

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Meet Schedule</h1>
        <p className="text-sm text-gray-500 mt-0.5">Episcopal Academy · Spring 2026</p>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <MeetColumn
          title="Girls Varsity Track & Field"
          emoji="🏟️"
          accentClass="border-brand-400"
          meets={VARSITY_MEETS}
        />
        <MeetColumn
          title="Middle School Track"
          emoji="🏃"
          accentClass="border-emerald-400"
          meets={MS_MEETS}
        />
      </div>
    </div>
  )
}

// ── Meet Row ──────────────────────────────────────────────────────────────────

function MeetRow({ meet, past = false }) {
  const d = parseISO(meet.date + 'T12:00:00')
  const todayMeet = isToday(d)

  return (
    <div className={`bg-white rounded-2xl border shadow-sm px-5 py-4 flex items-start gap-4 ${
      todayMeet ? 'border-brand-400 ring-2 ring-brand-200' : 'border-gray-100'
    }`}>

      {/* Date tile */}
      <div className={`flex-shrink-0 w-14 text-center rounded-xl py-2 ${
        past ? 'bg-gray-100' : meet.championship ? 'bg-amber-50' : 'bg-brand-50'
      }`}>
        <p className={`text-xs font-semibold uppercase ${past ? 'text-gray-400' : 'text-brand-500'}`}>
          {format(d, 'MMM')}
        </p>
        <p className={`text-2xl font-black leading-none ${past ? 'text-gray-400' : 'text-brand-700'}`}>
          {format(d, 'd')}
        </p>
        <p className={`text-xs ${past ? 'text-gray-400' : 'text-brand-400'}`}>
          {format(d, 'EEE')}
        </p>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-0.5">
          <p className={`font-bold text-base ${past ? 'text-gray-500' : 'text-gray-900'}`}>
            {meet.name}
          </p>
          {meet.championship && (
            <span className="text-xs bg-amber-100 text-amber-700 font-bold px-2 py-0.5 rounded-full">🏆 Championship</span>
          )}
          {todayMeet && (
            <span className="text-xs bg-brand-600 text-white font-bold px-2 py-0.5 rounded-full animate-pulse">TODAY</span>
          )}
        </div>
        {meet.opponents.length > 0 && (
          <p className="text-xs text-gray-500 mb-1">vs. {meet.opponents.join(' · ')}</p>
        )}
        <div className="flex flex-wrap gap-3 text-xs text-gray-500 mt-1">
          <span>📍 {meet.location}</span>
          {meet.time && <span>🕐 {meet.time}</span>}
        </div>
      </div>

      {/* Home/Away */}
      <div className="flex-shrink-0">
        {meet.home ? (
          <span className="text-xs bg-emerald-100 text-emerald-700 font-semibold px-3 py-1 rounded-full">🏠 Home</span>
        ) : (
          <span className="text-xs bg-orange-50 text-orange-600 font-semibold px-3 py-1 rounded-full">✈️ Away</span>
        )}
      </div>
    </div>
  )
}
