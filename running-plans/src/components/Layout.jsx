import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Messenger from './Messenger'
import { MessengerProvider } from '../contexts/MessengerContext'

export default function Layout() {
  return (
    <MessengerProvider>
      <div className="flex min-h-screen" style={{ background: 'linear-gradient(160deg, #f0fdf4 0%, #ecfeff 100%)' }}>
        <Sidebar />
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
        <Messenger />
      </div>
    </MessengerProvider>
  )
}
